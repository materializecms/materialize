import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { dirname, join, resolve } from 'node:path'
import {
  type Collection,
  describeCollection,
  type MaterializeConfig,
  prepare,
  SLUG_PATTERN,
  titleOf,
  type ValidationIssue,
  validate,
} from '@materializecms/core'
import { normalizeTheme, type PageNode, sameDesign } from '@materializecms/core/page'
import { addMove, normalizePath, type Redirect, type SiteSeo } from '@materializecms/core/seo'
import {
  type AuthStore,
  type ContentStore,
  createAuthStore,
  createCommentStore,
  createContentStore,
  createMediaStore,
  createSettingsStore,
  createSubmissionStore,
  type Database,
  EmailTakenError,
  type MediaAsset,
  SlugTakenError,
  type StoredDocument,
  type User,
} from '@materializecms/db'
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js'
import { type Context, Hono, type MiddlewareHandler } from 'hono'
import { bodyLimit } from 'hono/body-limit'
import { deleteCookie, getCookie, setCookie } from 'hono/cookie'
import { csrf } from 'hono/csrf'
import { HTTPException } from 'hono/http-exception'
import { secureHeaders } from 'hono/secure-headers'
import { streamSSE } from 'hono/streaming'
import { z } from 'zod'
import { serveAdmin } from './admin.ts'
import { AiError, type AiSettings, type Conversation, complete, EMPTY_AI, isReady, publicAi, runTurn } from './ai.ts'
import { createFonts, FONT_FILE, FONT_ID } from './fonts.ts'
import { isConfigured, type MailSettings, publicMail, sendMail, submissionText } from './mail.ts'
import { createMcpServer } from './mcp.ts'
import { createMediaFiles, fileBody, MAX_UPLOAD, MediaError, mediaUrl, type Output } from './media.ts'
import { hashPassword, verifyPassword } from './password.ts'
import { fetchPublicFile, RemoteError } from './remote.ts'
import { statusPage } from './status-page.ts'
import { apiCaller, assistantTools } from './tools.ts'

/** The installed version, from this package's package.json (same place in the sources and in the release). */
export const VERSION: string = createRequire(import.meta.url)('../package.json').version
const SESSION_COOKIE = 'mz_session'
const SESSION_TTL = 30 * 24 * 60 * 60 * 1000
const INVITE_TTL = 7 * 24 * 60 * 60 * 1000
const RESET_TTL = 24 * 60 * 60 * 1000
/** Where people open their one-time link: the admin's welcome screen. */
const linkPath = (token: string) => `/admin/_invite/${token}`

/** `viaToken`: signed in with a personal access token (an MCP client, a script) instead of the panel's cookie. */
type Env = { Variables: { user: User; viaToken?: boolean } }

/** The custom code blocks in a document: it runs on the public site, so only admins may change it. */
function embedsOf(value: unknown, out: string[] = []): string[] {
  if (Array.isArray(value)) for (const v of value) embedsOf(v, out)
  else if (value && typeof value === 'object') {
    const node = value as Record<string, unknown>
    if (node.type === 'embed' && typeof node.id === 'string') out.push(`${node.id}:${String(node.html ?? '')}`)
    for (const v of Object.values(node)) if (v && typeof v === 'object') embedsOf(v, out)
  }
  return out
}

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
const roleSchema = z.enum(['admin', 'editor'])
const documentBody = z.object({ data: z.record(z.string(), z.unknown()), locale: z.string().optional() })

const mediaRef = z
  .object({
    src: z.string().min(1).max(1000),
    alt: z.string().max(500),
    width: z.number().optional(),
    height: z.number().optional(),
  })
  .optional()
const short = z.string().trim().max(200).optional()
const siteSeoSchema = z.object({
  siteName: short,
  titleTemplate: short,
  description: z.string().max(300).optional(),
  image: mediaRef,
  favicon: mediaRef,
  xHandle: short,
  business: z
    .object({
      type: z
        .enum(['Organization', 'LocalBusiness', 'ProfessionalService', 'Store', 'Restaurant', 'Person'])
        .optional(),
      name: short,
      logo: mediaRef,
      phone: short,
      email: short,
      street: short,
      city: short,
      postalCode: short,
      region: short,
      country: short,
      hours: short,
      sameAs: z.array(z.string().trim().max(500)).max(20).optional(),
    })
    .optional(),
  blockAi: z.boolean().optional(),
  disallow: z.array(z.string().trim().max(300)).max(100).optional(),
  google: short,
  bing: short,
})
const redirectSchema = z.object({
  from: z.string().trim().min(1).max(500),
  to: z.string().trim().min(1).max(1000),
  auto: z.boolean().optional(),
})

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
  const settings = createSettingsStore(ctx.database.db)
  const submissions = createSubmissionStore(ctx.database.db)
  const comments = createCommentStore(ctx.database.db)
  /**
   * Who has a document open, in memory: each editor checks in every few seconds with the element it
   * has selected. Gone after 30 s of silence.
   */
  const presence = new Map<string, Map<string, { id: string; name: string; selected: string | null; at: number }>>()
  // A form can be sent a few times a minute from one address: enough for people, not for spam.
  const allowForm = createLimiter(5, 60_000)
  const files = createMediaFiles(ctx.config().media.dir)
  // Fonts are cached next to the media library (.materialize/fonts by default).
  const fonts = createFonts(join(dirname(resolve(ctx.config().media.dir)), 'fonts'))
  const app = new Hono<Env>()

  const guardEmbeds = (user: User, before: unknown, after: unknown) => {
    if (user.role === 'admin') return
    if (JSON.stringify(embedsOf(before).sort()) !== JSON.stringify(embedsOf(after).sort()))
      throw new ApiError(
        403,
        'embed_admin_only',
        'Solo un amministratore può aggiungere o modificare il codice personalizzato',
      )
  }

  /** Editors who may only change contents (Persone → Redattori): words, links and images, not the layout. */
  const contentOnly = async (user: User) =>
    user.role !== 'admin' && !!(await settings.get<{ editorsContentOnly?: boolean }>('editorial'))?.editorsContentOnly
  const designLocked = () =>
    new ApiError(403, 'content_only', 'Puoi modificare testi, collegamenti e immagini, non il layout della pagina')
  const guardDesign = async (user: User, before: unknown, after: unknown) => {
    const pages = (v: unknown) => (Array.isArray(v) ? (v as PageNode[]) : [])
    if (!sameDesign(pages(before), pages(after)) && (await contentOnly(user))) throw designLocked()
  }

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

  /** The bearer token of a request, if it sends one (personal access tokens). */
  const bearerOf = (c: Context) => /^Bearer\s+(\S+)$/i.exec(c.req.header('authorization') ?? '')?.[1]

  const requireUser: MiddlewareHandler<Env> = async (c, next) => {
    const bearer = bearerOf(c)
    if (bearer) {
      const user = await auth.userForToken(bearer)
      if (!user) throw new ApiError(401, 'invalid_token', 'This access token is not valid or was revoked')
      c.set('user', user)
      c.set('viaToken', true)
      return next()
    }
    const token = getCookie(c, SESSION_COOKIE)
    const user = token ? await auth.userForSession(token) : null
    if (!user) throw new ApiError(401, 'unauthenticated', 'Sign in to continue')
    c.set('user', user)
    await next()
  }

  /** Only from the panel: a token cannot make or revoke tokens, nor change who someone is. */
  const requireSession: MiddlewareHandler<Env> = async (c, next) => {
    if (c.get('viaToken')) throw new ApiError(403, 'session_required', 'Do this from the admin panel')
    await next()
  }

  const requireAdmin: MiddlewareHandler<Env> = async (c, next) => {
    if (c.get('user').role !== 'admin') throw new ApiError(403, 'forbidden', 'Only administrators can do this')
    await next()
  }

  /** The public address of a document, with the locale prefix outside the default locale. */
  const publicUrl = (def: Collection, locale: string, data: Record<string, unknown>): string | null => {
    if (!def.url) return null
    const path = def.url(data as never)
    if (locale === ctx.config().locales.default) return path
    return `/${locale}${path === '/' ? '' : path}`
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
  // Requests with a bearer token carry no cookie, so a forged form cannot ride on them.
  const checkOrigin = csrf()
  app.use('/api/*', (c, next) => (bearerOf(c) ? next() : checkOrigin(c, next)))
  // Answers change with every edit: browsers must not reuse them.
  app.use('/api/*', async (c, next) => {
    await next()
    if (!c.res.headers.has('cache-control')) c.res.headers.set('cache-control', 'no-store')
  })

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

  // MCP (Streamable HTTP, stateless): AI clients connect with a personal access token and act as
  // its owner through the same API, checks included.
  app.all('/mcp', requireUser, async (c) => {
    const auth: Record<string, string> = {}
    const authorization = c.req.header('authorization')
    const cookie = c.req.header('cookie')
    if (authorization) auth.authorization = authorization
    else if (cookie) auth.cookie = cookie
    const server = createMcpServer(apiCaller(app.fetch, auth), VERSION)
    const transport = new WebStandardStreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    })
    await server.connect(transport)
    return transport.handleRequest(c.req.raw)
  })

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

  // ---------- personal access tokens (MCP clients, scripts) ----------

  app.get('/api/tokens', requireUser, requireSession, async (c) =>
    c.json({ tokens: await auth.listTokens(c.get('user').id) }),
  )

  app.post('/api/tokens', requireUser, requireSession, async (c) => {
    const input = await body(c, z.object({ name: z.string().trim().min(1).max(80) }))
    const { token, record } = await auth.createToken(c.get('user').id, input.name)
    return c.json({ token, record }, 201)
  })

  app.delete('/api/tokens/:id', requireUser, requireSession, async (c) => {
    if (!(await auth.revokeToken(c.req.param('id'), c.get('user').id)))
      throw new ApiError(404, 'not_found', 'There is no such token')
    return c.json({ ok: true })
  })

  app.patch('/api/auth/me', requireUser, async (c) => {
    const input = await body(c, z.object({ name: z.string().trim().min(1).max(80) }))
    return c.json({ user: await auth.updateUser(c.get('user').id, input) })
  })

  app.post('/api/auth/password', requireUser, requireSession, async (c) => {
    const input = await body(c, z.object({ current: z.string().min(1), next: z.string().min(10) }))
    const user = c.get('user')
    const hash = await auth.getPasswordHash(user.id)
    if (!hash || !(await verifyPassword(input.current, hash))) {
      throw new ApiError(422, 'wrong_password', 'The current password is not correct', [
        { path: 'current', message: 'La password attuale non è corretta' },
      ])
    }
    // Other devices are signed out; this one stays in.
    await auth.setPassword(user.id, await hashPassword(input.next), getCookie(c, SESSION_COOKIE))
    return c.json({ ok: true })
  })

  // ---------- people (admins only) ----------

  const loadUser = async (id: string) => {
    const user = await auth.getUser(id)
    if (!user) throw new ApiError(404, 'not_found', 'This person does not exist')
    return user
  }

  app.get('/api/users', requireUser, requireAdmin, async (c) =>
    c.json({ users: await auth.listUsers(), invites: await auth.pendingInvites() }),
  )

  app.post('/api/users/invites', requireUser, requireSession, requireAdmin, async (c) => {
    const input = await body(
      c,
      z.object({ email: z.email(), name: z.string().trim().max(80).optional(), role: roleSchema }),
    )
    try {
      const { token, invite } = await auth.createInvite({
        kind: 'invite',
        ...input,
        createdBy: c.get('user').id,
        ttlMs: INVITE_TTL,
      })
      const link = linkPath(token)
      const mailed = await mailLink(
        c,
        input.email,
        'Il tuo invito',
        [
          `${c.get('user').name} ti ha invitato a lavorare sul sito con Materialize.`,
          'Apri questo link per scegliere la tua password ed entrare:',
        ],
        link,
      )
      return c.json({ invite, link, mailed }, 201)
    } catch (error) {
      if (error instanceof EmailTakenError) throw new ApiError(409, 'email_taken', error.message)
      throw error
    }
  })

  app.delete('/api/users/invites/:id', requireUser, requireSession, requireAdmin, async (c) => {
    if (!(await auth.revokeInvite(c.req.param('id')))) throw new ApiError(404, 'not_found', 'Invitation not found')
    return c.body(null, 204)
  })

  app.patch('/api/users/:id', requireUser, requireSession, requireAdmin, async (c) => {
    const target = await loadUser(c.req.param('id'))
    const input = await body(
      c,
      z.object({ role: roleSchema.optional(), name: z.string().trim().min(1).max(80).optional() }),
    )
    if (target.role === 'admin' && input.role === 'editor' && (await auth.countAdmins()) === 1) {
      throw new ApiError(409, 'last_admin', 'The site needs at least one administrator')
    }
    return c.json({ user: await auth.updateUser(target.id, input) })
  })

  app.delete('/api/users/:id', requireUser, requireSession, requireAdmin, async (c) => {
    const target = await loadUser(c.req.param('id'))
    if (target.id === c.get('user').id) throw new ApiError(409, 'remove_self', 'You cannot remove yourself')
    if (target.role === 'admin' && (await auth.countAdmins()) === 1) {
      throw new ApiError(409, 'last_admin', 'The site needs at least one administrator')
    }
    await auth.deleteUser(target.id)
    return c.body(null, 204)
  })

  app.post('/api/users/:id/reset', requireUser, requireSession, requireAdmin, async (c) => {
    const target = await loadUser(c.req.param('id'))
    const { token, invite } = await auth.createInvite({
      kind: 'reset',
      email: target.email,
      name: target.name,
      role: target.role,
      userId: target.id,
      createdBy: c.get('user').id,
      ttlMs: RESET_TTL,
    })
    const link = linkPath(token)
    const mailed = await mailLink(
      c,
      target.email,
      'Nuova password',
      ['È stata chiesta una nuova password per il tuo account. Il link vale 24 ore:'],
      link,
    )
    return c.json({ invite, link, mailed }, 201)
  })

  // ---------- one-time links (no session needed) ----------

  const loadInvite = async (token: string) => {
    const invite = await auth.findInvite(token)
    if (!invite) throw new ApiError(404, 'invalid_link', 'This link is not valid or has expired')
    return invite
  }

  app.get('/api/invites/:token', async (c) => {
    const { kind, email, name, role, expiresAt } = await loadInvite(c.req.param('token'))
    return c.json({ kind, email, name, role, expiresAt, site: ctx.config().site.name })
  })

  app.post('/api/invites/:token/accept', async (c) => {
    const token = c.req.param('token')
    const invite = await loadInvite(token)
    const input = await body(
      c,
      z.object({ name: z.string().trim().min(1).max(80).optional(), password: z.string().min(10) }),
    )
    const passwordHash = await hashPassword(input.password)
    let user: User | null
    if (invite.kind === 'reset' && invite.userId) {
      await auth.setPassword(invite.userId, passwordHash)
      user = await auth.getUser(invite.userId)
    } else {
      if (await auth.emailTaken(invite.email))
        throw new ApiError(409, 'email_taken', 'This email already has an account')
      user = await auth.createUser({
        email: invite.email,
        name: input.name || invite.name || invite.email.split('@')[0] || invite.email,
        role: invite.role,
        passwordHash,
      })
    }
    await auth.consumeInvite(token)
    if (!user) throw new ApiError(404, 'not_found', 'This person does not exist')
    await startSession(c, user.id)
    return c.json({ user }, invite.kind === 'reset' ? 200 : 201)
  })

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

  // The site's design theme: colors, fonts and roundness used by pages built on the canvas.
  app.get('/api/theme', requireUser, async (c) => c.json({ theme: normalizeTheme(await settings.get('theme')) }))

  app.put('/api/theme', requireUser, requireAdmin, async (c) => {
    const input = await body(c, z.object({ theme: z.record(z.string(), z.unknown()) }))
    const theme = normalizeTheme(input.theme)
    await settings.set('theme', theme, c.get('user').id)
    ctx.onPublish?.()
    return c.json({ theme })
  })

  // Sections shared by several pages (menu, footer): edited once, live everywhere.
  /** Where each global section appears: the titles of the pages that use it, draft or published. */
  const globalUsage = async (): Promise<Record<string, string[]>> => {
    const out: Record<string, string[]> = {}
    const { collections, locales } = ctx.config()
    for (const def of collections) {
      const pageFields = Object.entries(def.fields).filter(([, f]) => f.kind === 'page')
      if (!pageFields.length) continue
      for (const lang of locales.available) {
        const { items } = await content.list(def.name, { locale: lang, limit: 200 })
        for (const doc of await content.getMany(items.map((i) => i.id)))
          for (const [name] of pageFields)
            for (const data of [doc.data, doc.publishedData ?? {}]) {
              const nodes = data[name]
              if (!Array.isArray(nodes)) continue
              for (const n of nodes as PageNode[]) {
                if (!n.global) continue
                const titles = out[n.global] ?? []
                if (!titles.includes(doc.title)) out[n.global] = [...titles, doc.title]
              }
            }
      }
    }
    return out
  }

  app.get('/api/globals', requireUser, async (c) =>
    c.json({ globals: (await settings.get('globals')) ?? {}, usage: await globalUsage() }),
  )

  app.put('/api/globals', requireUser, async (c) => {
    const input = await body(c, z.object({ globals: z.record(z.string(), z.record(z.string(), z.unknown())) }))
    const before = (await settings.get<Record<string, PageNode>>('globals')) ?? {}
    guardEmbeds(c.get('user'), before, input.globals)
    const removed = Object.keys(before).filter((id) => !input.globals[id])
    if (removed.length) {
      const usage = await globalUsage()
      const inUse = removed.find((id) => usage[id]?.length)
      if (inUse)
        throw new ApiError(
          409,
          'global_in_use',
          `La sezione è ancora in ${usage[inUse]?.map((t) => `“${t}”`).join(', ')}: toglila prima dalle pagine`,
        )
    }
    const ids = [...new Set([...Object.keys(before), ...Object.keys(input.globals)])].sort()
    await guardDesign(
      c.get('user'),
      ids.map((id) => before[id] ?? { id, type: 'frame' }),
      ids.map((id) => (input.globals[id] as PageNode | undefined) ?? { id, type: 'frame' }),
    )
    await settings.set('globals', input.globals, c.get('user').id)
    ctx.onPublish?.()
    return c.json({ globals: input.globals })
  })

  // ---------- comments and presence ----------

  app.get('/api/documents/:id/comments', requireUser, async (c) =>
    c.json({ items: await comments.list(c.req.param('id')) }),
  )

  app.post('/api/documents/:id/comments', requireUser, async (c) => {
    const input = await body(
      c,
      z.object({ nodeId: z.string().max(200).nullable(), body: z.string().trim().min(1).max(4000) }),
    )
    const user = c.get('user')
    const comment = await comments.add({
      documentId: c.req.param('id'),
      nodeId: input.nodeId,
      authorId: user.id,
      authorName: user.name,
      body: input.body,
    })
    return c.json({ comment }, 201)
  })

  app.patch('/api/comments/:id', requireUser, async (c) => {
    const input = await body(c, z.object({ resolved: z.boolean() }))
    await comments.resolve(c.req.param('id'), input.resolved)
    return c.json({ ok: true })
  })

  app.delete('/api/comments/:id', requireUser, async (c) => {
    const comment = await comments.get(c.req.param('id'))
    if (!comment) throw new ApiError(404, 'not_found', 'Comment not found')
    const user = c.get('user')
    if (comment.authorId !== user.id && user.role !== 'admin')
      throw new ApiError(403, 'forbidden', 'Only the author or an admin can delete a comment')
    await comments.remove(comment.id)
    return c.body(null, 204)
  })

  app.post('/api/documents/:id/presence', requireUser, async (c) => {
    const input = await body(c, z.object({ selected: z.string().max(200).nullable() }))
    const user = c.get('user')
    const docId = c.req.param('id')
    const now = Date.now()
    const here = presence.get(docId) ?? new Map()
    here.set(user.id, { id: user.id, name: user.name, selected: input.selected, at: now })
    presence.set(docId, here)
    for (const [k, p] of here) if (now - p.at > 30_000) here.delete(k)
    return c.json({ others: [...here.values()].filter((p) => p.id !== user.id).map(({ at: _, ...p }) => p) })
  })

  // ---------- email and forms ----------

  /** Sends a one-time link by email when email is set up; false when it is not (the link is shown instead). */
  const mailLink = async (c: Context<Env>, to: string, subject: string, lines: string[], path: string) => {
    const mail = await settings.get<MailSettings>('mail')
    if (!isConfigured(mail)) return false
    try {
      const url = new URL(path, new URL(c.req.url).origin).toString()
      await sendMail(mail, { to, subject, text: `${lines.join('\n')}\n\n${url}\n` })
      return true
    } catch (error) {
      console.error('Materialize: email not sent', error)
      return false
    }
  }

  app.get('/api/mail', requireUser, requireSession, requireAdmin, async (c) =>
    c.json({ mail: publicMail(await settings.get<MailSettings>('mail')) }),
  )

  app.put('/api/mail', requireUser, requireSession, requireAdmin, async (c) => {
    const input = await body(
      c,
      z.object({
        mail: z.object({
          host: z.string().max(200),
          port: z.number().int().min(1).max(65535),
          security: z.enum(['tls', 'starttls', 'none']),
          user: z.string().max(200),
          // Empty: keep the saved password. null: remove it.
          pass: z.string().max(500).nullable().optional(),
          from: z.string().max(200),
          to: z.string().max(200),
        }),
      }),
    )
    const before = await settings.get<MailSettings>('mail')
    const pass = input.mail.pass === null ? '' : input.mail.pass || before?.pass || ''
    const mail: MailSettings = { ...input.mail, pass }
    await settings.set('mail', mail, c.get('user').id)
    return c.json({ mail: publicMail(mail) })
  })

  app.post('/api/mail/test', requireUser, requireSession, requireAdmin, async (c) => {
    const mail = await settings.get<MailSettings>('mail')
    if (!isConfigured(mail)) throw new ApiError(400, 'mail_not_configured', 'Email is not set up')
    const to = mail.to || c.get('user').email
    try {
      await sendMail(mail, {
        to,
        subject: 'Prova di invio da Materialize',
        text: 'Se leggi questo messaggio, l’invio delle email dal sito funziona.',
      })
    } catch (error) {
      throw new ApiError(422, 'mail_failed', error instanceof Error ? error.message : 'Sending failed')
    }
    return c.json({ ok: true, to })
  })

  // A form on the site: the message is kept, and sent by email when email is set up.
  // ---------- AI: settings, text actions and the editor's assistant ----------

  const aiSettings = async () => ({ ...EMPTY_AI, ...(await settings.get<AiSettings>('ai')) })
  const readyAi = async () => {
    const ai = await aiSettings()
    if (!isReady(ai)) throw new ApiError(400, 'ai_not_configured', 'L’AI non è configurata: Impostazioni → AI e MCP')
    return ai
  }
  const aiFailed = (error: unknown): never => {
    if (error instanceof AiError) throw new ApiError(422, 'ai_failed', error.message)
    throw error
  }
  const allowAi = createLimiter(40, 60_000)

  app.get('/api/ai', requireUser, async (c) => {
    const ai = await aiSettings()
    return c.json(c.get('user').role === 'admin' ? { ai: publicAi(ai) } : { ai: { ready: isReady(ai) } })
  })

  app.put('/api/ai', requireUser, requireSession, requireAdmin, async (c) => {
    const input = await body(
      c,
      z.object({
        ai: z.object({
          provider: z.enum(['anthropic', 'openai']),
          // Empty: keep the saved key. null: remove it.
          apiKey: z.string().max(500).nullable().optional(),
          baseUrl: z.union([z.url().max(500), z.literal('')]),
          model: z.string().trim().max(120),
        }),
      }),
    )
    const before = await aiSettings()
    const apiKey = input.ai.apiKey === null ? '' : input.ai.apiKey?.trim() || before.apiKey
    const ai: AiSettings = { ...input.ai, apiKey }
    await settings.set('ai', ai, c.get('user').id)
    return c.json({ ai: publicAi(ai) })
  })

  app.post('/api/ai/test', requireUser, requireSession, requireAdmin, async (c) => {
    const ai = await readyAi()
    const reply = await complete(ai, { system: 'Answer with one short word.', prompt: 'Say: ok' }).catch(aiFailed)
    return c.json({ ok: true, reply })
  })

  const TEXT_ACTIONS: Record<string, string> = {
    rewrite: 'Rewrite it so it reads better: same meaning, similar length.',
    shorten: 'Make it shorter, keeping what matters.',
    expand: 'Make it a little longer and richer, without inventing facts.',
    fix: 'Fix spelling, grammar and punctuation only; change nothing else.',
    formal: 'Make the tone more formal and professional.',
    friendly: 'Make the tone warmer and more conversational.',
    seo_title: 'Write a page title for search engines, at most 60 characters, from this page content.',
    seo_description:
      'Write a meta description for search engines, 120 to 160 characters, from this page content: what the page offers, with a reason to click.',
  }

  app.post('/api/ai/text', requireUser, async (c) => {
    const input = await body(
      c,
      z.object({
        action: z.enum(['translate', 'custom', 'alt', ...Object.keys(TEXT_ACTIONS)]),
        text: z.string().max(40_000).default(''),
        /** translate: the language to translate into. custom: what to do. */
        instruction: z.string().trim().max(500).optional(),
        /** alt: the picture (an address in the media library). */
        src: z.string().max(1000).optional(),
        /** The site's language, for texts written from scratch. */
        locale: z.string().max(20).optional(),
      }),
    )
    if (!allowAi(c.get('user').id)) throw new ApiError(429, 'too_many_requests', 'Troppe richieste: aspetta un minuto')
    const ai = await readyAi()
    const lang = input.locale ?? ctx.config().locales.default
    const system = `You edit texts for a website. Reply with the resulting text only: no quotes, no preamble, no notes. Keep the language of the text${
      input.action === 'translate' ? ' unless asked to translate' : ''
    }; when writing from scratch, write in the language with code "${lang}". Keep line breaks where they make sense; never add Markdown.`
    if (input.action === 'alt') {
      const key = /^\/media\/([^/?#@]+)/.exec(input.src ?? '')?.[1]
      const file = key ? await files.open(decodeURIComponent(key), { width: 1024, format: 'jpg' }) : null
      if (!file) throw new ApiError(400, 'no_image', 'Scegli prima un’immagine della libreria')
      const data = (await readFile(file.path)).toString('base64')
      const text = await complete(ai, {
        system,
        prompt: `Write the alternative text (alt) for this image on a website, in the language with code "${lang}": one sentence, at most 125 characters, describing what matters for someone who cannot see it. No "image of".`,
        image: { data, mime: 'image/jpeg' },
      }).catch(aiFailed)
      return c.json({ text })
    }
    if (!input.text.trim()) throw new ApiError(400, 'empty_text', 'Non c’è testo su cui lavorare')
    const task =
      input.action === 'translate'
        ? `Translate it into ${input.instruction || 'English'}, naturally, as a native writer would.`
        : input.action === 'custom'
          ? (input.instruction ?? 'Improve it.')
          : TEXT_ACTIONS[input.action]
    const text = await complete(ai, { system, prompt: `${task}\n\n<text>\n${input.text}\n</text>` }).catch(aiFailed)
    return c.json({ text })
  })

  /** Conversations with the assistant, per person and chat, kept for two hours in memory. */
  const chats = new Map<string, { conv: Conversation; at: number }>()

  app.post('/api/ai/chat', requireUser, async (c) => {
    const input = await body(
      c,
      z.object({
        chatId: z.string().max(64).optional(),
        message: z.string().trim().min(1).max(8000),
        /** The page as the editor holds it (shared sections and components expanded). */
        nodes: z.array(z.record(z.string(), z.unknown())).max(400),
        page: z.object({
          title: z.string().max(300),
          collection: z.string().max(100),
          url: z.string().max(500).nullish(),
        }),
        selected: z.array(z.string().max(100)).max(50).optional(),
      }),
    )
    const user = c.get('user')
    if (!allowAi(user.id)) throw new ApiError(429, 'too_many_requests', 'Troppe richieste: aspetta un minuto')
    const ai = await readyAi()
    const now = Date.now()
    for (const [k, v] of chats) if (now - v.at > 2 * 60 * 60 * 1000) chats.delete(k)
    const chatId = input.chatId ?? crypto.randomUUID()
    const key = `${user.id}:${chatId}`
    const entry = chats.get(key)
    const conv = entry && entry.conv.provider === ai.provider ? entry.conv : { provider: ai.provider, messages: [] }
    chats.set(key, { conv, at: now })

    const before = input.nodes as unknown as PageNode[]
    const page = { nodes: before }
    const auth: Record<string, string> = {}
    const authorization = c.req.header('authorization')
    const cookie = c.req.header('cookie')
    if (authorization) auth.authorization = authorization
    else if (cookie) auth.cookie = cookie
    const tools = assistantTools(apiCaller(app.fetch, auth), page, ctx.config().site.name)
    const limited = await contentOnly(user)
    const system = `You are the assistant inside Materialize, the visual editor of the website "${ctx.config().site.name}". The person (${user.name}) is editing the page "${input.page.title}" (collection ${input.page.collection}${input.page.url ? `, address ${input.page.url}` : ''}).
Use the tools to look at the page (get_page, get_node) and change it (edit_page). Your changes go into the editor, where the person sees them at once and can undo them; they are not published.
Read the page before changing it. Make the changes asked, consistent with the design already there (theme colors and text styles, spacing, the look of nearby sections); prefer the section library for new sections. Keep ids of existing nodes.
${limited ? 'This person may change only contents (texts, links, images, alt texts), not the layout or the design: do not add, remove or move nodes, and do not change styles.\n' : ''}When done, say in one or two short sentences what you changed. Reply in the person's language. If something cannot be done with the tools, say so.
${input.selected?.length ? `Selected on the canvas: ${input.selected.join(', ')} (what "this" refers to).` : ''}`

    return streamSSE(c, async (stream) => {
      const send = (data: unknown) => stream.writeSSE({ data: JSON.stringify(data) })
      try {
        const reply = await runTurn(ai, conv, {
          system,
          text: input.message,
          tools,
          onEvent: (e) => void send(e),
        })
        chats.set(key, { conv, at: Date.now() })
        if (page.nodes !== before) {
          if (limited && !sameDesign(before, page.nodes))
            await send({
              type: 'error',
              message: 'Puoi cambiare solo i contenuti: le modifiche al layout non sono state applicate.',
            })
          else await send({ type: 'page', nodes: page.nodes })
        }
        await send({ type: 'text', text: reply })
        await send({ type: 'done', chatId })
      } catch (error) {
        if (!(error instanceof AiError)) console.error(error)
        // A failed turn leaves the conversation as it was before it.
        chats.delete(key)
        await send({ type: 'error', message: error instanceof Error ? error.message : 'Errore' })
        await send({ type: 'done', chatId })
      }
    })
  })

  app.post('/api/forms/:form', async (c) => {
    const form = c.req.param('form').slice(0, 80)
    const ip = c.req.header('x-forwarded-for')?.split(',')[0]?.trim() || c.req.header('x-real-ip') || 'local'
    if (!allowForm(`${ip}:${form}`)) throw new ApiError(429, 'too_many_attempts', 'Too many messages, wait a minute')
    const isJson = (c.req.header('content-type') ?? '').includes('application/json')
    const raw = (isJson ? await c.req.json().catch(() => ({})) : await c.req.parseBody()) as Record<string, unknown>
    const page = typeof raw._page === 'string' ? raw._page.slice(0, 300) : (c.req.header('referer') ?? '').slice(0, 300)
    // A field people never see: bots fill it in.
    const trap = typeof raw._gotcha === 'string' && raw._gotcha.length > 0
    const data: Record<string, string> = {}
    for (const [k, v] of Object.entries(raw)) {
      if (k.startsWith('_') || typeof v !== 'string' || Object.keys(data).length >= 30) continue
      data[k.slice(0, 80)] = v.slice(0, 5000)
    }
    if (!trap && Object.values(data).some((v) => v.trim())) {
      const saved = await submissions.add({ form, page, data })
      const mail = await settings.get<MailSettings>('mail')
      if (isConfigured(mail) && mail.to) {
        const replyTo = Object.entries(data).find(([k, v]) => /mail/i.test(k) && /^[^\s@]+@[^\s@]+$/.test(v))?.[1]
        sendMail(mail, {
          to: mail.to,
          subject: `Nuovo messaggio dal sito${typeof raw._subject === 'string' ? `: ${raw._subject.slice(0, 120)}` : ''}`,
          text: submissionText(page, data),
          replyTo,
        })
          .then(() => submissions.markMailed(saved.id))
          .catch((error) => console.error('Materialize: email not sent', error))
      }
    }
    // Without JavaScript the browser posted the form itself: back to the page, marked as sent.
    if (!isJson) {
      const back = (c.req.header('referer') ?? '/').split('#')[0]
      return c.redirect(`${back}#inviato`, 303)
    }
    return c.json({ ok: true })
  })

  app.get('/api/submissions', requireUser, async (c) => {
    const limit = Math.min(Number(c.req.query('limit') ?? 50), 200)
    const offset = Math.max(Number(c.req.query('offset') ?? 0), 0)
    return c.json(await submissions.list(limit, offset))
  })

  app.patch('/api/submissions/:id', requireUser, async (c) => {
    const input = await body(c, z.object({ read: z.boolean() }))
    await submissions.markRead(c.req.param('id'), input.read)
    return c.json({ ok: true })
  })

  app.delete('/api/submissions/:id', requireUser, requireAdmin, async (c) => {
    await submissions.remove(c.req.param('id'))
    return c.body(null, 204)
  })

  // Who may change what: editors limited to contents, if the admins want so.
  app.get('/api/editorial', requireUser, async (c) =>
    c.json({ editorial: (await settings.get<{ editorsContentOnly?: boolean }>('editorial')) ?? {} }),
  )

  app.put('/api/editorial', requireUser, requireSession, requireAdmin, async (c) => {
    const input = await body(c, z.object({ editorial: z.object({ editorsContentOnly: z.boolean().optional() }) }))
    await settings.set('editorial', input.editorial, c.get('user').id)
    return c.json({ editorial: input.editorial })
  })

  // Search engines: site-wide settings and redirects from old addresses.
  app.get('/api/seo', requireUser, async (c) => c.json({ seo: (await settings.get<SiteSeo>('seo')) ?? {} }))

  app.put('/api/seo', requireUser, requireAdmin, async (c) => {
    const input = await body(c, z.object({ seo: siteSeoSchema }))
    await settings.set('seo', input.seo, c.get('user').id)
    ctx.onPublish?.()
    return c.json({ seo: input.seo })
  })

  // Every address on the site: published pages and old addresses that redirect, to check links.
  app.get('/api/urls', requireUser, async (c) => {
    const urls: string[] = []
    for (const def of ctx.config().collections) {
      if (!def.url) continue
      for (const doc of await content.published(def.name)) {
        const url = doc.publishedData ? publicUrl(def, doc.locale, doc.publishedData) : null
        if (url) urls.push(url)
      }
    }
    const redirects = (await settings.get<Redirect[]>('redirects')) ?? []
    return c.json({ urls: [...new Set([...urls, ...redirects.map((r) => r.from)])] })
  })

  app.get('/api/redirects', requireUser, async (c) =>
    c.json({ redirects: (await settings.get<Redirect[]>('redirects')) ?? [] }),
  )

  app.put('/api/redirects', requireUser, requireAdmin, async (c) => {
    const input = await body(c, z.object({ redirects: z.array(redirectSchema).max(2000) }))
    const redirects = input.redirects
      .map((r) => ({ ...r, from: normalizePath(r.from), to: /^https?:\/\//.test(r.to) ? r.to : normalizePath(r.to) }))
      .filter((r, i, all) => r.from !== r.to && all.findIndex((o) => o.from === r.from) === i)
    await settings.set('redirects', redirects, c.get('user').id)
    ctx.onPublish?.()
    return c.json({ redirects })
  })

  // Template pages: a page designed on the canvas that shows each entry of a collection.
  app.get('/api/templates', requireUser, async (c) => c.json({ templates: (await settings.get('templates')) ?? {} }))

  app.put('/api/templates', requireUser, async (c) => {
    const input = await body(c, z.object({ templates: z.record(z.string(), z.string()) }))
    await settings.set('templates', input.templates, c.get('user').id)
    ctx.onPublish?.()
    return c.json({ templates: input.templates })
  })

  // Reusable components with their variants.
  app.get('/api/components', requireUser, async (c) => c.json({ components: (await settings.get('components')) ?? {} }))

  app.put('/api/components', requireUser, async (c) => {
    const input = await body(c, z.object({ components: z.record(z.string(), z.record(z.string(), z.unknown())) }))
    const before = (await settings.get('components')) ?? {}
    guardEmbeds(c.get('user'), before, input.components)
    if (JSON.stringify(before) !== JSON.stringify(input.components) && (await contentOnly(c.get('user'))))
      throw designLocked()
    await settings.set('components', input.components, c.get('user').id)
    ctx.onPublish?.()
    return c.json({ components: input.components })
  })

  // Entries with their data, for lists bound to a collection on the canvas.
  app.get('/api/collections/:name/entries', requireUser, async (c) => {
    const def = collection(c.req.param('name'))
    const { items } = await content.list(def.name, {
      locale: locale(c.req.query('locale')),
      limit: Math.min(Number(c.req.query('limit') ?? 24), 100),
    })
    const docs = await content.getMany(items.map((i) => i.id))
    const byId = new Map(docs.map((d) => [d.id, d]))
    // Readable values for the canvas: a choice's label, a related entry's title.
    const relationIds = docs.flatMap((d) =>
      Object.entries(def.fields).flatMap(([name, f]) => {
        if (f.kind !== 'relation') return []
        const v = d.data[name]
        return (Array.isArray(v) ? v : [v]).filter((x): x is string => typeof x === 'string')
      }),
    )
    const related = new Map((await content.getMany([...new Set(relationIds)])).map((d) => [d.id, d.title]))
    const labelsOf = (data: Record<string, unknown>) => {
      const labels: Record<string, string> = {}
      for (const [name, f] of Object.entries(def.fields)) {
        const v = data[name]
        if (f.kind === 'select' && typeof v === 'string') {
          const opts = (f.options as { options?: (string | { value: string; label?: string })[] }).options ?? []
          const hit = opts.find((o) => (typeof o === 'string' ? o : o.value) === v)
          if (hit && typeof hit !== 'string' && hit.label) labels[name] = hit.label
        }
        if (f.kind === 'relation') {
          const ids = (Array.isArray(v) ? v : [v]).filter((x): x is string => typeof x === 'string')
          const titles = ids.map((id) => related.get(id)).filter(Boolean)
          if (titles.length) labels[name] = titles.join(', ')
        }
      }
      return labels
    }
    const entryLocale = locale(c.req.query('locale'))
    return c.json({
      items: items.flatMap((i) => {
        const doc = byId.get(i.id)
        return doc
          ? [
              {
                id: doc.id,
                title: doc.title,
                url: def.url ? def.url(doc.data as never) : null,
                data: doc.data,
                labels: labelsOf(doc.data),
                locale: entryLocale,
              },
            ]
          : []
      }),
    })
  })

  app.get('/api/overview', requireUser, async (c) => {
    const known = new Set(ctx.config().collections.map((col) => col.name))
    const overview = await content.overview(locale(c.req.query('locale')))
    const people = new Map((await auth.listUsers()).map((u) => [u.id, u.name]))
    return c.json({
      counts: overview.counts.filter((row) => known.has(row.collection)),
      recent: overview.recent
        .filter((row) => known.has(row.collection))
        .map(({ updatedBy, ...row }) => ({ ...row, updatedBy: updatedBy ? (people.get(updatedBy) ?? null) : null })),
      media: (await mediaStore.list({ limit: 1 })).total,
    })
  })

  app.get('/api/collections/:name', requireUser, async (c) => {
    const def = collection(c.req.param('name'))
    const result = await content.list(def.name, {
      locale: locale(c.req.query('locale')),
      search: c.req.query('search') || undefined,
      limit: Number(c.req.query('limit') ?? 50),
      offset: Number(c.req.query('offset') ?? 0),
    })
    // The public address of each row (the home page is "/", not "/home"), when the slug is enough.
    const loc = locale(c.req.query('locale'))
    const urlOf = (slug: string | null) => {
      try {
        return publicUrl(def, loc, { slug })
      } catch {
        return null
      }
    }
    return c.json({ ...result, items: result.items.map((i) => ({ ...i, url: urlOf(i.slug) })) })
  })

  app.post('/api/collections/:name', requireUser, async (c) => {
    const def = collection(c.req.param('name'))
    const input = await body(c, documentBody)
    const lang = locale(input.locale)
    if (def.singleton && (await content.list(def.name, { locale: lang, limit: 1 })).total > 0) {
      throw new ApiError(409, 'singleton_exists', `"${def.label}" already exists; edit it instead`)
    }
    const draft = draftData(def, input.data)
    guardEmbeds(c.get('user'), null, draft.data)
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
    const def = collection(existing.collection)
    const draft = draftData(def, input.data)
    guardEmbeds(c.get('user'), existing.data, draft.data)
    for (const [name, f] of Object.entries(def.fields))
      if (f.kind === 'page') await guardDesign(c.get('user'), existing.data[name], draft.data[name])
    const doc = await slugGuard(() => content.update(existing.id, { ...draft, userId: c.get('user').id }))
    return c.json(toJson(doc as StoredDocument))
  })

  app.post('/api/documents/:id/publish', requireUser, async (c) => {
    const existing = await loadDocument(c.req.param('id'))
    // Validated now, not at save time: drafts may be incomplete and the schema may have changed since.
    const def = collection(existing.collection)
    const data = publishableData(def, existing.data)
    // A published page that moves keeps its old address working: a permanent redirect to the new one.
    const before = existing.publishedData ? publicUrl(def, existing.locale, existing.publishedData) : null
    const after = publicUrl(def, existing.locale, data)
    if (after) {
      // A page now living at an old address takes it back from its redirect.
      const redirects = (await settings.get<Redirect[]>('redirects')) ?? []
      const next =
        before && before !== after
          ? addMove(redirects, before, after)
          : redirects.filter((r) => normalizePath(r.from) !== normalizePath(after))
      if (next.length !== redirects.length || next.some((r, i) => r !== redirects[i]))
        await settings.set('redirects', next, c.get('user').id)
    }
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

  // An image from the web, for AI tools: downloaded by the server, checked like an upload.
  app.post('/api/media/from-url', requireUser, async (c) => {
    const input = await body(c, z.object({ url: z.url(), alt: z.string().max(500).optional() }))
    let saved: Awaited<ReturnType<typeof files.save>>
    let name: string
    try {
      const remote = await fetchPublicFile(input.url, MAX_UPLOAD)
      name = remote.name
      saved = await files.save(name, remote.bytes)
    } catch (error) {
      if (error instanceof RemoteError || error instanceof MediaError)
        throw new ApiError(422, 'invalid_file', error.message)
      throw error
    }
    const asset = await mediaStore.create({
      ...saved,
      filename: name.slice(0, 200),
      alt: input.alt ?? '',
      createdBy: c.get('user').id,
    })
    return c.json(assetJson(asset), 201)
  })

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
  // ---------- fonts: Google Fonts served from this site ----------

  app.get('/api/fonts', requireUser, async (c) => c.json({ items: await fonts.list() }))

  app.get('/fonts/:file', async (c) => {
    const id = c.req.param('file').replace(/\.css$/, '')
    if (!c.req.param('file').endsWith('.css') || !FONT_ID.test(id)) return c.text('Not found', 404)
    try {
      return c.body(await fonts.css(id), 200, {
        'content-type': 'text/css; charset=utf-8',
        'cache-control': 'public, max-age=86400',
      })
    } catch {
      return c.text('Font not available', 404)
    }
  })

  app.get('/fonts/:id/:file', async (c) => {
    const { id, file } = c.req.param()
    if (!FONT_ID.test(id) || !FONT_FILE.test(file)) return c.text('Not found', 404)
    try {
      return c.body(new Uint8Array(await fonts.file(id, file)), 200, {
        'content-type': 'font/woff2',
        'cache-control': 'public, max-age=31536000, immutable',
      })
    } catch {
      return c.text('Font not available', 404)
    }
  })

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
