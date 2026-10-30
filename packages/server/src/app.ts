import { randomBytes } from 'node:crypto'
import { constants } from 'node:fs'
import { access, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { Readable } from 'node:stream'
import { getConnInfo } from '@hono/node-server/conninfo'
import {
  type Collection,
  describeCollection,
  type MaterializeConfig,
  type Media,
  prepare,
  SLUG_PATTERN,
  slugify,
  titleOf,
  type ValidationIssue,
  validate,
} from '@materializecms/core'
import {
  documentSlots,
  isLocaleCode,
  mergeTranslation,
  nodeSlots,
  untranslatedIds,
  withLocales,
} from '@materializecms/core/i18n'
import { normalizeTheme, type PageNode, sameDesign } from '@materializecms/core/page'
import { addMove, normalizePath, type Redirect, type SiteSeo } from '@materializecms/core/seo'
import { TRACKING_PATTERNS, type TrackingSettings, trackingBlocks } from '@materializecms/core/tracking'
import {
  DEFAULT_UPDATES,
  isPatch,
  type UpdateSettings,
  type UpdateStatus,
  type Updates,
} from '@materializecms/core/updates'
import {
  type AuthStore,
  type ContentStore,
  createActivityStore,
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
import {
  AiError,
  type AiSettings,
  type Conversation,
  complete,
  EMPTY_AI,
  isReady,
  publicAi,
  runTurn,
  translateTexts,
} from './ai.ts'
import { type ArchiveEntry, folderEntries, tarGz } from './archive.ts'
import { type BackupSettings, createBackups, DEFAULT_BACKUPS } from './backups.ts'
import { createFonts, FONT_FILE, FONT_ID } from './fonts.ts'
import { isConfigured, type MailSettings, publicMail, sendMail, submissionText } from './mail.ts'
import { createMcpServer } from './mcp.ts'
import { createMediaFiles, fileBody, MAX_UPLOAD, MediaError, mediaUrl, type Output } from './media.ts'
import { hashPassword, verifyPassword } from './password.ts'
import { fetchPublicFile, RemoteError, remoteFetch } from './remote.ts'
import { statusPage } from './status-page.ts'
import { apiCaller, assistantTools } from './tools.ts'
import { newSecret, otpauthUri, recoveryCodes, verifyCode } from './totp.ts'
import { type Fetcher, readRest, readWxr, WordPressError, type WpSite } from './wordpress.ts'
import {
  fold,
  type ImportDeps,
  type ImportPlan,
  type ImportProgress,
  optionsOf,
  runImport,
  sourcesFor,
  suggest,
} from './wpimport.ts'

/** The installed version, from this package's package.json (same place in the sources and in the release). */
export const VERSION: string = createRequire(import.meta.url)('../package.json').version
const SESSION_COOKIE = 'mz_session'
const SESSION_TTL = 30 * 24 * 60 * 60 * 1000
/** A session left unused this long ends, whatever its expiry. */
const SESSION_IDLE = 14 * 24 * 60 * 60 * 1000
/** Failed sign-ins before a pause: per email (one account), and per address (one attacker, many accounts). */
const EMAIL_THRESHOLD = 5
const IP_THRESHOLD = 20
/** A password accepted, the code still to come: how long the second step may take. */
const CHALLENGE_TTL = 5 * 60 * 1000
/** Checked against when an email has no account, so both answers take as long. */
const dummyHash = hashPassword(randomBytes(16).toString('hex'))
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
const setupBody = z.object({
  email: z.email(),
  name: z.string().trim().min(1),
  password: z.string().min(10),
  /** From the link `materialize start` prints, when it set one. */
  token: z.string().optional(),
  site: z
    .object({
      name: z.string().trim().min(1).max(120).optional(),
      locale: z.string().refine(isLocaleCode, 'Codice lingua non valido').optional(),
    })
    .optional(),
})
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
  /** Updates from the panel, when whoever started the server can apply them (materialize start). */
  updates?: Updates
  /**
   * Asked by the installation in the browser before the first account exists, so whoever finds a
   * fresh server first cannot claim it: `materialize start` prints the link that carries it.
   */
  setupToken?: string
}

export function createApp(base: ServerContext) {
  // The languages chosen in Impostazioni → Lingue win over the config's; read once, then kept current.
  let languages: unknown = null
  const ctx: ServerContext = { ...base, config: () => withLocales(base.config(), languages) }
  const content: ContentStore = createContentStore(ctx.database.db)
  const auth: AuthStore = createAuthStore(ctx.database.db)
  const mediaStore = createMediaStore(ctx.database.db)
  const settings = createSettingsStore(ctx.database.db)
  const languagesLoaded = settings.get('locales').then((v) => {
    languages = v
  })
  const submissions = createSubmissionStore(ctx.database.db)
  const comments = createCommentStore(ctx.database.db)
  const activityLog = createActivityStore(ctx.database.db)
  const backups = createBackups(ctx.database, () => ctx.config().media.dir)
  const backupSettings = async (): Promise<BackupSettings> => ({
    ...DEFAULT_BACKUPS,
    ...(await settings.get<Partial<BackupSettings>>('backups')),
  })
  /** Once a day, a copy of the database, made by the server itself; old copies go. */
  const autoBackup = async () => {
    const s = await backupSettings()
    if (!s.enabled || !backups.available()) return
    const last = (await backups.list())[0]
    if (last && Date.now() - last.createdAt.getTime() < 23 * 60 * 60_000) return
    const made = await backups.create('auto')
    await backups.prune(s.keep)
    await backups.mirrorMedia()
    await activityLog.record({
      userId: null,
      userName: '',
      action: 'backup.created',
      target: made.name,
      detail: { auto: true },
      ip: null,
    })
  }
  const backupFailed = (error: unknown) => console.error('Materialize: backup not made', error)
  setTimeout(() => void autoBackup().catch(backupFailed), 60_000).unref?.()
  setInterval(() => void autoBackup().catch(backupFailed), 60 * 60_000).unref?.()

  const updateSettings = async (): Promise<UpdateSettings> => ({
    ...DEFAULT_UPDATES,
    ...(await settings.get<Partial<UpdateSettings>>('updates')),
  })
  /** A copy of the database (and of the media) right before an update. */
  const backupBeforeUpdate = async () => {
    if (!backups.available()) return
    await backups.create('prima-dell-aggiornamento')
    await backups.prune((await backupSettings()).keep)
    await backups.mirrorMedia()
  }
  /** Once a day: is there a new version? Fixes install by themselves when the admin allowed it. */
  const autoUpdate = async () => {
    if (!ctx.updates) return
    const s = await ctx.updates.check()
    if (!(await updateSettings()).auto || s.unavailable || !s.latest || !isPatch(s.latest, s.current)) return
    // Not again a version that already failed to start here, or one the admin went back from.
    if (s.last && !s.last.ok && s.last.kind === 'install' && s.last.to === s.latest) return
    if (s.last?.kind === 'rollback' && s.last.from === s.latest) return
    await ctx.updates.install(s.latest, backupBeforeUpdate)
    await activityLog.record({
      userId: null,
      userName: '',
      action: 'update.install',
      target: s.latest,
      detail: { auto: true, from: s.current },
      ip: null,
    })
  }
  const updateFailed = (error: unknown) => console.error('Materialize: update check failed', error)
  // Soon after starting, so the panel knows at once (the registry answers in a moment).
  setTimeout(() => void autoUpdate().catch(updateFailed), 15_000).unref?.()
  setInterval(() => void autoUpdate().catch(updateFailed), 24 * 60 * 60_000).unref?.()
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

  /**
   * Who is connecting: the socket's address, or the proxy's X-Forwarded-For when the config says
   * the site sits behind one (otherwise anyone could send that header and pretend).
   */
  const clientIp = (c: Context): string => {
    if (ctx.config().server.trustProxy) {
      const forwarded = c.req.header('x-forwarded-for')?.split(',')[0]?.trim() || c.req.header('x-real-ip')
      if (forwarded) return forwarded
    }
    try {
      return getConnInfo(c).remote.address ?? 'local'
    } catch {
      return 'local'
    }
  }

  /**
   * Notes what happened in the activity log (Impostazioni → Sicurezza). `who` defaults to the
   * signed-in person; a failure to write never stops the request.
   */
  const record = async (
    c: Context,
    action: string,
    target = '',
    detail: Record<string, unknown> | null = null,
    who?: { id: string; name: string } | null,
  ) => {
    const user = who === undefined ? (c.get('user') as User | undefined) : who
    try {
      await activityLog.record({
        userId: user?.id ?? null,
        userName: user?.name ?? '',
        action,
        target,
        detail,
        ip: clientIp(c),
      })
    } catch (error) {
      console.error('Materialize: activity not recorded', error)
    }
  }

  const startSession = async (c: Context, userId: string) => {
    const { token, expiresAt } = await auth.createSession(userId, SESSION_TTL, {
      userAgent: c.req.header('user-agent'),
      ip: clientIp(c),
    })
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
      if (!user.twoFactor && (await twoFactorRequired()))
        throw new ApiError(403, 'two_factor_required', 'Set up two-step verification to continue')
      c.set('user', user)
      c.set('viaToken', true)
      return next()
    }
    const token = getCookie(c, SESSION_COOKIE)
    const user = token ? await auth.userForSession(token, SESSION_IDLE) : null
    if (!user) throw new ApiError(401, 'unauthenticated', 'Sign in to continue')
    c.set('user', user)
    // When the site requires two-step verification, someone without it can only set it up.
    if (!user.twoFactor && !c.req.path.startsWith('/api/auth/') && (await twoFactorRequired()))
      throw new ApiError(403, 'two_factor_required', 'Set up two-step verification to continue')
    await next()
  }

  const twoFactorRequired = async () =>
    !!(await settings.get<{ requireTwoFactor?: boolean }>('security'))?.requireTwoFactor

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

  /** What the installation checks before it starts: each with what to do when it is not right. */
  const setupChecks = async (c: Context) => {
    const checks: { id: string; label: string; state: 'ok' | 'warn' | 'error'; detail: string }[] = []
    const node = Number(process.versions.node.split('.')[0])
    checks.push({
      id: 'node',
      label: `Node.js ${process.versions.node}`,
      state: node >= 24 ? 'ok' : 'error',
      detail: node >= 24 ? 'Versione adatta.' : 'Serve Node 24 o più recente.',
    })
    const mediaDir = resolve(ctx.config().media.dir)
    let writable = true
    try {
      await mkdir(mediaDir, { recursive: true })
      await access(mediaDir, constants.W_OK)
    } catch {
      writable = false
    }
    checks.push({
      id: 'files',
      label: 'Cartella dei file',
      state: writable ? 'ok' : 'error',
      detail: writable
        ? 'Database e immagini si possono salvare.'
        : `Il programma non può scrivere in ${mediaDir}: dagli i permessi su quella cartella.`,
    })
    checks.push({
      id: 'site',
      label: 'Sito',
      state: ctx.preview ? 'ok' : 'warn',
      detail: ctx.preview
        ? 'Il sito si genera da solo a ogni pubblicazione.'
        : 'Solo il CMS: in questa cartella non c’è un sito Astro.',
    })
    const url = new URL(c.req.url)
    const local = /^(localhost|127\.|\[::1\])/.test(url.hostname)
    const https = url.protocol === 'https:' || c.req.header('x-forwarded-proto') === 'https'
    checks.push({
      id: 'https',
      label: 'Connessione sicura',
      state: https || local ? 'ok' : 'warn',
      detail: https
        ? 'HTTPS attivo.'
        : local
          ? 'In locale non serve HTTPS.'
          : 'Senza HTTPS la password viaggia in chiaro: attivalo prima di metterlo online (guida in docs/sicurezza.md).',
    })
    const updates = await ctx.updates?.status()
    checks.push({
      id: 'updates',
      label: 'Aggiornamenti',
      state: updates && !updates.unavailable ? 'ok' : 'warn',
      detail:
        updates && !updates.unavailable
          ? 'Si installano dal pannello, con un clic.'
          : (updates?.unavailable ?? 'Si installano da terminale.'),
    })
    return checks
  }

  app.get('/api/setup', async (c) => {
    const needsSetup = (await auth.countUsers()) === 0
    if (!needsSetup) return c.json({ needsSetup })
    await languagesLoaded
    const config = ctx.config()
    const named = config.collections.find((def) => def.singleton && def.fields.siteName)
    const current = named
      ? (await content.list(named.name, { locale: config.locales.default, limit: 1 })).items[0]
      : null
    const doc = current ? await content.get(current.id) : null
    return c.json({
      needsSetup,
      needsToken: !!ctx.setupToken,
      checks: await setupChecks(c),
      site: {
        name: (doc?.data.siteName as string | undefined) || config.site.name,
        locale: config.locales.default,
      },
    })
  })

  app.post('/api/setup', async (c) => {
    const input = await body(c, setupBody)
    if ((await auth.countUsers()) > 0) throw new ApiError(409, 'already_set_up', 'An administrator already exists')
    if (ctx.setupToken && input.token !== ctx.setupToken)
      throw new ApiError(
        403,
        'setup_token',
        'Per installare serve il link stampato all’avvio del server (materialize start), con il suo codice',
      )
    // The site's language and name, before anything else is written in them.
    if (input.site?.locale && input.site.locale !== ctx.config().locales.default) {
      const value = { default: input.site.locale, available: [input.site.locale] }
      await settings.set('locales', value)
      languages = value
    }
    if (input.site?.name) await nameSite(input.site.name)
    const user = await auth.createUser({
      email: input.email,
      name: input.name,
      role: 'admin',
      passwordHash: await hashPassword(input.password),
    })
    await startSession(c, user.id)
    await record(c, 'user.setup', user.email, null, user)
    return c.json({ user }, 201)
  })

  /** The site's name lives in its settings document (a single document with a `siteName` field), published. */
  const nameSite = async (name: string) => {
    const config = ctx.config()
    const def = config.collections.find((d) => d.singleton && d.fields.siteName)
    if (!def) return
    const lang = config.locales.default
    const found = (await content.list(def.name, { locale: lang, limit: 1 })).items[0]
    const existing = found ? await content.get(found.id) : null
    const draft = draftData(def, { ...existing?.data, siteName: name })
    const doc = existing
      ? await content.update(existing.id, draft)
      : await content.create({ collection: def.name, locale: lang, ...draft })
    if (doc) await content.publish(doc.id)
    ctx.onPublish?.()
  }

  /**
   * Sign-in pauses: after repeated failures an email, or an address, waits before trying again
   * (1, 2, 4… minutes). Saved in the database, so restarting the server does not reset them.
   */
  const checkLocks = async (...keys: string[]) => {
    for (const key of keys) {
      const until = await auth.lockedUntil(key)
      if (until) {
        const minutes = Math.max(1, Math.ceil((until.getTime() - Date.now()) / 60_000))
        throw new ApiError(
          429,
          'too_many_attempts',
          `Troppi tentativi: riprova tra ${minutes === 1 ? 'un minuto' : `${minutes} minuti`}`,
        )
      }
    }
  }

  /** A failed sign-in: counted for the email and the address; the owner hears when their account pauses. */
  const signInFailed = async (email: string, ip: string, hasAccount: boolean) => {
    const byEmail = await auth.recordFailure(`email:${email}`, EMAIL_THRESHOLD)
    await auth.recordFailure(`ip:${ip}`, IP_THRESHOLD)
    if (hasAccount && byEmail.failures === EMAIL_THRESHOLD)
      await mailNotice(email, 'Tentativi di accesso non riusciti', [
        `Qualcuno ha provato ${EMAIL_THRESHOLD} volte di fila a entrare nel pannello del sito con il tuo indirizzo, senza la password giusta. Per sicurezza gli accessi con il tuo indirizzo sono in pausa per qualche minuto.`,
        'Se eri tu, aspetta e riprova. Se non eri tu, la tua password è ancora al sicuro: per più protezione attiva la verifica in due passaggi dal tuo profilo.',
      ])
  }

  /** Passwords accepted, codes still due: by ticket, in memory for a few minutes. */
  const challenges = new Map<string, { userId: string; until: number }>()
  const challenge = (userId: string) => {
    const now = Date.now()
    for (const [k, v] of challenges) if (v.until < now) challenges.delete(k)
    const ticket = randomBytes(24).toString('base64url')
    challenges.set(ticket, { userId, until: now + CHALLENGE_TTL })
    return ticket
  }

  /** Signs in, or asks for the second step when the account has two-step verification. */
  const signIn = async (c: Context, user: User, status: 200 | 201 = 200) => {
    if (user.twoFactor) return c.json({ twoFactor: true, ticket: challenge(user.id) }, 200)
    await startSession(c, user.id)
    await record(c, 'login.ok', user.email, null, user)
    return c.json({ user }, status)
  }

  app.post('/api/auth/login', async (c) => {
    const input = await body(c, credentials)
    const email = input.email.trim().toLowerCase()
    const ip = clientIp(c)
    try {
      await checkLocks(`email:${email}`, `ip:${ip}`)
    } catch (error) {
      await record(c, 'login.blocked', email, null, null)
      throw error
    }
    const found = await auth.findForLogin(email)
    // A password is checked even for an unknown email: the answer takes as long either way.
    const ok = await verifyPassword(input.password, found?.passwordHash ?? (await dummyHash))
    if (!found || !ok) {
      await signInFailed(email, ip, !!found)
      await record(c, 'login.failed', email, { known: !!found }, found ? { id: found.id, name: found.name } : null)
      throw new ApiError(401, 'invalid_credentials', 'Email or password is not correct')
    }
    await auth.clearFailures(`email:${email}`)
    const { passwordHash: _, ...user } = found
    return signIn(c, user)
  })

  /** The second step: a code from the app, or a recovery code. */
  app.post('/api/auth/login/verify', async (c) => {
    const input = await body(
      c,
      z.object({ ticket: z.string().min(1).max(100), code: z.string().trim().min(6).max(20) }),
    )
    const pending = challenges.get(input.ticket)
    if (!pending || pending.until < Date.now()) {
      challenges.delete(input.ticket)
      throw new ApiError(401, 'challenge_expired', 'Sign in again')
    }
    const key = `2fa:${pending.userId}`
    await checkLocks(key, `ip:${clientIp(c)}`)
    const state = await auth.twoFactorOf(pending.userId)
    let ok = false
    if (state?.secret) {
      const step = verifyCode(state.secret, input.code, state.lastStep)
      if (step !== null) {
        await auth.useStep(pending.userId, step)
        ok = true
      } else if (input.code.replace(/\s/g, '').length > 6) ok = await auth.useRecoveryCode(pending.userId, input.code)
    }
    if (!ok) {
      const who = await auth.getUser(pending.userId)
      await record(c, 'login.code_failed', who?.email ?? '', null, who)
      await auth.recordFailure(key, EMAIL_THRESHOLD)
      await auth.recordFailure(`ip:${clientIp(c)}`, IP_THRESHOLD)
      throw new ApiError(401, 'invalid_code', 'The code is not correct')
    }
    challenges.delete(input.ticket)
    await auth.clearFailures(key)
    const user = await auth.getUser(pending.userId)
    if (!user) throw new ApiError(401, 'unauthenticated', 'Sign in to continue')
    await startSession(c, user.id)
    await record(c, 'login.ok', user.email, { twoFactor: true }, user)
    return c.json({ user })
  })

  app.post('/api/auth/logout', async (c) => {
    const token = getCookie(c, SESSION_COOKIE)
    if (token) {
      const user = await auth.userForSession(token)
      await auth.deleteSession(token)
      if (user) await record(c, 'logout', user.email, null, user)
    }
    deleteCookie(c, SESSION_COOKIE, { path: '/' })
    return c.json({ ok: true })
  })

  app.get('/api/auth/me', requireUser, async (c) =>
    c.json({ user: c.get('user'), needsTwoFactor: !c.get('user').twoFactor && (await twoFactorRequired()) }),
  )

  // ---------- account security: two-step verification and devices ----------

  const checkPassword = async (userId: string, password: string, path = 'password') => {
    const hash = await auth.getPasswordHash(userId)
    if (!hash || !(await verifyPassword(password, hash)))
      throw new ApiError(422, 'wrong_password', 'The password is not correct', [
        { path, message: 'La password non è corretta' },
      ])
  }

  app.get('/api/auth/security', requireUser, requireSession, async (c) => {
    const user = c.get('user')
    const state = await auth.twoFactorOf(user.id)
    const current = auth.sessionId(getCookie(c, SESSION_COOKIE) ?? '')
    return c.json({
      twoFactor: { enabled: !!state?.secret, recoveryLeft: state?.recoveryLeft ?? 0 },
      required: await twoFactorRequired(),
      sessions: (await auth.listSessions(user.id)).map((s) => ({ ...s, current: s.id === current })),
    })
  })

  /** Step one: a new secret to scan; it is used only once a code confirms it. */
  app.post('/api/auth/2fa/setup', requireUser, requireSession, async (c) => {
    const user = c.get('user')
    if (user.twoFactor) throw new ApiError(409, 'two_factor_on', 'Two-step verification is already on')
    const secret = newSecret()
    await auth.setPendingSecret(user.id, secret)
    return c.json({ secret, uri: otpauthUri(secret, user.email, ctx.config().site.name) })
  })

  /** Step two: the first code turns it on; the recovery codes are shown this once. */
  app.post('/api/auth/2fa/enable', requireUser, requireSession, async (c) => {
    const input = await body(c, z.object({ code: z.string().trim().min(6).max(10) }))
    const user = c.get('user')
    const state = await auth.twoFactorOf(user.id)
    if (!state?.pending) throw new ApiError(409, 'no_setup', 'Start the setup again')
    const step = verifyCode(state.pending, input.code)
    if (step === null)
      throw new ApiError(422, 'invalid_code', 'The code is not correct', [
        { path: 'code', message: 'Il codice non è corretto' },
      ])
    const codes = recoveryCodes()
    await auth.enableTwoFactor(user.id, step, codes)
    await record(c, 'twofactor.enabled', user.email)
    return c.json({ recoveryCodes: codes })
  })

  app.post('/api/auth/2fa/disable', requireUser, requireSession, async (c) => {
    const input = await body(c, z.object({ password: z.string().min(1) }))
    if (await twoFactorRequired())
      throw new ApiError(409, 'two_factor_required', 'This site requires two-step verification')
    await checkPassword(c.get('user').id, input.password)
    await auth.disableTwoFactor(c.get('user').id)
    await record(c, 'twofactor.disabled', c.get('user').email)
    return c.json({ ok: true })
  })

  app.post('/api/auth/2fa/recovery', requireUser, requireSession, async (c) => {
    const input = await body(c, z.object({ password: z.string().min(1) }))
    await checkPassword(c.get('user').id, input.password)
    if (!c.get('user').twoFactor) throw new ApiError(409, 'two_factor_off', 'Two-step verification is off')
    const codes = recoveryCodes()
    await auth.setRecoveryCodes(c.get('user').id, codes)
    await record(c, 'twofactor.recovery', c.get('user').email)
    return c.json({ recoveryCodes: codes })
  })

  app.delete('/api/auth/sessions/:id', requireUser, requireSession, async (c) => {
    if (!(await auth.endSession(c.get('user').id, c.req.param('id'))))
      throw new ApiError(404, 'not_found', 'This device is not signed in')
    await record(c, 'session.ended', c.get('user').email)
    return c.json({ ok: true })
  })

  app.post('/api/auth/sessions/others', requireUser, requireSession, async (c) => {
    const ended = await auth.endOtherSessions(c.get('user').id, getCookie(c, SESSION_COOKIE))
    await record(c, 'session.ended_others', c.get('user').email, { ended })
    return c.json({ ended })
  })

  // The site's rules (Persone): two-step verification for everyone.
  app.get('/api/security', requireUser, requireAdmin, async (c) =>
    c.json({ requireTwoFactor: await twoFactorRequired() }),
  )

  /** Groups of the activity log, by the start of their action codes. */
  const ACTIVITY_GROUPS: Record<string, string[]> = {
    access: ['login.', 'logout', 'session.', 'twofactor.', 'token.', 'security.'],
    people: ['user.'],
    content: ['document.', 'media.', 'message.'],
    settings: ['settings.', 'backup.', 'update.'],
  }

  app.get('/api/activity', requireUser, requireAdmin, async (c) => {
    const group = c.req.query('group')
    const before = Number(c.req.query('before'))
    const items = await activityLog.list({
      prefixes: group ? ACTIVITY_GROUPS[group] : undefined,
      before: before || undefined,
      limit: 50,
    })
    return c.json({ items })
  })

  /**
   * What an administrator should look at, in order: who signs in without a second step, whether
   * warnings can reach people by email, the connection, recent failed sign-ins, old tokens.
   */
  app.get('/api/security/overview', requireUser, requireAdmin, async (c) => {
    type Check = {
      id: string
      status: 'ok' | 'warn' | 'bad' | 'info'
      title: string
      detail: string
      action?: 'people' | 'profile' | 'mail' | 'backups'
    }
    const checks: Check[] = []
    const people = await auth.listUsers()
    const required = await twoFactorRequired()
    const admins = people.filter((p) => p.role === 'admin')
    const adminsWithout = admins.filter((p) => !p.twoFactor)
    const without = people.filter((p) => !p.twoFactor)
    checks.push(
      adminsWithout.length
        ? {
            id: 'admins-2fa',
            status: 'bad',
            title:
              adminsWithout.length === 1
                ? 'Un amministratore entra con la sola password'
                : `${adminsWithout.length} amministratori entrano con la sola password`,
            detail: `${adminsWithout.map((p) => p.name).join(', ')}: chi ruba quella password controlla tutto il sito. Attivate la verifica in due passaggi dal profilo → Sicurezza.`,
            action: adminsWithout.some((p) => p.id === c.get('user').id) ? 'profile' : 'people',
          }
        : {
            id: 'admins-2fa',
            status: 'ok',
            title: 'Gli amministratori usano la verifica in due passaggi',
            detail: 'Per entrare servono password e codice dal telefono.',
          },
    )
    checks.push(
      required
        ? {
            id: 'everyone-2fa',
            status: 'ok',
            title: 'Verifica in due passaggi richiesta a tutti',
            detail: without.length
              ? `${without.length === 1 ? 'Una persona la attiverà' : `${without.length} persone la attiveranno`} al prossimo accesso.`
              : 'Tutti l’hanno attivata.',
          }
        : {
            id: 'everyone-2fa',
            status: without.length ? 'warn' : 'ok',
            title: without.length
              ? `${without.length === 1 ? 'Una persona entra' : `${without.length} persone entrano`} con la sola password`
              : 'Tutti usano la verifica in due passaggi',
            detail: without.length
              ? 'Potete richiederla a tutti da Persone: chi non l’ha la attiverà al prossimo accesso.'
              : 'Potete anche richiederla a tutti da Persone, per chi entrerà in futuro.',
            action: without.length ? 'people' : undefined,
          },
    )
    const mail = isConfigured(await settings.get<MailSettings>('mail'))
    checks.push(
      mail
        ? {
            id: 'mail',
            status: 'ok',
            title: 'Gli avvisi arrivano per email',
            detail:
              'Tentativi di accesso falliti, cambi di indirizzo e di verifica vengono segnalati a chi riguardano.',
          }
        : {
            id: 'mail',
            status: 'warn',
            title: 'L’invio delle email non è configurato',
            detail:
              'Nessuno viene avvisato di tentativi di accesso falliti o di un indirizzo cambiato, e i link per una nuova password vanno mandati a mano.',
            action: 'mail',
          },
    )
    const url = new URL(c.req.url)
    const local = /^(localhost|127\.|\[::1\])/.test(url.hostname)
    const secure =
      url.protocol === 'https:' ||
      c.req.header('x-forwarded-proto') === 'https' ||
      !!ctx.config().site.url?.startsWith('https:')
    checks.push(
      local
        ? {
            id: 'https',
            status: 'info',
            title: 'Pannello aperto in locale',
            detail: 'Online, il sito va servito in HTTPS: password e sessioni viaggiano cifrate.',
          }
        : secure
          ? {
              id: 'https',
              status: 'ok',
              title: 'Connessione cifrata (HTTPS)',
              detail: 'Password e sessioni viaggiano cifrate.',
            }
          : {
              id: 'https',
              status: 'bad',
              title: 'Il pannello non usa HTTPS',
              detail:
                'Password e sessioni viaggiano in chiaro: attiva HTTPS sull’hosting (Let’s Encrypt è gratuito) o metti il sito dietro Cloudflare.',
            },
    )
    const forwarded = !!c.req.header('x-forwarded-for')
    const trust = ctx.config().server.trustProxy
    if (forwarded && !trust)
      checks.push({
        id: 'proxy',
        status: 'warn',
        title: 'Il sito è dietro un proxy, ma non lo sa',
        detail:
          'Tutte le richieste sembrano arrivare dallo stesso indirizzo, quindi i limiti agli accessi per indirizzo non funzionano. Imposta server: { trustProxy: true } in materialize.config.ts.',
      })
    else if (trust && !forwarded && !local)
      checks.push({
        id: 'proxy',
        status: 'warn',
        title: 'trustProxy è acceso, ma non arriva nessun proxy',
        detail:
          'Senza un proxy davanti, chiunque può dichiarare un indirizzo falso e aggirare i limiti agli accessi. Se il sito non è dietro un proxy, spegnilo in materialize.config.ts.',
      })
    const day = new Date(Date.now() - 24 * 60 * 60_000)
    const failed =
      (await activityLog.countSince('login.failed', day)) + (await activityLog.countSince('login.code_failed', day))
    const locked = await activityLog.lockedKeys()
    checks.push({
      id: 'failed',
      status: failed >= 20 || locked.length ? 'warn' : 'ok',
      title: failed
        ? `${failed === 1 ? 'Un accesso fallito' : `${failed} accessi falliti`} nelle ultime 24 ore`
        : 'Nessun accesso fallito nelle ultime 24 ore',
      detail: locked.length
        ? `In pausa adesso: ${locked
            .map((k) =>
              k
                .replace(/^email:/, '')
                .replace(/^ip:/, 'indirizzo ')
                .replace(/^2fa:.*/, 'un codice di verifica'),
            )
            .join(', ')}. Le pause finiscono da sole.`
        : 'Dopo 5 errori un’email va in pausa, dopo 20 un indirizzo: la pausa raddoppia a ogni nuovo errore.',
    })
    if (!backups.available())
      checks.push({
        id: 'backups',
        status: 'info',
        title: 'Database ospitato da un fornitore',
        detail:
          'I backup del database li fa il fornitore (Turso, libSQL): controlla che siano attivi nel suo pannello.',
      })
    else {
      const b = await backupSettings()
      const last = (await backups.list())[0]
      const age = last ? Date.now() - last.createdAt.getTime() : Number.POSITIVE_INFINITY
      checks.push(
        !b.enabled
          ? {
              id: 'backups',
              status: 'warn',
              title: 'Backup automatici spenti',
              detail: last
                ? `L’ultima copia è di ${Math.round(age / 86_400_000)} giorni fa. Riaccendili qui sotto.`
                : 'Non c’è nessuna copia del database. Riaccendili qui sotto.',
              action: 'backups',
            }
          : age > 2 * 86_400_000
            ? {
                id: 'backups',
                status: last ? 'warn' : 'info',
                title: last ? 'L’ultimo backup è vecchio' : 'Il primo backup arriva a breve',
                detail: last
                  ? 'Il server fa una copia al giorno mentre è acceso: se resta spento a lungo, scaricane una a mano.'
                  : 'Il server fa una copia del database poco dopo l’avvio, poi una al giorno.',
                action: 'backups',
              }
            : {
                id: 'backups',
                status: 'ok',
                title: 'Backup del database ogni giorno',
                detail: `Ultima copia ${new Intl.RelativeTimeFormat('it', { numeric: 'auto' }).format(-Math.round(age / 3_600_000), 'hour')}, immagini comprese; ne restano ${b.keep}. Per una copia fuori dal server, scarica l’archivio completo.`,
              },
      )
    }
    const tokens = await activityLog.tokens()
    const stale = tokens.filter((t) => Date.now() - (t.lastUsedAt ?? t.createdAt).getTime() > 90 * 24 * 60 * 60_000)
    if (tokens.length)
      checks.push({
        id: 'tokens',
        status: stale.length ? 'warn' : 'ok',
        title: `${tokens.length === 1 ? 'Un token di accesso' : `${tokens.length} token di accesso`} per i client AI`,
        detail: stale.length
          ? `${stale.length === 1 ? 'Uno non è usato' : `${stale.length} non sono usati`} da più di 90 giorni: chi li ha creati può revocarli da Impostazioni → AI e MCP.`
          : 'Tutti usati di recente. Ognuno può revocare i propri da Impostazioni → AI e MCP.',
      })
    return c.json({ checks })
  })

  // ---------- backups ----------

  const backupState = async () => ({
    ...(await backupSettings()),
    available: backups.available(),
    items: await backups.list(),
    media: await backups.mediaCopy(),
  })

  app.get('/api/backups', requireUser, requireSession, requireAdmin, async (c) => c.json(await backupState()))

  /**
   * Everything in one .tar.gz: a fresh copy of the database, the original media and the fonts,
   * written as it is downloaded. Works with a hosted database too, for the media.
   */
  app.get('/api/backups/archive', requireUser, requireSession, requireAdmin, async (c) => {
    const work = await mkdtemp(join(tmpdir(), 'materialize-archive-'))
    const entries: ArchiveEntry[] = []
    if (backups.available()) {
      const db = join(work, 'content.db')
      await ctx.database.client.execute({ sql: 'VACUUM INTO ?', args: [db] })
      entries.push({ name: 'content.db', path: db })
    }
    const mediaDir = resolve(ctx.config().media.dir)
    entries.push(...(await folderEntries(mediaDir, 'media')))
    entries.push(...(await folderEntries(join(dirname(mediaDir), 'fonts'), 'fonts')))
    const manifest = join(work, 'materialize.json')
    await writeFile(
      manifest,
      JSON.stringify(
        {
          site: ctx.config().site.name,
          version: VERSION,
          createdAt: new Date().toISOString(),
          database: backups.available(),
        },
        null,
        2,
      ),
    )
    entries.unshift({ name: 'materialize.json', path: manifest })
    const stream = tarGz(entries)
    stream.on('close', () => void rm(work, { recursive: true, force: true }))
    stream.on('error', (error) => {
      console.error('Materialize: archive not completed', error)
      void rm(work, { recursive: true, force: true })
    })
    await record(c, 'backup.archive', '', { files: entries.length })
    const d = new Date()
    const day = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    return c.body(Readable.toWeb(stream) as ReadableStream, 200, {
      'content-type': 'application/gzip',
      'content-disposition': `attachment; filename="materialize-${day}.tar.gz"`,
    })
  })

  app.put('/api/backups', requireUser, requireSession, requireAdmin, async (c) => {
    const input = await body(c, z.object({ enabled: z.boolean(), keep: z.number().int().min(1).max(365) }))
    await settings.set('backups', input, c.get('user').id)
    await record(c, 'settings.backups', '', input)
    return c.json(await backupState())
  })

  app.post('/api/backups', requireUser, requireSession, requireAdmin, async (c) => {
    if (!backups.available())
      throw new ApiError(409, 'backups_unavailable', 'The database is hosted: its provider keeps the backups')
    const made = await backups.create()
    await backups.prune((await backupSettings()).keep)
    await backups.mirrorMedia()
    await record(c, 'backup.created', made.name)
    return c.json({ backup: made }, 201)
  })

  app.get('/api/backups/:name', requireUser, requireSession, requireAdmin, async (c) => {
    const path = await backups.path(c.req.param('name'))
    if (!path) throw new ApiError(404, 'not_found', 'There is no such backup')
    await record(c, 'backup.downloaded', c.req.param('name'))
    return c.body(await readFile(path), 200, {
      'content-type': 'application/vnd.sqlite3',
      'content-disposition': `attachment; filename="${c.req.param('name')}"`,
    })
  })

  app.delete('/api/backups/:name', requireUser, requireSession, requireAdmin, async (c) => {
    if (!(await backups.remove(c.req.param('name')))) throw new ApiError(404, 'not_found', 'There is no such backup')
    await record(c, 'backup.deleted', c.req.param('name'))
    return c.json({ ok: true })
  })

  // ---------- updates ----------

  const updateState = async () => {
    const status: UpdateStatus = ctx.updates
      ? await ctx.updates.status()
      : {
          current: VERSION,
          latest: null,
          notes: [],
          checkedAt: null,
          unavailable: 'Questo server non è avviato da materialize start: aggiorna da terminale.',
          previous: null,
          job: { state: 'idle' },
          last: null,
        }
    return { ...status, settings: await updateSettings() }
  }

  app.get('/api/updates', requireUser, requireSession, requireAdmin, async (c) => c.json(await updateState()))

  app.post('/api/updates/check', requireUser, requireSession, requireAdmin, async (c) => {
    await ctx.updates?.check()
    return c.json(await updateState())
  })

  app.post('/api/updates/install', requireUser, requireSession, requireAdmin, async (c) => {
    const input = await body(c, z.object({ version: z.string().regex(/^\d+\.\d+\.\d+$/) }))
    if (!ctx.updates)
      throw new ApiError(409, 'updates_unavailable', 'Gli aggiornamenti dal pannello non sono disponibili qui')
    try {
      await ctx.updates.install(input.version, backupBeforeUpdate)
    } catch (error) {
      throw new ApiError(409, 'update_refused', (error as Error).message)
    }
    await record(c, 'update.install', input.version, { from: VERSION })
    return c.json(await updateState(), 202)
  })

  app.post('/api/updates/rollback', requireUser, requireSession, requireAdmin, async (c) => {
    if (!ctx.updates)
      throw new ApiError(409, 'updates_unavailable', 'Gli aggiornamenti dal pannello non sono disponibili qui')
    try {
      await ctx.updates.rollback()
    } catch (error) {
      throw new ApiError(409, 'update_refused', (error as Error).message)
    }
    await record(c, 'update.rollback', (await ctx.updates.status()).previous ?? '', { from: VERSION })
    return c.json(await updateState(), 202)
  })

  app.put('/api/updates/settings', requireUser, requireSession, requireAdmin, async (c) => {
    const input = await body(c, z.object({ auto: z.boolean() }))
    await settings.set('updates', input, c.get('user').id)
    await record(c, 'settings.updates', input.auto ? 'auto' : 'manual')
    return c.json(await updateState())
  })

  app.put('/api/security', requireUser, requireSession, requireAdmin, async (c) => {
    const input = await body(c, z.object({ requireTwoFactor: z.boolean() }))
    if (input.requireTwoFactor && !c.get('user').twoFactor)
      throw new ApiError(409, 'two_factor_off', 'Turn on two-step verification for yourself first')
    await settings.set('security', input, c.get('user').id)
    await record(c, input.requireTwoFactor ? 'security.require_2fa' : 'security.optional_2fa')
    return c.json(input)
  })

  // ---------- personal access tokens (MCP clients, scripts) ----------

  app.get('/api/tokens', requireUser, requireSession, async (c) =>
    c.json({ tokens: await auth.listTokens(c.get('user').id) }),
  )

  app.post('/api/tokens', requireUser, requireSession, async (c) => {
    const input = await body(c, z.object({ name: z.string().trim().min(1).max(80) }))
    const created = await auth.createToken(c.get('user').id, input.name)
    await record(c, 'token.created', input.name)
    return c.json(created, 201)
  })

  app.delete('/api/tokens/:id', requireUser, requireSession, async (c) => {
    if (!(await auth.revokeToken(c.req.param('id'), c.get('user').id)))
      throw new ApiError(404, 'not_found', 'There is no such token')
    await record(c, 'token.revoked')
    return c.json({ ok: true })
  })

  app.patch('/api/auth/me', requireUser, async (c) => {
    const input = await body(c, z.object({ name: z.string().trim().min(1).max(80) }))
    return c.json({ user: await auth.updateUser(c.get('user').id, input) })
  })

  /** A changed sign-in address: the old one is told, in case it was not its owner who changed it. */
  const emailChanged = async (before: string, after: string, by: string) => {
    await mailNotice(before, 'Il tuo indirizzo email è cambiato', [
      `${by === 'self' ? 'Hai cambiato' : `${by} ha cambiato`} l’indirizzo con cui entri nel pannello del sito: da ${before} a ${after}.`,
      'Se non te lo aspettavi, rispondi a questa email o avvisa un amministratore del sito.',
    ])
  }

  // Changing one's own email needs the password: a session left open is not enough.
  app.post('/api/auth/email', requireUser, requireSession, async (c) => {
    const input = await body(c, z.object({ email: z.email(), password: z.string().min(1) }))
    const user = c.get('user')
    const hash = await auth.getPasswordHash(user.id)
    if (!hash || !(await verifyPassword(input.password, hash))) {
      throw new ApiError(422, 'wrong_password', 'The password is not correct', [
        { path: 'password', message: 'La password non è corretta' },
      ])
    }
    try {
      const updated = await auth.updateUser(user.id, { email: input.email })
      if (updated && updated.email !== user.email) {
        await emailChanged(user.email, updated.email, 'self')
        await record(c, 'user.email', updated.email, { from: user.email })
      }
      return c.json({ user: updated })
    } catch (error) {
      if (error instanceof EmailTakenError) throw new ApiError(409, 'email_taken', error.message)
      throw error
    }
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
    await record(c, 'user.password', user.email)
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
      await record(c, 'user.invited', input.email, { role: input.role })
      return c.json({ invite, link, mailed }, 201)
    } catch (error) {
      if (error instanceof EmailTakenError) throw new ApiError(409, 'email_taken', error.message)
      throw error
    }
  })

  app.delete('/api/users/invites/:id', requireUser, requireSession, requireAdmin, async (c) => {
    if (!(await auth.revokeInvite(c.req.param('id')))) throw new ApiError(404, 'not_found', 'Invitation not found')
    await record(c, 'user.invite_revoked')
    return c.body(null, 204)
  })

  app.patch('/api/users/:id', requireUser, requireSession, requireAdmin, async (c) => {
    const target = await loadUser(c.req.param('id'))
    const input = await body(
      c,
      z.object({
        role: roleSchema.optional(),
        name: z.string().trim().min(1).max(80).optional(),
        email: z.email().optional(),
      }),
    )
    if (target.role === 'admin' && input.role === 'editor' && (await auth.countAdmins()) === 1) {
      throw new ApiError(409, 'last_admin', 'The site needs at least one administrator')
    }
    try {
      const updated = await auth.updateUser(target.id, input)
      if (updated && updated.email !== target.email) {
        await emailChanged(target.email, updated.email, c.get('user').name)
        await record(c, 'user.email', updated.email, { from: target.email })
      }
      if (updated && updated.role !== target.role) await record(c, 'user.role', updated.email, { role: updated.role })
      return c.json({ user: updated })
    } catch (error) {
      if (error instanceof EmailTakenError) throw new ApiError(409, 'email_taken', error.message)
      throw error
    }
  })

  app.delete('/api/users/:id', requireUser, requireSession, requireAdmin, async (c) => {
    const target = await loadUser(c.req.param('id'))
    if (target.id === c.get('user').id) throw new ApiError(409, 'remove_self', 'You cannot remove yourself')
    if (target.role === 'admin' && (await auth.countAdmins()) === 1) {
      throw new ApiError(409, 'last_admin', 'The site needs at least one administrator')
    }
    await auth.deleteUser(target.id)
    await record(c, 'user.removed', target.email)
    return c.body(null, 204)
  })

  /** For someone who lost their phone and their recovery codes: they sign in with the password alone. */
  app.delete('/api/users/:id/two-factor', requireUser, requireSession, requireAdmin, async (c) => {
    const target = await loadUser(c.req.param('id'))
    await auth.disableTwoFactor(target.id)
    await mailNotice(target.email, 'Verifica in due passaggi disattivata', [
      `${c.get('user').name} ha disattivato la verifica in due passaggi del tuo account: per entrare nel pannello ora basta la password.`,
      'Riattivala dal tuo profilo appena puoi. Se non te lo aspettavi, avvisa un amministratore.',
    ])
    await record(c, 'twofactor.reset', target.email)
    return c.json({ user: await auth.getUser(target.id) })
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
    await record(c, 'user.reset_link', target.email)
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
    await record(c, invite.kind === 'reset' ? 'user.password_reset' : 'user.joined', user.email, null, user)
    // A new password is not a way around the second step.
    return signIn(c, user, invite.kind === 'reset' ? 200 : 201)
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
    await record(c, 'settings.theme')
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

  /**
   * Global sections in a language: the main language's structure and design with that language's
   * words (saved apart, under "globals:<locale>").
   */
  const globalsIn = async (lang: string | undefined): Promise<Record<string, PageNode>> => {
    const main = (await settings.get<Record<string, PageNode>>('globals')) ?? {}
    if (!lang || lang === ctx.config().locales.default) return main
    const words = (await settings.get<Record<string, PageNode>>(`globals:${lang}`)) ?? {}
    return Object.fromEntries(
      Object.entries(main).map(([id, n]) => [id, words[id] ? (mergeTranslation([n], [words[id]])[0] as PageNode) : n]),
    )
  }

  app.get('/api/globals', requireUser, async (c) => {
    await languagesLoaded
    const lang = c.req.query('locale')
    return c.json({ globals: await globalsIn(lang ? locale(lang) : undefined), usage: await globalUsage() })
  })

  app.put('/api/globals', requireUser, async (c) => {
    const input = await body(
      c,
      z.object({ globals: z.record(z.string(), z.record(z.string(), z.unknown())), locale: z.string().optional() }),
    )
    await languagesLoaded
    const lang = input.locale ? locale(input.locale) : ctx.config().locales.default
    if (lang !== ctx.config().locales.default) {
      // Another language changes only the words: structure and design stay the main language's.
      const main = (await settings.get<Record<string, PageNode>>('globals')) ?? {}
      const words = Object.fromEntries(
        Object.entries(input.globals)
          .filter(([id]) => main[id])
          .map(([id, n]) => [id, n as unknown as PageNode]),
      )
      await settings.set(`globals:${lang}`, words, c.get('user').id)
      ctx.onPublish?.()
      return c.json({ globals: await globalsIn(lang) })
    }
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
  /** Sends a notice by email when email is set up; false when it is not. */
  const mailNotice = async (to: string, subject: string, lines: string[]) => {
    const mail = await settings.get<MailSettings>('mail')
    if (!isConfigured(mail)) return false
    try {
      await sendMail(mail, { to, subject, text: `${lines.join('\n\n')}\n` })
      return true
    } catch (error) {
      console.error('Materialize: email not sent', error)
      return false
    }
  }

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
    await record(c, 'settings.mail')
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
    await record(c, 'settings.ai', ai.provider)
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
    const ip = clientIp(c)
    if (!allowForm(`${ip}:${form}`))
      throw new ApiError(429, 'too_many_attempts', 'Troppi messaggi: riprova tra un minuto')
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
    await record(c, 'message.deleted')
    return c.body(null, 204)
  })

  // Who may change what: editors limited to contents, if the admins want so.
  app.get('/api/editorial', requireUser, async (c) =>
    c.json({ editorial: (await settings.get<{ editorsContentOnly?: boolean }>('editorial')) ?? {} }),
  )

  app.put('/api/editorial', requireUser, requireSession, requireAdmin, async (c) => {
    const input = await body(c, z.object({ editorial: z.object({ editorsContentOnly: z.boolean().optional() }) }))
    await settings.set('editorial', input.editorial, c.get('user').id)
    await record(c, 'settings.editorial', '', { contentOnly: !!input.editorial.editorsContentOnly })
    return c.json({ editorial: input.editorial })
  })

  // Analytics, tags and the cookie banner on the published site. Third-party code: admins only.
  app.get('/api/tracking', requireUser, requireAdmin, async (c) =>
    c.json({ tracking: (await settings.get<TrackingSettings>('tracking')) ?? {} }),
  )

  app.put('/api/tracking', requireUser, requireSession, requireAdmin, async (c) => {
    const id = (pattern: RegExp, message: string) =>
      z
        .string()
        .trim()
        .optional()
        .refine((v) => !v || pattern.test(v), message)
    const category = z.enum(['necessary', 'analytics', 'marketing'])
    const input = await body(
      c,
      z.object({
        tracking: z.object({
          ga4: id(TRACKING_PATTERNS.ga4, 'Un ID di Google Analytics 4 inizia con G-'),
          gtm: id(TRACKING_PATTERNS.gtm, 'Un ID di Tag Manager inizia con GTM-'),
          gtmCategory: category.optional(),
          metaPixel: id(TRACKING_PATTERNS.metaPixel, 'L’ID del Pixel è fatto di sole cifre'),
          plausible: id(TRACKING_PATTERNS.plausible, 'Scrivi il dominio come su Plausible, per esempio esempio.it'),
          plausibleSrc: id(/^https:\/\/[^"<>\s]+$/, 'Un indirizzo https://'),
          matomoUrl: id(/^https:\/\/[^"'<>\s]+$/, 'L’indirizzo di Matomo, con https://'),
          matomoSiteId: id(TRACKING_PATTERNS.matomoSiteId, 'Il numero del sito su Matomo'),
          custom: z
            .array(
              z.object({
                id: z.string().min(1).max(40),
                name: z.string().trim().min(1).max(80),
                place: z.enum(['head', 'body']),
                category,
                code: z
                  .string()
                  .max(20_000)
                  .refine((v) => !/<\/template/i.test(v), 'Il codice non può contenere </template>'),
              }),
            )
            .max(30)
            .optional(),
          banner: z
            .object({
              title: z.string().trim().max(120).optional(),
              text: z.string().trim().max(600).optional(),
              policyUrl: id(/^(https?:\/\/|\/)[^"<>\s]*$/, 'Un indirizzo che inizia con / o https://'),
              position: z.enum(['bottom', 'corner']).optional(),
              reopenButton: z.boolean().optional(),
            })
            .optional(),
        }),
      }),
    )
    await settings.set('tracking', input.tracking, c.get('user').id)
    ctx.onPublish?.()
    await record(c, 'settings.tracking', '', {
      services: trackingBlocks(input.tracking).map((b) => b.name),
    })
    return c.json({ tracking: input.tracking })
  })

  // Search engines: site-wide settings and redirects from old addresses.
  app.get('/api/seo', requireUser, async (c) => c.json({ seo: (await settings.get<SiteSeo>('seo')) ?? {} }))

  app.put('/api/seo', requireUser, requireAdmin, async (c) => {
    const input = await body(c, z.object({ seo: siteSeoSchema }))
    await settings.set('seo', input.seo, c.get('user').id)
    ctx.onPublish?.()
    await record(c, 'settings.seo')
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
    await record(c, 'settings.redirects', '', { count: redirects.length })
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
    await record(c, 'document.created', doc.title, { collection: def.name, id: doc.id })
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
    await record(c, 'document.published', doc.title, { collection: def.name, id: doc.id, url: after })
    return c.json(toJson(doc))
  })

  app.post('/api/documents/:id/unpublish', requireUser, async (c) => {
    const existing = await loadDocument(c.req.param('id'))
    const doc = (await content.unpublish(existing.id, c.get('user').id)) as StoredDocument
    if (existing.publishedAt) ctx.onPublish?.()
    await record(c, 'document.unpublished', doc.title, { collection: doc.collection, id: doc.id })
    return c.json(toJson(doc))
  })

  app.delete('/api/documents/:id', requireUser, requireAdmin, async (c) => {
    const existing = await loadDocument(c.req.param('id'))
    await content.remove(existing.id)
    if (existing.publishedAt) ctx.onPublish?.()
    await record(c, 'document.deleted', existing.title, { collection: existing.collection })
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
    await record(c, 'document.restored', doc.title, { collection: doc.collection, id: doc.id })
    return c.json(toJson(doc))
  })

  // ---------- languages and translations ----------

  /** How many documents each language has: removing a language hides them from the site. */
  const countsByLocale = async (): Promise<Record<string, number>> => {
    const out: Record<string, number> = {}
    for (const def of ctx.config().collections)
      for (const lang of new Set([...ctx.config().locales.available, ...base.config().locales.available]))
        out[lang] = (out[lang] ?? 0) + (await content.list(def.name, { locale: lang, limit: 1 })).total
    return out
  }

  app.get('/api/locales', requireUser, async (c) => {
    await languagesLoaded
    return c.json({ locales: ctx.config().locales, documents: await countsByLocale() })
  })

  app.put('/api/locales', requireUser, requireSession, requireAdmin, async (c) => {
    const input = await body(
      c,
      z.object({
        default: z.string().refine(isLocaleCode, 'Codice lingua non valido'),
        available: z.array(z.string().refine(isLocaleCode, 'Codice lingua non valido')).min(1).max(30),
      }),
    )
    if (!input.available.includes(input.default))
      throw new ApiError(400, 'invalid_locales', 'La lingua principale deve essere tra quelle del sito')
    const value = { default: input.default, available: [...new Set(input.available)] }
    await settings.set('locales', value, c.get('user').id)
    languages = value
    ctx.onPublish?.()
    await record(c, 'settings.languages', value.available.join(', '))
    return c.json({ locales: ctx.config().locales, documents: await countsByLocale() })
  })

  app.get('/api/documents/:id/translations', requireUser, async (c) => {
    await languagesLoaded
    const doc = await loadDocument(c.req.param('id'))
    const translations = await content.translations(doc.id)
    const have = new Set(translations.map((t) => t.locale))
    return c.json({
      translations,
      missing: ctx.config().locales.available.filter((l) => !have.has(l)),
    })
  })

  /** The texts of a document in another language, through the AI: the copy is changed in place. */
  const translateData = async (
    def: Collection,
    data: Record<string, unknown>,
    from: string,
    to: string,
    only?: (slots: ReturnType<typeof documentSlots>) => ReturnType<typeof documentSlots>,
  ) => {
    const ai = await readyAi()
    let slots = documentSlots(def.fields, data)
    if (only) slots = only(slots)
    if (!slots.length) return
    const translated = await translateTexts(
      ai,
      slots.map((s) => s.text),
      from,
      to,
    ).catch(aiFailed)
    for (const [i, slot] of slots.entries()) slot.set(translated[i] as string)
  }

  app.post('/api/documents/:id/translations', requireUser, async (c) => {
    const input = await body(c, z.object({ locale: z.string(), translate: z.boolean().default(false) }))
    await languagesLoaded
    const doc = await loadDocument(c.req.param('id'))
    const def = collection(doc.collection)
    const lang = locale(input.locale)
    const group = await content.translations(doc.id)
    if (group.some((t) => t.locale === lang))
      throw new ApiError(409, 'translation_exists', 'Questa lingua esiste già: aprila dall’elenco delle lingue')
    if (def.singleton && (await content.list(def.name, { locale: lang, limit: 1 })).total > 0)
      throw new ApiError(409, 'singleton_exists', `"${def.label}" esiste già in questa lingua`)
    if (input.translate && !allowAi(c.get('user').id))
      throw new ApiError(429, 'too_many_requests', 'Troppe richieste: aspetta un minuto')
    const data = structuredClone(doc.data)
    if (input.translate) {
      // The address is translated too ("chi-siamo" → "about-us"), the home page keeps its own.
      const slugField = def.slugField
      const slug = slugField && typeof data[slugField] === 'string' ? (data[slugField] as string) : ''
      const home = !slug || def.url?.({ ...data } as never) === '/'
      await translateData(def, data, doc.locale, lang)
      if (slugField && !home) {
        const [title] = await translateTexts(await readyAi(), [slug.replace(/-/g, ' ')], doc.locale, lang).catch(
          aiFailed,
        )
        const next = slugify(title ?? '')
        if (next) data[slugField] = next
      }
    }
    const draft = draftData(def, data)
    const original = group.find((t) => !t.sourceId) ?? group[0]
    const created = await slugGuard(() =>
      content.create({
        collection: def.name,
        locale: lang,
        ...draft,
        userId: c.get('user').id,
        sourceId: original?.id ?? doc.id,
      }),
    )
    await record(c, 'document.translated', created.title, { locale: lang, id: created.id, ai: input.translate })
    return c.json(toJson(created), 201)
  })

  /**
   * Brings a translation in line with its original: the original's structure and design, with the
   * words already translated; new elements come in the original's words, or translated by the AI.
   */
  app.post('/api/documents/:id/sync', requireUser, async (c) => {
    const input = await body(c, z.object({ translate: z.boolean().default(false) }))
    const doc = await loadDocument(c.req.param('id'))
    if (!doc.sourceId) throw new ApiError(400, 'not_a_translation', 'Questa è la versione originale')
    const original = await loadDocument(doc.sourceId)
    const def = collection(doc.collection)
    const data = structuredClone(doc.data)
    const fresh = new Set<string>()
    for (const [name, f] of Object.entries(def.fields)) {
      if (f.kind !== 'page') continue
      const from = Array.isArray(original.data[name]) ? (original.data[name] as PageNode[]) : []
      const mine = Array.isArray(data[name]) ? (data[name] as PageNode[]) : []
      for (const id of untranslatedIds(from, mine)) fresh.add(id)
      data[name] = mergeTranslation(from, mine)
    }
    if (input.translate && fresh.size) {
      if (!allowAi(c.get('user').id))
        throw new ApiError(429, 'too_many_requests', 'Troppe richieste: aspetta un minuto')
      const ai = await readyAi()
      for (const [name, f] of Object.entries(def.fields)) {
        if (f.kind !== 'page' || !Array.isArray(data[name])) continue
        const walk = (list: PageNode[]): PageNode[] =>
          list.flatMap((n) => (fresh.has(n.id) ? [n] : walk(n.children ?? [])))
        // Only the new elements' own texts: children of a new element are new too.
        const own = nodeSlots(walk(data[name] as PageNode[]))
        if (!own.length) continue
        const translated = await translateTexts(
          ai,
          own.map((s) => s.text),
          original.locale,
          doc.locale,
        ).catch(aiFailed)
        for (const [i, slot] of own.entries()) slot.set(translated[i] as string)
      }
    }
    for (const [name, f] of Object.entries(def.fields))
      if (f.kind === 'page') await guardDesign(c.get('user'), doc.data[name], data[name])
    const draft = draftData(def, data)
    const saved = await slugGuard(() => content.update(doc.id, { ...draft, userId: c.get('user').id }))
    return c.json({ document: toJson(saved as StoredDocument), added: fresh.size })
  })

  // ---------- importing a WordPress site ----------

  /** Some hosts turn away requests that do not say who they are. */
  const IMPORT_AGENT = `Mozilla/5.0 (compatible; Materialize/${VERSION}; WordPress import)`
  /** Sites read and waiting for their import plan, by token, for half an hour. */
  const wpSites = new Map<string, { site: WpSite; at: number }>()
  const wpJobs = new Map<string, ImportProgress & { at: number }>()
  const forget = () => {
    const now = Date.now()
    for (const [k, v] of wpSites) if (now - v.at > 30 * 60_000) wpSites.delete(k)
    for (const [k, v] of wpJobs) if (now - v.at > 6 * 60 * 60_000) wpJobs.delete(k)
  }

  /** A WordPress site is read from its address (REST API) or from its export file. */
  app.post('/api/import/wordpress/analyze', requireUser, requireSession, requireAdmin, async (c) => {
    forget()
    const isForm = (c.req.header('content-type') ?? '').includes('multipart/form-data')
    let site: WpSite
    try {
      if (isForm) {
        const form = await c.req.parseBody()
        const file = form.file
        if (!(file instanceof File)) throw new ApiError(400, 'missing_file', 'Send the export file in the "file" field')
        site = readWxr(await file.text())
      } else {
        const input = await body(
          c,
          z.object({
            url: z.url(),
            user: z.string().trim().max(200).optional(),
            password: z.string().trim().max(200).optional(),
            limit: z.number().int().min(1).max(10_000).optional(),
          }),
        )
        // An application password (WordPress → Utenti → Profilo): drafts and private pages too.
        const headers: Record<string, string> = { accept: 'application/json', 'user-agent': IMPORT_AGENT }
        if (input.user && input.password)
          headers.authorization = `Basic ${Buffer.from(`${input.user}:${input.password.replace(/\s+/g, '')}`).toString('base64')}`
        const fetcher: Fetcher = async (url) => {
          const res = await remoteFetch(url, { max: 50 * 1024 * 1024, headers, allowPrivate: true, timeout: 30_000 })
          return { status: res.status, headers: res.headers, text: res.bytes.toString('utf8') }
        }
        site = await readRest(input.url, fetcher, { limit: input.limit })
      }
    } catch (error) {
      if (error instanceof WordPressError) throw new ApiError(422, 'wordpress_unreadable', error.message)
      if (error instanceof RemoteError)
        throw new ApiError(422, 'wordpress_unreadable', `Il sito non risponde: ${error.message}`)
      throw error
    }
    const token = randomBytes(16).toString('hex')
    wpSites.set(token, { site, at: Date.now() })
    const collections = ctx.config().collections
    const count = (kind: 'post' | 'page') => site.items.filter((i) => i.kind === kind)
    return c.json({
      token,
      site: { name: site.name, url: site.url },
      counts: {
        posts: count('post').length,
        pages: count('page').length,
        drafts: site.items.filter((i) => i.status !== 'publish').length,
      },
      samples: {
        posts: count('post')
          .slice(0, 5)
          .map((i) => i.title),
        pages: count('page')
          .slice(0, 5)
          .map((i) => i.title),
      },
      categories: [...new Set(site.items.flatMap((i) => i.categories))].sort(),
      suggestions: { posts: suggest(collections, 'post'), pages: suggest(collections, 'page') },
      // For each collection, which sources each field can take, and the choices of choice fields.
      fields: Object.fromEntries(
        collections
          .filter((def) => !def.singleton)
          .map((def) => [
            def.name,
            Object.fromEntries(
              Object.entries(def.fields)
                .filter(([, f]) => sourcesFor(f).length)
                .map(([name, f]) => [
                  name,
                  {
                    label: f.label ?? name,
                    kind: f.kind,
                    sources: sourcesFor(f),
                    options: f.kind === 'select' ? optionsOf(f) : undefined,
                  },
                ]),
            ),
          ]),
      ),
    })
  })

  app.post('/api/import/wordpress/run', requireUser, requireSession, requireAdmin, async (c) => {
    const target = z.object({ collection: z.string(), fields: z.record(z.string(), z.string()) }).nullable()
    const input = await body(
      c,
      z.object({
        token: z.string(),
        plan: z.object({
          posts: target,
          pages: target,
          publish: z.boolean(),
          redirects: z.boolean(),
          locale: z.string().optional(),
          categories: z.record(z.string(), z.string()).optional(),
          fallbackCategory: z.string().optional(),
        }),
      }),
    )
    const held = wpSites.get(input.token)
    if (!held) throw new ApiError(409, 'import_expired', 'Read the site again')
    const lang = locale(input.plan.locale)
    const plan = { ...input.plan, locale: lang } as ImportPlan
    for (const t of [plan.posts, plan.pages]) if (t) collection(t.collection)
    const user = c.get('user')
    const id = randomBytes(8).toString('hex')
    const job: ImportProgress & { at: number } = {
      phase: 'media',
      done: 0,
      total: 0,
      created: [],
      skipped: [],
      problems: [],
      media: { downloaded: 0, failed: 0, reasons: {} },
      redirects: 0,
      at: Date.now(),
    }
    wpJobs.set(id, job)
    const known = (await settings.get<Record<string, Media>>('imports:media')) ?? {}
    const deps: ImportDeps = {
      collections: ctx.config().collections,
      saveImage: async (url, alt) => {
        if (known[url]) return { ...known[url], alt: alt || known[url].alt }
        let res: Awaited<ReturnType<typeof remoteFetch>>
        try {
          res = await remoteFetch(url, {
            max: MAX_UPLOAD,
            allowPrivate: true,
            timeout: 30_000,
            headers: { 'user-agent': IMPORT_AGENT },
          })
        } catch (error) {
          return {
            error:
              error instanceof RemoteError && /too large/.test(error.message)
                ? 'troppo grandi (oltre 25 MB)'
                : 'non raggiungibili',
          }
        }
        if (res.status !== 200) return { error: `non trovate sul sito (${res.status})` }
        if (/svg/.test(res.type) || /\.svg$/i.test(res.name))
          return { error: 'SVG: la libreria non li accetta, perché possono contenere codice' }
        try {
          const saved = await files.save(res.name, res.bytes)
          const asset = await mediaStore.create({ ...saved, filename: res.name.slice(0, 200), alt, createdBy: user.id })
          const media: Media = {
            src: mediaUrl(asset),
            alt,
            ...(asset.width ? { width: asset.width } : {}),
            ...(asset.height ? { height: asset.height } : {}),
          }
          known[url] = media
          return media
        } catch {
          return { error: 'in un formato che la libreria non legge' }
        }
      },
      fetchPage: async (url) => {
        try {
          const res = await remoteFetch(url, {
            max: 20 * 1024 * 1024,
            allowPrivate: true,
            timeout: 30_000,
            headers: { 'user-agent': IMPORT_AGENT, accept: 'text/html' },
          })
          return res.status === 200 ? res.bytes.toString('utf8') : null
        } catch {
          return null
        }
      },
      exists: async (name, slug) => !!(await content.getBySlug(name, slug, lang)),
      titles: async (name) => {
        const { items } = await content.list(name, { locale: lang, limit: 200 })
        return new Map(items.map((d) => [fold(d.title), d.id]))
      },
      create: async (def, data) => {
        const draft = draftData(def, data)
        const doc = await slugGuard(() =>
          content.create({ collection: def.name, locale: lang, ...draft, userId: user.id }),
        )
        return { id: doc.id, title: doc.title, url: publicUrl(def, lang, doc.data) }
      },
      publish: async (docId) => {
        const doc = await loadDocument(docId)
        await content.publish(doc.id, user.id, publishableData(collection(doc.collection), doc.data))
      },
      urlOf: (def, data) => {
        try {
          return publicUrl(def, lang, data)
        } catch {
          return null
        }
      },
      addRedirects: async (moves) => {
        let list = (await settings.get<Redirect[]>('redirects')) ?? []
        const before = list.length
        for (const m of moves) list = addMove(list, m.from, m.to)
        await settings.set('redirects', list, user.id)
        return list.length - before
      },
      onProgress: (p) => Object.assign(job, p),
    }
    void runImport(held.site, plan, deps)
      .then(async (result) => {
        await settings.set('imports:media', known, user.id)
        if (result.created.some((d) => d.published) || result.redirects) ctx.onPublish?.()
        await activityLog.record({
          userId: user.id,
          userName: user.name,
          action: 'import.wordpress',
          target: held.site.name,
          detail: { created: result.created.length, media: result.media.downloaded, redirects: result.redirects },
          ip: null,
        })
      })
      .catch((error) => {
        console.error('Materialize: import failed', error)
        Object.assign(job, { phase: 'failed', error: (error as Error).message })
      })
    return c.json({ job: id }, 202)
  })

  app.get('/api/import/jobs/:id', requireUser, requireAdmin, (c) => {
    const job = wpJobs.get(c.req.param('id'))
    if (!job) throw new ApiError(404, 'not_found', 'There is no such import')
    const { at: _, ...progress } = job
    return c.json(progress)
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
      await record(c, 'media.uploaded', asset.filename)
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
    await record(c, 'media.uploaded', asset.filename, { from: input.url })
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
    await record(c, 'media.deleted', asset.filename)
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
