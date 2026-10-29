import {
  type Collection,
  describeCollection,
  type MaterializeConfig,
  prepare,
  SLUG_PATTERN,
  titleOf,
  type ValidationIssue,
  validate,
} from '@materialize/core'
import {
  type AuthStore,
  type ContentStore,
  createAuthStore,
  createContentStore,
  createMediaStore,
  type Database,
  type MediaAsset,
  SlugTakenError,
  type StoredDocument,
  type User,
} from '@materialize/db'
import { type Context, Hono, type MiddlewareHandler } from 'hono'
import { bodyLimit } from 'hono/body-limit'
import { deleteCookie, getCookie, setCookie } from 'hono/cookie'
import { csrf } from 'hono/csrf'
import { HTTPException } from 'hono/http-exception'
import { secureHeaders } from 'hono/secure-headers'
import { z } from 'zod'
import { serveAdmin } from './admin.ts'
import { createMediaFiles, fileBody, MAX_UPLOAD, MediaError, mediaUrl, type Output } from './media.ts'
import { hashPassword, verifyPassword } from './password.ts'
import { statusPage } from './status-page.ts'

export const VERSION = '0.1.0'
const SESSION_COOKIE = 'mz_session'
const SESSION_TTL = 30 * 24 * 60 * 60 * 1000

type Env = { Variables: { user: User } }

class ApiError extends HTTPException {
  constructor(
    status: 400 | 401 | 403 | 404 | 409 | 413 | 422 | 429,
    code: string,
    message: string,
    issues?: ValidationIssue[],
  ) {
    super(status, { res: Response.json({ error: { code, message, issues } }, { status }) })
  }
}

const credentials = z.object({ email: z.email(), password: z.string().min(1) })
const setupBody = z.object({ email: z.email(), name: z.string().trim().min(1), password: z.string().min(10) })
const documentBody = z.object({ data: z.record(z.string(), z.unknown()), locale: z.string().optional() })

async function body<T>(c: Context, schema: z.ZodType<T>): Promise<T> {
  const json = await c.req.json().catch(() => {
    throw new ApiError(400, 'invalid_json', 'The request body must be JSON')
  })
  const result = schema.safeParse(json)
  if (!result.success) {
    throw new ApiError(
      422,
      'invalid_request',
      'The request is not valid',
      result.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
    )
  }
  return result.data
}

/** Naive in-memory limiter: enough to slow down password guessing on a single instance. */
function createLimiter(max: number, windowMs: number) {
  const hits = new Map<string, { n: number; until: number }>()
  return (key: string): boolean => {
    const now = Date.now()
    const entry = hits.get(key)
    if (!entry || entry.until < now) {
      hits.set(key, { n: 1, until: now + windowMs })
      return true
    }
    entry.n += 1
    return entry.n <= max
  }
}

export interface ServerContext {
  /** Returns the current config; the CLI swaps it when materialize.config.ts changes. */
  config: () => MaterializeConfig
  database: Database
  /** Folder with the built admin app, served at /admin. */
  adminDir?: string
  /** True when a site renderer answers /_materialize/preview: the admin then shows the real site on the canvas. */
  preview?: boolean
  /** Called after the live content changes (publish, unpublish, delete), e.g. to rebuild the static site. */
  onPublish?: () => void
}

export function createApp(ctx: ServerContext) {
  const content: ContentStore = createContentStore(ctx.database.db)
  const auth: AuthStore = createAuthStore(ctx.database.db)
  const allowLogin = createLimiter(10, 60_000)
  const mediaStore = createMediaStore(ctx.database.db)
  const files = createMediaFiles(ctx.config().media.dir)
  const app = new Hono<Env>()

  const collection = (name: string): Collection => {
    const found = ctx.config().collections.find((x) => x.name === name)
    if (!found) throw new ApiError(404, 'unknown_collection', `There is no collection named "${name}"`)
    return found
  }

  const locale = (value: string | undefined): string => {
    const { locales } = ctx.config()
    const chosen = value ?? locales.default
    if (!locales.available.includes(chosen))
      throw new ApiError(400, 'unknown_locale', `Locale "${chosen}" is not enabled`)
    return chosen
  }

  const startSession = async (c: Context, userId: string) => {
    const { token, expiresAt } = await auth.createSession(userId, SESSION_TTL)
    setCookie(c, SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: 'Lax',
      secure: new URL(c.req.url).protocol === 'https:',
      path: '/',
      expires: expiresAt,
    })
  }

  const requireUser: MiddlewareHandler<Env> = async (c, next) => {
    const token = getCookie(c, SESSION_COOKIE)
    const user = token ? await auth.userForSession(token) : null
    if (!user) throw new ApiError(401, 'unauthenticated', 'Sign in to continue')
    c.set('user', user)
    await next()
  }

  const requireAdmin: MiddlewareHandler<Env> = async (c, next) => {
    if (c.get('user').role !== 'admin') throw new ApiError(403, 'forbidden', 'Only administrators can do this')
    await next()
  }

  /** A document as the admin sees it, with what still needs fixing before it can be published. */
  const toJson = (doc: StoredDocument) => {
    const def = ctx.config().collections.find((x) => x.name === doc.collection)
    const check = def ? validate(def, prepare(def, doc.data)) : null
    return {
      ...doc,
      url: def?.url ? def.url(doc.data as never) : null,
      issues: check && !check.ok ? check.issues : [],
    }
  }

  /**
   * Drafts are saved even when incomplete, so autosave never loses work: problems come back as `issues` (see toJson).
   * Only valid content can be published.
   */
  const draftData = (def: Collection, raw: Record<string, unknown>) => {
    const prepared = prepare(def, raw)
    const result = validate(def, prepared)
    const data = result.ok ? (result.data as Record<string, unknown>) : prepared
    const slugValue = def.slugField ? data[def.slugField] : undefined
    const slug = typeof slugValue === 'string' && SLUG_PATTERN.test(slugValue) ? slugValue : null
    return { data, slug, title: titleOf(def, data) }
  }

  const publishableData = (def: Collection, raw: Record<string, unknown>) => {
    const result = validate(def, prepare(def, raw))
    if (!result.ok) throw new ApiError(422, 'invalid_content', 'Some fields need attention', result.issues)
    return result.data as Record<string, unknown>
  }

  const slugGuard = async <T>(run: () => Promise<T>): Promise<T> => {
    try {
      return await run()
    } catch (error) {
      if (error instanceof SlugTakenError) throw new ApiError(409, 'slug_taken', error.message)
      throw error
    }
  }

  app.use('*', secureHeaders())
  app.use('/api/*', csrf())

  app.onError((error, c) => {
    if (error instanceof HTTPException) return error.getResponse()
    console.error(error)
    return c.json({ error: { code: 'internal', message: 'Something went wrong on the server' } }, 500)
  })
  app.notFound((c) => c.json({ error: { code: 'not_found', message: 'Not found' } }, 404))

  app.get('/', async (c) => c.html(statusPage(ctx.config(), VERSION, (await auth.countUsers()) === 0)))
  app.get('/admin', (c) => c.redirect('/admin/'))
  app.get('/admin/*', (c) => serveAdmin(c, ctx.adminDir))
  app.get('/api/health', (c) => c.json({ ok: true, version: VERSION }))

  // ---------- setup & auth ----------

  app.get('/api/setup', async (c) => c.json({ needsSetup: (await auth.countUsers()) === 0 }))

  app.post('/api/setup', async (c) => {
    const input = await body(c, setupBody)
    if ((await auth.countUsers()) > 0) throw new ApiError(409, 'already_set_up', 'An administrator already exists')
    const user = await auth.createUser({
      email: input.email,
      name: input.name,
      role: 'admin',
      passwordHash: await hashPassword(input.password),
    })
    await startSession(c, user.id)
    return c.json({ user }, 201)
  })

  app.post('/api/auth/login', async (c) => {
    const input = await body(c, credentials)
    if (!allowLogin(input.email.toLowerCase()))
      throw new ApiError(429, 'too_many_attempts', 'Too many attempts, wait a minute')
    const found = await auth.findForLogin(input.email)
    const ok = found ? await verifyPassword(input.password, found.passwordHash) : false
    if (!found || !ok) throw new ApiError(401, 'invalid_credentials', 'Email or password is not correct')
    await startSession(c, found.id)
    const { passwordHash: _, ...user } = found
    return c.json({ user })
  })

  app.post('/api/auth/logout', async (c) => {
    const token = getCookie(c, SESSION_COOKIE)
    if (token) await auth.deleteSession(token)
    deleteCookie(c, SESSION_COOKIE, { path: '/' })
    return c.json({ ok: true })
  })

  app.get('/api/auth/me', requireUser, (c) => c.json({ user: c.get('user') }))

  // ---------- schema ----------

  app.get('/api/schema', requireUser, (c) => {
    const config = ctx.config()
    return c.json({
      site: config.site,
      preview: ctx.preview === true,
      locales: config.locales,
      collections: config.collections.map(describeCollection),
    })
  })

  // ---------- management API ----------

  app.get('/api/collections/:name', requireUser, async (c) => {
    const def = collection(c.req.param('name'))
    const result = await content.list(def.name, {
      locale: locale(c.req.query('locale')),
      search: c.req.query('search') || undefined,
      limit: Number(c.req.query('limit') ?? 50),
      offset: Number(c.req.query('offset') ?? 0),
    })
    return c.json(result)
  })

  app.post('/api/collections/:name', requireUser, async (c) => {
    const def = collection(c.req.param('name'))
    const input = await body(c, documentBody)
    const lang = locale(input.locale)
    if (def.singleton && (await content.list(def.name, { locale: lang, limit: 1 })).total > 0) {
      throw new ApiError(409, 'singleton_exists', `"${def.label}" already exists; edit it instead`)
    }
    const draft = draftData(def, input.data)
    const doc = await slugGuard(() =>
      content.create({ collection: def.name, locale: lang, ...draft, userId: c.get('user').id }),
    )
    return c.json(toJson(doc), 201)
  })

  const loadDocument = async (id: string) => {
    const doc = await content.get(id)
    if (!doc) throw new ApiError(404, 'not_found', 'This document does not exist')
    return doc
  }

  app.get('/api/documents/:id', requireUser, async (c) => c.json(toJson(await loadDocument(c.req.param('id')))))

  app.put('/api/documents/:id', requireUser, async (c) => {
    const existing = await loadDocument(c.req.param('id'))
    const input = await body(c, documentBody)
    const draft = draftData(collection(existing.collection), input.data)
    const doc = await slugGuard(() => content.update(existing.id, { ...draft, userId: c.get('user').id }))
    return c.json(toJson(doc as StoredDocument))
  })

  app.post('/api/documents/:id/publish', requireUser, async (c) => {
    const existing = await loadDocument(c.req.param('id'))
    // Validated now, not at save time: drafts may be incomplete and the schema may have changed since.
    const data = publishableData(collection(existing.collection), existing.data)
    const doc = (await content.publish(existing.id, c.get('user').id, data)) as StoredDocument
    ctx.onPublish?.()
    return c.json(toJson(doc))
  })

  app.post('/api/documents/:id/unpublish', requireUser, async (c) => {
    const existing = await loadDocument(c.req.param('id'))
    const doc = (await content.unpublish(existing.id, c.get('user').id)) as StoredDocument
    if (existing.publishedAt) ctx.onPublish?.()
    return c.json(toJson(doc))
  })

  app.delete('/api/documents/:id', requireUser, requireAdmin, async (c) => {
    const existing = await loadDocument(c.req.param('id'))
    await content.remove(existing.id)
    if (existing.publishedAt) ctx.onPublish?.()
    return c.body(null, 204)
  })

  app.get('/api/documents/:id/revisions', requireUser, async (c) => {
    const existing = await loadDocument(c.req.param('id'))
    return c.json({ items: await content.revisions(existing.id) })
  })

  app.post('/api/documents/:id/revisions/:revision/restore', requireUser, async (c) => {
    const existing = await loadDocument(c.req.param('id'))
    const doc = await content.restore(existing.id, c.req.param('revision'), c.get('user').id)
    if (!doc) throw new ApiError(404, 'not_found', 'This version does not exist')
    return c.json(toJson(doc))
  })

  // ---------- media ----------

  const assetJson = (asset: MediaAsset) => ({ ...asset, url: mediaUrl(asset) })
  const loadAsset = async (id: string) => {
    const asset = await mediaStore.get(id)
    if (!asset) throw new ApiError(404, 'not_found', 'This file does not exist')
    return asset
  }

  app.get('/api/media', requireUser, async (c) => {
    const result = await mediaStore.list({
      search: c.req.query('search') || undefined,
      limit: Number(c.req.query('limit') ?? 60),
      offset: Number(c.req.query('offset') ?? 0),
    })
    return c.json({ total: result.total, items: result.items.map(assetJson) })
  })

  app.post(
    '/api/media',
    requireUser,
    bodyLimit({
      maxSize: MAX_UPLOAD + 64 * 1024,
      onError: () => {
        throw new ApiError(413, 'file_too_large', `Files can be at most ${MAX_UPLOAD / 1024 / 1024} MB`)
      },
    }),
    async (c) => {
      const body = await c.req.parseBody()
      const file = body.file
      if (!(file instanceof File)) throw new ApiError(400, 'missing_file', 'Send the file in the "file" field')
      let saved: Awaited<ReturnType<typeof files.save>>
      try {
        saved = await files.save(file.name, Buffer.from(await file.arrayBuffer()))
      } catch (error) {
        if (error instanceof MediaError) throw new ApiError(422, 'invalid_file', error.message)
        throw error
      }
      const asset = await mediaStore.create({
        ...saved,
        filename: file.name.slice(0, 200),
        alt: typeof body.alt === 'string' ? body.alt : '',
        createdBy: c.get('user').id,
      })
      return c.json(assetJson(asset), 201)
    },
  )

  app.get('/api/media/:id', requireUser, async (c) => {
    const asset = await loadAsset(c.req.param('id'))
    return c.json({ ...assetJson(asset), usage: await mediaStore.usage(asset.key) })
  })

  app.patch('/api/media/:id', requireUser, async (c) => {
    const asset = await loadAsset(c.req.param('id'))
    const input = await body(c, z.object({ alt: z.string().max(500) }))
    return c.json(assetJson((await mediaStore.update(asset.id, input)) as MediaAsset))
  })

  app.delete('/api/media/:id', requireUser, requireAdmin, async (c) => {
    const asset = await loadAsset(c.req.param('id'))
    await mediaStore.remove(asset.id)
    await files.remove(asset.key)
    return c.body(null, 204)
  })

  // Public files: /media/<key> is the original, /media/<key>@<width>.<format> a resized copy.
  // Flat names, so a static export can hold both as plain files.
  const sendFile = async (c: Context, key: string, variant?: { width: number; format: Output }) => {
    const file = await files.open(key, variant)
    if (!file) return c.json({ error: { code: 'not_found', message: 'Not found' } }, 404)
    return c.body(fileBody(file.path), 200, {
      'content-type': file.type,
      'cache-control': 'public, max-age=31536000, immutable',
    })
  }
  app.get('/media/:file', async (c) => {
    const file = c.req.param('file')
    const variant = /^(.+)@(\d{2,4})\.(avif|webp|jpg|png)$/.exec(file)
    if (!variant) return sendFile(c, file)
    return sendFile(c, variant[1] as string, { width: Number(variant[2]), format: variant[3] as Output })
  })

  // ---------- public delivery API: published content only ----------

  const publicDocument = (doc: StoredDocument) => {
    const def = ctx.config().collections.find((x) => x.name === doc.collection)
    const data = doc.publishedData ?? {}
    return {
      id: doc.id,
      slug: doc.slug,
      locale: doc.locale,
      publishedAt: doc.publishedAt,
      url: def?.url ? def.url(data as never) : null,
      data,
    }
  }

  app.get('/api/content/:name', async (c) => {
    const def = collection(c.req.param('name'))
    const lang = locale(c.req.query('locale'))
    const list = await content.list(def.name, {
      locale: lang,
      publishedOnly: true,
      limit: Number(c.req.query('limit') ?? 50),
      offset: Number(c.req.query('offset') ?? 0),
    })
    const docs = await Promise.all(list.items.map((item) => content.get(item.id)))
    return c.json({ total: list.total, items: docs.filter((d): d is StoredDocument => !!d).map(publicDocument) })
  })

  app.get('/api/content/:name/:slug', async (c) => {
    const def = collection(c.req.param('name'))
    const doc = await content.getBySlug(def.name, c.req.param('slug'), locale(c.req.query('locale')))
    if (!doc?.publishedData) throw new ApiError(404, 'not_found', 'This page is not published')
    return c.json(publicDocument(doc))
  })

  return app
}
