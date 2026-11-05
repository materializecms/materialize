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
import { senderDomain } from '@materializecms/core/mail'
import {
  type Component,
  expandComponents,
  expandGlobals,
  type FormDefinition,
  formDefinition,
  normalizeTheme,
  type PageNode,
  sameDesign,
  walk,
} from '@materializecms/core/page'
import { addMove, normalizePath, type Redirect, type SiteSeo } from '@materializecms/core/seo'
import { TRACKING_PATTERNS, type TrackingSettings, trackingBlocks } from '@materializecms/core/tracking'
import {
  DEFAULT_UPDATES,
  isPatch,
  type UpdateSettings,
  type UpdateStatus,
  type Updates,
} from '@materializecms/core/updates'
import { type BrandVoice, VOICE_TONES, voicePrompt } from '@materializecms/core/voice'
import {
  type AuthStore,
  type ContentStore,
  createActivityStore,
  createAuthStore,
  createCommentStore,
  createContentStore,
  createMediaStore,
  createPreviewLinkStore,
  createReleaseStore,
  createScheduleStore,
  createSettingsStore,
  createSubmissionStore,
  type Database,
  EmailTakenError,
  type MediaAsset,
  type PreviewLink,
  type Release,
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
  type AiUsage,
  type Conversation,
  complete,
  EMPTY_AI,
  isReady,
  languageName,
  publicAi,
  runTurn,
  translateTexts,
} from './ai.ts'
import { type ArchiveEntry, folderEntries, tarGz } from './archive.ts'
import { type BackupSettings, createBackups, DEFAULT_BACKUPS } from './backups.ts'
import { type BriefResult, briefSystem, briefTools, plain } from './brief.ts'
import { createFonts, FONT_FILE, FONT_ID } from './fonts.ts'
import {
  type FormsSettings,
  fingerprintOf,
  readSubmission,
  removeFiles,
  saveFiles,
  sendWebhook,
  spamReason,
} from './forms.ts'
import {
  checkSenderDomain,
  explainMailError,
  isConfigured,
  type MailSettings,
  publicMail,
  sendMail,
  submissionText,
} from './mail.ts'
import { createMcpServer } from './mcp.ts'
import { createMediaFiles, fileBody, MAX_UPLOAD, MediaError, mediaUrl, type Output } from './media.ts'
import {
  DEFAULT_OFFSITE,
  newRecoveryKey,
  type OffsiteSettings,
  type OffsiteStatus,
  runOffsite,
  testOffsite,
} from './offsite.ts'
import { hashPassword, verifyPassword } from './password.ts'
import { fetchPublicFile, RemoteError, remoteFetch } from './remote.ts'
import { statusPage } from './status-page.ts'
import { apiCaller, assistantTools, contentTools, pageTools, type SiteSchema } from './tools.ts'
import { newSecret, otpauthUri, recoveryCodes, verifyCode } from './totp.ts'
import { type Fetcher, readRest, readWxr, WordPressError, type WpSite } from './wordpress.ts'
import {
  fold,
  type ImportDeps,
  type ImportPlan,
  type ImportProgress,
  optionsOf,
  relayoutProblem,
  restoreAlts,
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
/** A link asked for from the sign-in page: shorter, since nobody vouched for the request. */
const FORGOT_TTL = 60 * 60 * 1000
/** Links asked for per email, and per address, before a pause: no one is flooded with emails. */
const FORGOT_THRESHOLD = 3
const FORGOT_IP_THRESHOLD = 10
/** Where people open their one-time link: the admin's welcome screen. */
const linkPath = (token: string) => `/admin/_invite/${token}`

/** `viaToken`: signed in with a personal access token (an MCP client, a script) instead of the panel's cookie. */
type Env = { Variables: { user: User; viaToken?: boolean } }

/**
 * The custom code blocks in a document (it runs on the public site) and where its forms send
 * their messages: only admins may change them.
 */
function embedsOf(value: unknown, out: string[] = []): string[] {
  if (Array.isArray(value)) for (const v of value) embedsOf(v, out)
  else if (value && typeof value === 'object') {
    const node = value as Record<string, unknown>
    if (node.type === 'embed' && typeof node.id === 'string') out.push(`${node.id}:${String(node.html ?? '')}`)
    // Where a form's messages go: someone who only edits pages must not divert them.
    const form = node.form as { to?: string; webhook?: string } | null | undefined
    if (form && typeof node.id === 'string' && (form.to || form.webhook))
      out.push(`form:${node.id}:${form.to ?? ''}:${form.webhook ?? ''}`)
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
  llms: z.boolean().optional(),
  feed: z.array(z.string().max(80)).max(50).optional(),
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
  const schedules = createScheduleStore(ctx.database.db)
  const releases = createReleaseStore(ctx.database.db)
  const previewLinks = createPreviewLinkStore(ctx.database.db)
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

  // ---------- the copy outside the server (S3, WebDAV) ----------

  const offsiteSettings = async (): Promise<OffsiteSettings> => ({
    ...DEFAULT_OFFSITE,
    ...(await settings.get<Partial<OffsiteSettings>>('offsite')),
  })
  let offsiteRunning = false
  /** One run; the outcome is kept, and administrators hear by email the first time it fails. */
  const offsiteRun = async (fresh: boolean): Promise<OffsiteStatus> => {
    if (offsiteRunning) throw new ApiError(409, 'offsite_running', 'A copy is already being made')
    offsiteRunning = true
    const before = await settings.get<OffsiteStatus>('offsite-status')
    let status: OffsiteStatus
    try {
      status = await runOffsite(await offsiteSettings(), backups, ctx.config().media.dir, fresh)
    } catch (error) {
      status = { at: new Date().toISOString(), ok: false, message: (error as Error).message }
      if (before?.ok !== false)
        for (const admin of (await auth.listUsers()).filter((u) => u.role === 'admin'))
          await mailNotice(admin.email, 'Backup fuori dal server non riuscito', [
            `La copia dei backup di ${ctx.config().site.name} fuori dal server non è riuscita: ${status.message}`,
            'Controlla in Impostazioni → Sicurezza → Backup. Ti scriviamo di nuovo solo quando torna a funzionare e si ferma di nuovo.',
          ])
    } finally {
      offsiteRunning = false
    }
    await settings.set('offsite-status', status)
    await activityLog.record({
      userId: null,
      userName: '',
      action: status.ok ? 'backup.offsite' : 'backup.offsite_failed',
      target: status.database ?? '',
      detail: status.ok ? { media: status.media, fonts: status.fonts } : { message: status.message },
      ip: null,
    })
    return status
  }
  /** After the daily copy: once a day, unless the last run failed (then every hour until it works). */
  const autoOffsite = async () => {
    const s = await offsiteSettings()
    if (s.kind === 'off' || !s.key || offsiteRunning) return
    const last = await settings.get<OffsiteStatus>('offsite-status')
    if (last?.ok && Date.now() - new Date(last.at).getTime() < 23 * 60 * 60_000) return
    await offsiteRun(false)
  }
  const nightly = async () => {
    await autoBackup().catch(backupFailed)
    await autoOffsite().catch((error) => console.error('Materialize: offsite copy not made', error))
  }
  setTimeout(() => void nightly(), 60_000).unref?.()
  setInterval(() => void nightly(), 60 * 60_000).unref?.()

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
  // Files sent with the site's forms: next to the database, never served by the public site.
  const uploadsDir = join(dirname(resolve(ctx.config().media.dir)), 'uploads')
  let formCache: { at: number; forms: Map<string, FormDefinition> } | null = null
  /** The live site changed: rebuild it, and read its forms again. */
  const sitePublished = () => {
    formCache = null
    ctx.onPublish?.()
  }
  const app = new Hono<Env>()

  const guardEmbeds = (user: User, before: unknown, after: unknown) => {
    if (user.role === 'admin') return
    if (JSON.stringify(embedsOf(before).sort()) !== JSON.stringify(embedsOf(after).sort()))
      throw new ApiError(
        403,
        'embed_admin_only',
        'Solo un amministratore può modificare il codice personalizzato e dove arrivano i messaggi dei moduli',
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
  const toJson = async (doc: StoredDocument) => {
    const def = ctx.config().collections.find((x) => x.name === doc.collection)
    const check = def ? validate(def, prepare(def, doc.data)) : null
    return {
      ...doc,
      url: def?.url ? def.url(doc.data as never) : null,
      issues: check && !check.ok ? check.issues : [],
      /** When it goes on or off the site by itself, and the last scheduled action that failed. */
      schedule: await schedules.forDocument(doc.id),
      /** The release it goes out with, if any. */
      release: await releases
        .forDocument(doc.id)
        .then((r) =>
          r
            ? { id: r.id, name: r.name, runAt: r.runAt, action: r.items.find((i) => i.documentId === doc.id)?.action }
            : null,
        ),
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
    sitePublished()
  }

  /** The site's name as set in the panel (the settings singleton, published), else the config's. */
  const siteName = async (): Promise<string> => {
    const config = ctx.config()
    const def = config.collections.find((d) => d.singleton && d.fields.siteName)
    const found = def && (await content.list(def.name, { locale: config.locales.default, limit: 1 })).items[0]
    const name = found ? (await content.get(found.id))?.publishedData?.siteName : null
    return typeof name === 'string' && name.trim() ? name : config.site.name
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

  /** For the sign-in page: whether "Password dimenticata?" can send an email, or someone has to help. */
  app.get('/api/auth/recovery', async (c) => c.json({ mail: isConfigured(await settings.get<MailSettings>('mail')) }))

  /**
   * A forgotten password: a one-time link by email, valid an hour. The answer is the same whether
   * the email has an account or not, so nobody can learn who is registered; requests per email and
   * per address are limited, so nobody can flood an inbox.
   */
  app.post('/api/auth/forgot', async (c) => {
    const input = await body(c, z.object({ email: z.email() }))
    const email = input.email.trim().toLowerCase()
    const ip = clientIp(c)
    await checkLocks(`forgot:${email}`, `forgot-ip:${ip}`)
    await auth.recordFailure(`forgot:${email}`, FORGOT_THRESHOLD)
    await auth.recordFailure(`forgot-ip:${ip}`, FORGOT_IP_THRESHOLD)
    const mail = isConfigured(await settings.get<MailSettings>('mail'))
    const found = mail ? await auth.findForLogin(email) : null
    if (found) {
      const { token } = await auth.createInvite({
        kind: 'reset',
        email: found.email,
        name: found.name,
        role: found.role,
        userId: found.id,
        ttlMs: FORGOT_TTL,
      })
      await mailLink(
        c,
        found.email,
        'Nuova password',
        [
          `Qualcuno ha chiesto una nuova password per il tuo account su ${ctx.config().site.name}.`,
          'Se non sei stato tu, ignora questa email: la password resta quella di prima.',
          'Per sceglierne una nuova, apri questo link entro un’ora:',
        ],
        linkPath(token),
      )
      await record(c, 'password.forgot', found.email, null, { id: found.id, name: found.name })
    }
    return c.json({ ok: true, mail })
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
    access: ['login.', 'logout', 'session.', 'twofactor.', 'token.', 'security.', 'password.'],
    people: ['user.'],
    content: ['document.', 'release.', 'site.', 'media.', 'message.'],
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
                detail: `Ultima copia ${new Intl.RelativeTimeFormat('it', { numeric: 'auto' }).format(-Math.round(age / 3_600_000), 'hour')}, immagini comprese; ne restano ${b.keep}.`,
              },
      )
    }
    {
      const o = await offsiteSettings()
      const status = await settings.get<OffsiteStatus>('offsite-status')
      checks.push(
        o.kind === 'off' || !o.key
          ? {
              id: 'offsite',
              status: 'warn',
              title: 'I backup restano sul server',
              detail:
                'Se il server si rompe, si perdono anche le copie. Attiva la copia fuori dal server (S3 o WebDAV), oppure scarica ogni tanto l’archivio completo.',
              action: 'backups',
            }
          : status && !status.ok
            ? {
                id: 'offsite',
                status: 'bad',
                title: 'La copia fuori dal server non riesce',
                detail: status.message ?? 'Controlla il collegamento.',
                action: 'backups',
              }
            : {
                id: 'offsite',
                status: 'ok',
                title: 'Copia cifrata fuori dal server',
                detail: status
                  ? `Ultima copia ${new Intl.RelativeTimeFormat('it', { numeric: 'auto' }).format(-Math.round((Date.now() - new Date(status.at).getTime()) / 3_600_000), 'hour')}, su ${o.kind === 's3' ? 'S3' : 'WebDAV'}.`
                  : 'La prima copia parte entro un’ora.',
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
    entries.push(...(await folderEntries(uploadsDir, 'uploads')))
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

  /** What the panel may see: no passwords, no secret key, no recovery key. */
  const offsiteState = async () => {
    const s = await offsiteSettings()
    return {
      kind: s.kind,
      keep: s.keep,
      hasKey: !!s.key,
      s3: s.s3 ? { ...s.s3, secretAccessKey: '', hasSecret: !!s.s3.secretAccessKey } : undefined,
      webdav: s.webdav ? { ...s.webdav, password: '', hasSecret: !!s.webdav.password } : undefined,
      status: (await settings.get<OffsiteStatus>('offsite-status')) ?? null,
      running: offsiteRunning,
    }
  }
  const s3Input = z.object({
    endpoint: z.url({ protocol: /^https?$/ }).max(300),
    region: z.string().trim().max(60),
    bucket: z.string().trim().min(1).max(200),
    prefix: z.string().trim().max(200).optional(),
    accessKeyId: z.string().trim().min(1).max(200),
    // Empty: keep the saved one.
    secretAccessKey: z.string().max(500),
  })
  const webdavInput = z.object({
    url: z.url({ protocol: /^https?$/ }).max(500),
    user: z.string().trim().max(200),
    password: z.string().max(500),
  })
  const offsiteInput = z.object({
    kind: z.enum(['off', 's3', 'webdav']),
    keep: z.number().int().min(1).max(365),
    s3: s3Input.optional(),
    webdav: webdavInput.optional(),
  })
  /** The settings as sent, with the saved secrets where the panel left them empty. */
  const withSecrets = (input: z.infer<typeof offsiteInput>, saved: OffsiteSettings): OffsiteSettings => {
    if (input.kind === 's3' && !input.s3) throw new ApiError(400, 'missing_s3', 'S3 settings are missing')
    if (input.kind === 'webdav' && !input.webdav)
      throw new ApiError(400, 'missing_webdav', 'WebDAV settings are missing')
    return {
      kind: input.kind,
      keep: input.keep,
      key: saved.key,
      s3: input.s3
        ? { ...input.s3, secretAccessKey: input.s3.secretAccessKey || saved.s3?.secretAccessKey || '' }
        : saved.s3,
      webdav: input.webdav
        ? { ...input.webdav, password: input.webdav.password || saved.webdav?.password || '' }
        : saved.webdav,
    }
  }

  app.get('/api/backups/offsite', requireUser, requireSession, requireAdmin, async (c) => c.json(await offsiteState()))

  /** Saves where the copy goes; the first time, makes the recovery key and returns it, once. */
  app.put('/api/backups/offsite', requireUser, requireSession, requireAdmin, async (c) => {
    const next = withSecrets(await body(c, offsiteInput), await offsiteSettings())
    let shown: string | undefined
    if (next.kind !== 'off' && !next.key) next.key = shown = newRecoveryKey()
    await settings.set('offsite', next, c.get('user').id)
    await record(c, 'settings.offsite', next.kind)
    return c.json({ ...(await offsiteState()), recoveryKey: shown })
  })

  app.post('/api/backups/offsite/test', requireUser, requireSession, requireAdmin, async (c) => {
    try {
      await testOffsite(withSecrets(await body(c, offsiteInput), await offsiteSettings()))
      return c.json({ ok: true })
    } catch (error) {
      if (error instanceof ApiError) throw error
      return c.json({ ok: false, message: (error as Error).message })
    }
  })

  /** "Esegui ora": a fresh copy of the database and whatever is missing, in the background. */
  app.post('/api/backups/offsite/run', requireUser, requireSession, requireAdmin, async (c) => {
    const s = await offsiteSettings()
    if (s.kind === 'off' || !s.key) throw new ApiError(409, 'offsite_off', 'The copy outside the server is off')
    if (offsiteRunning) throw new ApiError(409, 'offsite_running', 'A copy is already being made')
    void offsiteRun(true).catch((error) => console.error('Materialize: offsite copy not made', error))
    await record(c, 'backup.offsite_started')
    return c.json(await offsiteState(), 202)
  })

  /** The recovery key again, for an administrator who confirms their password. */
  app.post('/api/backups/offsite/key', requireUser, requireSession, requireAdmin, async (c) => {
    const input = await body(c, z.object({ password: z.string().min(1).max(500) }))
    await checkPassword(c.get('user').id, input.password)
    const s = await offsiteSettings()
    if (!s.key) throw new ApiError(404, 'no_key', 'There is no recovery key yet')
    await record(c, 'backup.key_shown')
    return c.json({ recoveryKey: s.key })
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

  app.get('/api/schema', requireUser, async (c) => {
    const config = ctx.config()
    return c.json({
      site: { ...config.site, name: await siteName() },
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
    sitePublished()
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
      sitePublished()
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
    sitePublished()
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

  /**
   * The address links in emails point to: the site's own (MATERIALIZE_SITE_URL, site.url) when it
   * is known. The request's Host header is used only without it, as in local development: anyone
   * can send a request with a false Host, and a link to their server would carry the token there.
   */
  const publicOrigin = (c: Context) => {
    const site = ctx.config().site.url
    try {
      if (site) return new URL(site).origin
    } catch {}
    return new URL(c.req.url).origin
  }

  const mailLink = async (c: Context, to: string, subject: string, lines: string[], path: string) => {
    const mail = await settings.get<MailSettings>('mail')
    if (!isConfigured(mail)) return false
    try {
      const url = new URL(path, publicOrigin(c)).toString()
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
          provider: z.string().max(40).optional(),
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
      // What went wrong and what to do, in words: a blocked port, a wrong password, an unverified sender…
      return c.json({ ok: false, to, ...(await explainMailError(error, mail)) })
    }
    return c.json({ ok: true, to })
  })

  /** The sender's domain as mail servers see it: SPF, DKIM, DMARC. */
  app.post('/api/mail/domain', requireUser, requireSession, requireAdmin, async (c) => {
    const input = await body(c, z.object({ from: z.string().max(200), provider: z.string().max(40).optional() }))
    const domain = senderDomain(input.from)
    if (!domain) throw new ApiError(422, 'no_domain', 'Write the sender first, for example sito@example.com')
    return c.json({ domain, checks: await checkSenderDomain(domain, input.provider) })
  })

  // A form on the site: the message is kept, and sent by email when email is set up.
  // ---------- AI: settings, text actions and the editor's assistant ----------

  const aiSettings = async () => ({ ...EMPTY_AI, ...(await settings.get<AiSettings>('ai')) })

  /** The tokens of this month, added up request by request: what the provider will bill. */
  type MonthUsage = AiUsage & { month: string }
  const thisMonth = () => new Date().toISOString().slice(0, 7)
  const monthUsage = async (): Promise<MonthUsage> => {
    const saved = await settings.get<MonthUsage>('ai-usage')
    const month = thisMonth()
    return saved?.month === month ? saved : { month, requests: 0, input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }
  }
  // One write at a time: the steps of a turn and parallel requests all count.
  let usageWrites = Promise.resolve()
  const countUsage = (u: AiUsage) => {
    usageWrites = usageWrites
      .then(async () => {
        const total = await monthUsage()
        for (const k of ['requests', 'input', 'output', 'cacheRead', 'cacheWrite'] as const) total[k] += u[k]
        await settings.set('ai-usage', total)
      })
      .catch((error) => console.error(error))
  }

  const readyAi = async () => {
    const ai = await aiSettings()
    if (!isReady(ai)) throw new ApiError(400, 'ai_not_configured', 'L’AI non è configurata: Impostazioni → AI e MCP')
    return { ...ai, onUsage: countUsage }
  }
  const aiFailed = (error: unknown): never => {
    if (error instanceof AiError) throw new ApiError(422, 'ai_failed', error.message)
    throw error
  }
  const allowAi = createLimiter(40, 60_000)

  app.get('/api/ai', requireUser, async (c) => {
    const ai = await aiSettings()
    return c.json(
      c.get('user').role === 'admin' ? { ai: publicAi(ai), usage: await monthUsage() } : { ai: { ready: isReady(ai) } },
    )
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
          fastModel: z.string().trim().max(120).default(''),
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
    const probe = { system: 'Answer with one short word.', prompt: 'Say: ok' }
    // Both models: a wrong name for the quick actions shows up here, not at the first ✨.
    const reply = await complete(ai, probe).catch(aiFailed)
    await complete(ai, { ...probe, fast: true }).catch(aiFailed)
    return c.json({ ok: true, reply })
  })

  // ---------- brand voice ----------

  /** `style` when the AI changes a text someone wrote, `full` when it writes one (see voicePrompt). */
  const voiceText = async (use: 'full' | 'style' = 'full') => voicePrompt(await settings.get<BrandVoice>('voice'), use)
  const voiceSchema = z.object({
    about: z.string().trim().max(1000).optional(),
    tones: z.array(z.enum(VOICE_TONES)).max(3).optional(),
    address: z.enum(['tu', 'voi', 'lei']).nullable().optional(),
    prefer: z.string().trim().max(1000).optional(),
    avoid: z.string().trim().max(1000).optional(),
    rules: z.string().trim().max(1500).optional(),
    example: z.string().trim().max(3000).optional(),
  })

  app.get('/api/voice', requireUser, async (c) => c.json({ voice: (await settings.get<BrandVoice>('voice')) ?? {} }))

  app.put('/api/voice', requireUser, requireAdmin, async (c) => {
    const input = await body(c, z.object({ voice: voiceSchema }))
    await settings.set('voice', input.voice, c.get('user').id)
    await record(c, 'settings.voice')
    return c.json({ voice: input.voice })
  })

  /**
   * A brand voice read from the texts already on the site, to start from: nothing is saved, the
   * panel puts it in the form to check.
   */
  app.post('/api/voice/suggest', requireUser, requireAdmin, async (c) => {
    if (!allowAi(c.get('user').id)) throw new ApiError(429, 'too_many_requests', 'Troppe richieste: aspetta un minuto')
    const ai = await readyAi()
    const config = ctx.config()
    const texts: string[] = []
    let size = 0
    for (const def of config.collections) {
      for (const doc of await content.published(def.name, config.locales.default)) {
        for (const slot of documentSlots(def.fields, doc.publishedData ?? {})) {
          const t = slot.text.replace(/<[^>]+>/g, '').trim()
          if (t.length < 20 || size > 14_000) continue
          texts.push(t)
          size += t.length
        }
      }
    }
    if (size < 300)
      throw new ApiError(400, 'too_little_text', 'Il sito ha ancora pochi testi pubblicati: scrivi la voce a mano')
    const reply = await complete(ai, {
      system:
        'You describe the voice of a brand from the texts of its website, for a style guide the brand will reuse. Reply with JSON only, no code fences.',
      prompt: `Read these texts of the website "${config.site.name}" and describe how it speaks, writing in the language of the texts.
Reply with this JSON object:
{"about": "who the brand is and who it writes for, one or two sentences",
 "tones": [up to three of ${JSON.stringify(VOICE_TONES)}],
 "address": "tu" | "voi" | "lei" | null (how readers are addressed),
 "prefer": "words and phrases typical of these texts, comma separated",
 "avoid": "words that would sound wrong for this brand, comma separated",
 "rules": "two or three rules of style seen in the texts, as short sentences",
 "example": "a short paragraph of new text in this voice, about the brand"}

<texts>
${texts.join('\n---\n')}
</texts>`,
    }).catch(aiFailed)
    let raw: Record<string, unknown> | null = null
    try {
      raw = JSON.parse(reply.replace(/^\s*```(?:json)?|```\s*$/g, '').trim()) as Record<string, unknown>
    } catch {}
    const parsed = voiceSchema.safeParse(
      raw && {
        ...raw,
        tones: Array.isArray(raw.tones)
          ? raw.tones.filter((t) => (VOICE_TONES as readonly unknown[]).includes(t)).slice(0, 3)
          : [],
        address: ['tu', 'voi', 'lei'].includes(raw.address as string) ? raw.address : null,
      },
    )
    if (!parsed.success) throw new ApiError(422, 'ai_failed', 'L’AI non ha risposto come doveva: riprova')
    return c.json({ voice: parsed.data, texts: texts.length })
  })

  // ---------- AI review before publishing ----------

  const REVIEW_KINDS = ['spelling', 'grammar', 'voice', 'consistency', 'link', 'clarity'] as const

  /** The site's pages by address, with their titles: what a link on the page points to. */
  const pageTitles = async () => {
    const out = new Map<string, string>()
    const config = ctx.config()
    for (const def of config.collections) {
      if (!def.url) continue
      for (const doc of await content.published(def.name)) {
        const url = publicUrl(def, doc.locale, doc.publishedData ?? {})
        if (url && out.size < 200) out.set(url, doc.title)
      }
    }
    return out
  }

  /**
   * The AI reads the draft as it is now (saved or not) and lists what to fix before publishing:
   * typos, grammar, sentences out of the brand voice, facts that contradict each other, links whose
   * words promise something else than where they go, unclear sentences. Each with the exact words
   * and a replacement. Nothing is changed.
   */
  app.post('/api/documents/:id/review', requireUser, async (c) => {
    const existing = await loadDocument(c.req.param('id'))
    const input = await body(c, z.object({ data: z.record(z.string(), z.unknown()).optional() }))
    if (!allowAi(c.get('user').id)) throw new ApiError(429, 'too_many_requests', 'Troppe richieste: aspetta un minuto')
    const ai = await readyAi()
    const def = collection(existing.collection)
    const slots = documentSlots(def.fields, structuredClone(input.data ?? existing.data))
    if (!slots.length) throw new ApiError(400, 'empty_text', 'Non c’è testo da rivedere')
    const titles = await pageTitles()
    const linkTo = (href: string) => {
      const path = href.split('#')[0] || href
      const title = titles.get(path.replace(/\/+$/, '') || '/')
      return title ? `${href} (page "${title}")` : href
    }
    let size = 0
    const listed = slots.flatMap((s, i) => {
      if (size > 30_000) return []
      size += s.text.length
      const links = s.links?.length ? `\n  links: ${s.links.map((l, n) => `${n + 1} → ${linkTo(l)}`).join('; ')}` : ''
      return [`[${i}] ${s.text}${links}`]
    })
    const voice = await voiceText('full')
    const reply = await complete(ai, {
      system: `${voice ? `${voice}\n\n` : ''}You review a web page before it is published, as a careful editor. Reply with JSON only, no code fences.`,
      prompt: `These are the texts of the page "${existing.title}", numbered. Tags like <b>, <i> and <a1>…</a1> mark formatting and links; "links" says where each numbered link goes.

Find what really needs fixing before publishing, and nothing else:
- spelling: typos and misspelled words
- grammar: grammar, agreement, punctuation
- voice: sentences clearly out of the brand voice above (skip if there is none)
- consistency: facts on the page that contradict each other (prices, dates, names, numbers)
- link: link words that promise something different from the page they go to
- clarity: a sentence a reader would not understand

Reply with {"issues": [{"slot": number, "kind": one of ${JSON.stringify(REVIEW_KINDS)}, "find": "the exact words to change, copied from that text with its tags", "replace": "the corrected words, or \\"\\" when only a person can fix it", "note": "why, in one short sentence, in the language of the page"}]}.
At most 25 issues, the most important first. An empty list is a fine answer when the page is good. Do not report style preferences, the length of texts, or things that are fine.

<texts>
${listed.join('\n')}
</texts>`,
    }).catch(aiFailed)
    let raw: unknown
    try {
      raw = JSON.parse(reply.replace(/^\s*```(?:json)?|```\s*$/g, '').trim())
    } catch {
      throw new ApiError(422, 'ai_failed', 'L’AI non ha risposto come doveva: riprova')
    }
    const issue = z.object({
      slot: z.number().int().min(0),
      kind: z.enum(REVIEW_KINDS),
      find: z.string().min(1).max(2000),
      replace: z.string().max(4000),
      note: z.string().max(500),
    })
    const items = Array.isArray((raw as { issues?: unknown })?.issues) ? (raw as { issues: unknown[] }).issues : []
    const issues = items.flatMap((it) => {
      const parsed = issue.safeParse(it)
      if (!parsed.success) return []
      const slot = slots[parsed.data.slot]
      // Only what is really in the text: a quote the model made up cannot be applied.
      if (!slot?.text.includes(parsed.data.find)) return []
      return [{ ...parsed.data, node: slot.node ?? null, context: slot.text.replace(/<[^>]+>/g, '').slice(0, 160) }]
    })
    await record(c, 'document.reviewed', existing.title, {
      collection: existing.collection,
      id: existing.id,
      issues: issues.length,
    })
    return c.json({ issues: issues.slice(0, 25) })
  })

  /**
   * Applies one suggestion of the review to the draft as the editor holds it, and gives it back:
   * the editor takes it as one change, which ⌘Z undoes. Nothing is saved here.
   */
  app.post('/api/documents/:id/review/apply', requireUser, async (c) => {
    const existing = await loadDocument(c.req.param('id'))
    const input = await body(
      c,
      z.object({
        data: z.record(z.string(), z.unknown()),
        slot: z.number().int().min(0),
        find: z.string().min(1).max(2000),
        replace: z.string().max(4000),
      }),
    )
    const data = structuredClone(input.data)
    const slots = documentSlots(collection(existing.collection).fields, data)
    // The same text, or the first one that still has those words (the page may have changed since).
    const slot = slots[input.slot]?.text.includes(input.find)
      ? slots[input.slot]
      : slots.find((s) => s.text.includes(input.find))
    if (!slot) throw new ApiError(409, 'changed', 'Quel testo è cambiato: rifai la revisione')
    slot.set(slot.text.replace(input.find, input.replace))
    return c.json({ data })
  })

  const TEXT_ACTIONS: Record<string, string> = {
    rewrite: 'Rewrite it so it reads better: same meaning, similar length.',
    shorten: 'Make it shorter, keeping what matters most.',
    expand: 'Make it longer and richer, without inventing facts.',
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
        /** rich: the text is rich text as lines of markup (richTextMarkup), and so is the reply. */
        format: z.enum(['plain', 'rich']).default('plain'),
        /** The most characters the field takes. */
        max: z.number().int().positive().max(100_000).optional(),
      }),
    )
    if (!allowAi(c.get('user').id)) throw new ApiError(429, 'too_many_requests', 'Troppe richieste: aspetta un minuto')
    const ai = await readyAi()
    // Writing from scratch takes the whole voice; changing a text, only its style.
    const voice = await voiceText(['seo_title', 'seo_description', 'custom'].includes(input.action) ? 'full' : 'style')
    const lang = input.locale ?? ctx.config().locales.default
    const system = `You edit texts for a website. Reply with the resulting text only: no quotes, no preamble, no notes. Keep the language of the text${
      input.action === 'translate' ? ' unless asked to translate' : ''
    }; when writing from scratch, write in the language with code "${lang}". Keep line breaks where they make sense; never add Markdown.${
      // Spelling fixes and alternative texts describe: they do not speak with the brand's voice.
      input.action === 'fix' || input.action === 'alt' || !voice ? '' : `\n\n${voice}`
    }`
    if (input.action === 'alt') {
      const key = /^\/media\/([^/?#@]+)/.exec(input.src ?? '')?.[1]
      const file = key ? await files.open(decodeURIComponent(key), { width: 1024, format: 'jpg' }) : null
      if (!file) throw new ApiError(400, 'no_image', 'Scegli prima un’immagine della libreria')
      const data = (await readFile(file.path)).toString('base64')
      // The text already there may credit the photographer or the source: that part stays.
      const current = input.text.trim()
        ? `\n\nThe current alternative text is:\n<text>\n${input.text}\n</text>\nWrite in its language. If it credits a photographer, an author or a source (such as "photo by … on Unsplash"), keep that credit at the end, in the same form.`
        : ''
      const text = await complete(ai, {
        system,
        fast: true,
        prompt: `Write the alternative text (alt) for this image on a website, in the language with code "${lang}"${current ? ' unless said otherwise below' : ''}: one sentence, at most 125 characters (besides any credit), describing what matters for someone who cannot see it. No "image of".${current}`,
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
    const rich =
      input.format === 'rich'
        ? '\n\nThe text is markup, one block per line: <p>, <h2>, <h3>, <h4>, <blockquote>, <li>, with <b>, <i> and numbered links (<a1>…</a1>) inside, and <img1>, <img2>… for images. Reply in the same markup: you may change, merge, split or add blocks; keep each link around the matching words and every image line.'
        : ''
    // Shorter and longer by how much: as words, small models barely touch a short text or
    // multiply it. A length in characters (the words alone, without markup) they follow.
    const length = input.text.replace(/<[^>]+>/g, '').length
    let max = input.max
    let target = ''
    if (input.action === 'shorten') {
      target = `\n\nThe text has ${length} characters: aim for about ${Math.round(length * 0.65)}.`
      max = Math.min(max ?? Number.POSITIVE_INFINITY, Math.round(length * 0.8))
    } else if (input.action === 'expand')
      target = `\n\nThe text has ${length} characters: aim for about ${Math.round(length * 1.5)}, never more than ${length * 2}.`
    const limit = max ? `\n\nThe result must be at most ${max} characters, spaces included.` : ''
    let text = await complete(ai, {
      system,
      fast: true,
      prompt: `${task}${target}${limit}${rich}\n\n<text>\n${input.text}\n</text>`,
    }).catch(aiFailed)
    // Models count characters loosely: another pass when the result is too long, then one on the
    // main model when the quick one still does not get there (a small model may return the text as is).
    for (const fast of [true, false]) {
      if (!max || input.format !== 'plain' || text.length <= max) break
      text = await complete(ai, {
        system,
        fast,
        prompt: `Shorten this text to at most ${max} characters, spaces included (it has ${text.length}), keeping its meaning and tone.\n\n<text>\n${text}\n</text>`,
      }).catch(aiFailed)
    }
    return c.json({ text })
  })

  /** Conversations with the assistant, per person and chat, kept for two hours in memory. */
  const chats = new Map<string, { conv: Conversation; at: number; voice?: string }>()

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
        /** Reference pictures (a screenshot, a mockup, a sketch), already made smaller by the panel. */
        images: z
          .array(
            z.object({
              mime: z.enum(['image/png', 'image/jpeg', 'image/webp']),
              data: z.base64().max(4_000_000),
            }),
          )
          .max(4)
          .default([]),
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
    const same = !!entry && entry.conv.provider === ai.provider
    const conv = same && entry ? entry.conv : { provider: ai.provider, messages: [] }
    // Fixed when the conversation starts (its instructions may not change): a voice changed
    // meanwhile applies to the next conversation.
    const voice = same && entry?.voice !== undefined ? entry.voice : await voiceText()
    chats.set(key, { conv, at: now, voice })

    const before = input.nodes as unknown as PageNode[]
    const page = { nodes: before }
    const auth: Record<string, string> = {}
    const authorization = c.req.header('authorization')
    const cookie = c.req.header('cookie')
    if (authorization) auth.authorization = authorization
    else if (cookie) auth.cookie = cookie
    const tools = assistantTools(apiCaller(app.fetch, auth), page, ctx.config().site.name)
    const limited = await contentOnly(user)
    // The instructions stay the same for the whole conversation: the model's earlier reasoning is
    // tied to them (a change is refused) and they are read from the prompt cache. What changes
    // from turn to turn, the page and what is selected, goes with each message instead.
    const system = `${voice ? `${voice}\n\n` : ''}You are the assistant inside Materialize, the visual editor of the website "${ctx.config().site.name}". The person (${user.name}) is editing a page; each of their messages starts with a <context> note on the page and on what is selected on the canvas.
Use the tools to look at the page (get_page, get_node) and change it (edit_page). Your changes go into the editor, where the person sees them at once and can undo them; they are not published.
Read the page before changing it. Make the changes asked, consistent with the design already there (theme colors and text styles, spacing, the look of nearby sections); prefer the section library for new sections. Keep ids of existing nodes.
${limited ? 'This person may change only contents (texts, links, images, alt texts), not the layout or the design: do not add, remove or move nodes, and do not change styles.\n' : ''}Pictures the person attaches are references (a site they like, a mockup, a sketch): take their layout, hierarchy and mood, and build it with this site's sections, theme and texts; never copy their brand, logos or texts, and do not put the pictures on the page.
When done, say in one or two short sentences what you changed. Reply in the person's language. If something cannot be done with the tools, say so.`
    const context = `<context>Page "${input.page.title}" (collection ${input.page.collection}${input.page.url ? `, address ${input.page.url}` : ''}). ${
      input.selected?.length
        ? `Selected on the canvas: ${input.selected.join(', ')} (what "this" refers to).`
        : 'Nothing selected on the canvas.'
    }</context>`

    return streamSSE(c, async (stream) => {
      const send = (data: unknown) => stream.writeSSE({ data: JSON.stringify(data) })
      try {
        const reply = await runTurn(ai, conv, {
          system,
          text: `${context}\n\n${input.message}`,
          images: input.images,
          tools,
          onEvent: (e) => void send(e),
        })
        chats.set(key, { conv, at: Date.now(), voice })
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

  // A first version of the site from a few lines about the business: new drafts only, theme and
  // voice proposed. Admins, since the proposal touches the design of the whole site.
  /** Runs of the site builder, per person, kept two hours: the person may answer the AI and go on. */
  const briefRuns = new Map<
    string,
    { conv: Conversation; system: string; result: BriefResult; askVoice: boolean; theme: boolean; at: number }
  >()

  app.post('/api/ai/site', requireUser, requireSession, requireAdmin, async (c) => {
    const input = await body(
      c,
      z
        .object({
          brief: z.string().trim().min(20, 'Scrivi qualche riga in più sull’attività').max(6000).optional(),
          /** A reply in a run already started, with its id. */
          runId: z.string().max(64).optional(),
          message: z.string().trim().min(1).max(4000).optional(),
          theme: z.boolean().default(true),
          images: z
            .array(
              z.object({
                mime: z.enum(['image/png', 'image/jpeg', 'image/webp']),
                data: z.base64().max(4_000_000),
              }),
            )
            .max(2)
            .default([]),
        })
        .refine((v) => (v.runId ? !!v.message : !!v.brief), { message: 'Scrivi il brief' }),
    )
    const user = c.get('user')
    if (!allowAi(user.id)) throw new ApiError(429, 'too_many_requests', 'Troppe richieste: aspetta un minuto')
    const ai = await readyAi()
    const now = Date.now()
    for (const [k, v] of briefRuns) if (now - v.at > 2 * 60 * 60 * 1000) briefRuns.delete(k)
    const runId = input.runId ?? crypto.randomUUID()
    const key = `${user.id}:${runId}`
    let run = input.runId ? briefRuns.get(key) : undefined
    if (input.runId && (!run || run.conv.provider !== ai.provider))
      throw new ApiError(409, 'run_expired', 'Questa conversazione non c’è più: parti da un nuovo brief')

    if (!run) {
      const config = ctx.config()
      const pageCollections = config.collections.filter(
        (d) => !d.singleton && Object.values(d.fields).some((f) => f.kind === 'page'),
      )
      if (!pageCollections.length)
        throw new ApiError(400, 'no_pages', 'Il sito non ha una raccolta di pagine costruite sulla tela')
      const locale = config.locales.default
      const existing: string[] = []
      for (const d of config.collections.filter((x) => !x.singleton)) {
        const { items } = await content.list(d.name, { locale, limit: 100 })
        for (const i of items) existing.push(`${d.name}: "${i.title}"${i.slug ? ` (slug ${i.slug})` : ''}`)
      }
      // Fixed for the whole run, like the assistant's: the model's reasoning is tied to them.
      const voice = await voiceText()
      const askVoice = !voice
      run = {
        conv: { provider: ai.provider, messages: [] },
        system: briefSystem({
          site: config.site.name,
          language: languageName(locale),
          collections: pageCollections.map((d) => `${d.name} (${d.label ?? d.name})`).join(', '),
          existing: existing.length ? existing.join('; ') : 'none: the site is empty',
          voice,
          askVoice,
          theme: input.theme,
        }),
        result: { created: [], theme: null, voice: null },
        askVoice,
        theme: input.theme,
        at: now,
      }
    }
    const current = run
    current.at = now
    briefRuns.set(key, current)

    const auth: Record<string, string> = {}
    const authorization = c.req.header('authorization')
    const cookie = c.req.header('cookie')
    if (authorization) auth.authorization = authorization
    else if (cookie) auth.cookie = cookie

    return streamSSE(c, async (stream) => {
      const send = (data: unknown) => stream.writeSSE({ data: JSON.stringify(data) })
      const stop = new AbortController()
      stream.onAbort(() => stop.abort())
      const { tools, result } = briefTools(apiCaller(app.fetch, auth), {
        askVoice: current.askVoice,
        result: current.result,
        onCreated: (doc) => void send({ type: 'created', doc }),
      })
      const before = result.created.length
      try {
        const reply = await runTurn(ai, current.conv, {
          system: current.system,
          text: input.runId ? (input.message ?? '') : `<brief>\n${input.brief}\n</brief>`,
          images: input.images,
          tools: current.theme ? tools : tools.filter((t) => t.name !== 'propose_theme'),
          onEvent: (e) => void send(e),
          maxSteps: 80,
          signal: stop.signal,
        })
        if (result.created.length > before)
          await record(c, 'site.generated', '', { pages: result.created.length - before })
        await send({ type: 'result', ...result })
        await send({ type: 'text', text: reply })
        await send({ type: 'done', runId })
      } catch (error) {
        if (!(error instanceof AiError)) console.error(error)
        // What was made before the failure stays, as drafts: the panel lists it. The run ends.
        briefRuns.delete(key)
        await send({ type: 'result', ...result })
        await send({ type: 'error', message: error instanceof Error ? error.message : 'Errore' })
        await send({ type: 'done' })
      }
    })
  })

  // ---------- forms ----------

  /**
   * Every form on the published site, by id, as the server checks it: canvas pages with their
   * shared sections and components expanded, like the site renders them. Kept a minute.
   */
  const publishedForms = async (): Promise<Map<string, FormDefinition>> => {
    if (formCache && Date.now() - formCache.at < 60_000) return formCache.forms
    const forms = new Map<string, FormDefinition>()
    const globals = (await settings.get<Record<string, PageNode>>('globals')) ?? {}
    const components = (await settings.get<Record<string, Component>>('components')) ?? {}
    const collect = (nodes: PageNode[]) =>
      walk(expandComponents(expandGlobals(nodes, globals), components), (n) => {
        const def = formDefinition(n)
        if (def && !forms.has(def.id)) forms.set(def.id, def)
      })
    for (const def of ctx.config().collections) {
      const pageFields = Object.entries(def.fields)
        .filter(([, f]) => f.kind === 'page')
        .map(([name]) => name)
      if (!pageFields.length) continue
      for (const doc of await content.published(def.name)) {
        for (const name of pageFields) {
          const nodes = doc.publishedData?.[name]
          if (Array.isArray(nodes)) collect(nodes as PageNode[])
        }
      }
    }
    collect(Object.values(globals))
    formCache = { at: Date.now(), forms }
    return forms
  }

  const formsSettings = async (): Promise<FormsSettings> => (await settings.get<FormsSettings>('forms')) ?? {}
  /** The secret that signs webhook calls, made the first time it is needed. */
  const webhookSecret = async () => {
    const current = await formsSettings()
    if (current.webhookSecret) return current.webhookSecret
    const secret = `whsec_${randomBytes(24).toString('base64url')}`
    await settings.set('forms', { ...current, webhookSecret: secret })
    return secret
  }

  app.post(
    '/api/forms/:form',
    bodyLimit({
      maxSize: 25 * 1024 * 1024,
      onError: () => {
        throw new ApiError(413, 'file_too_large', 'Gli allegati sono troppo grandi')
      },
    }),
    async (c) => {
      const form = c.req.param('form').slice(0, 80)
      const ip = clientIp(c)
      if (!allowForm(`${ip}:${form}`))
        throw new ApiError(429, 'too_many_attempts', 'Troppi messaggi: riprova tra un minuto')
      const type = c.req.header('content-type') ?? ''
      const isJson = type.includes('application/json')
      const wantsJson = isJson || (c.req.header('accept') ?? '').includes('application/json')
      const raw = (isJson ? await c.req.json().catch(() => ({})) : await c.req.parseBody()) as Record<string, unknown>
      const page =
        typeof raw._page === 'string' ? raw._page.slice(0, 300) : (c.req.header('referer') ?? '').slice(0, 300)
      const back = (c.req.header('referer') ?? '/').split('#')[0]
      // A field people never see: bots fill it in. They get the same answer as everyone.
      if (typeof raw._gotcha === 'string' && raw._gotcha.length > 0)
        return wantsJson ? c.json({ ok: true }) : c.redirect(`${back}#inviato`, 303)

      const def = (await publishedForms()).get(form) ?? null
      const { data, files, issues } = await readSubmission(raw, def)
      if (issues.length) {
        if (!wantsJson) return c.redirect(`${back}#non-inviato`, 303)
        return c.json({ error: { code: 'invalid', message: 'Controlla i campi evidenziati', issues } }, 422)
      }
      if (!Object.values(data).some((v) => v.trim()) && !files.length)
        return wantsJson ? c.json({ ok: true }) : c.redirect(`${back}#inviato`, 303)

      const elapsed = typeof raw._t === 'string' && /^\d+$/.test(raw._t) ? Number(raw._t) : null
      const fingerprint = fingerprintOf(form, data)
      const spam =
        spamReason(data, elapsed) ??
        ((await submissions.seen(fingerprint, new Date(Date.now() - 86_400_000))) ? 'Messaggio ripetuto' : null)
      const formName = def?.name?.trim() || def?.subject?.trim() || ''
      const saved = await submissions.add({ form, formName, page, data, spam, fingerprint })
      if (files.length) await submissions.setFiles(saved.id, await saveFiles(uploadsDir, saved.id, files))

      // Spam stays in the panel, recoverable, but nobody is notified.
      if (!spam) {
        const mail = await settings.get<MailSettings>('mail')
        const to = (def?.to || mail?.to || '').trim()
        const sender = Object.entries(data).find(
          ([k, v]) =>
            (def?.fields.find((f) => f.name === k)?.kind === 'email' || /mail/i.test(k)) && /^[^\s@]+@[^\s@]+$/.test(v),
        )?.[1]
        if (isConfigured(mail) && to) {
          const subject = def?.subject || (typeof raw._subject === 'string' ? raw._subject.slice(0, 120) : '')
          const attached = files.length
            ? `\n\nAllegati (${files.map((f) => f.name).join(', ')}): li trovi in Impostazioni → Messaggi.`
            : ''
          sendMail(mail, {
            to,
            subject: `Nuovo messaggio dal sito${subject ? `: ${subject}` : ''}`,
            text: submissionText(page, data) + attached,
            replyTo: sender,
          })
            .then(() => submissions.markMailed(saved.id))
            .catch((error) => console.error('Materialize: email not sent', error))
          // An answer to whoever wrote: the site's own words only, never what was sent.
          if (sender && def?.autoReply?.text?.trim())
            sendMail(mail, {
              to: sender,
              subject: def.autoReply.subject?.trim() || 'Abbiamo ricevuto il tuo messaggio',
              text: def.autoReply.text,
              replyTo: to.split(',')[0]?.trim(),
            }).catch((error) => console.error('Materialize: automatic reply not sent', error))
        }
        if (def?.webhook) {
          const payload = {
            id: saved.id,
            form: { id: form, name: formName },
            page,
            data,
            files: files.map((f) => ({ field: f.field, name: f.name, size: f.bytes.length })),
            createdAt: saved.createdAt.toISOString(),
          }
          void webhookSecret()
            .then((secret) => sendWebhook(def.webhook as string, payload, secret))
            .then((ok) => submissions.setWebhook(saved.id, ok ? 'ok' : 'failed'))
            .catch((error) => console.error('Materialize: webhook not sent', error))
        }
      }
      // Without JavaScript the browser posted the form itself: back to the page, marked as sent.
      return wantsJson ? c.json({ ok: true }) : c.redirect(`${back}#inviato`, 303)
    },
  )

  const filterOf = (c: Context) => ({
    form: c.req.query('form') || undefined,
    status: (['unread', 'spam'] as const).find((s) => s === c.req.query('status')),
    q: c.req.query('q')?.slice(0, 200) || undefined,
  })

  app.get('/api/submissions', requireUser, async (c) => {
    const limit = Math.min(Number(c.req.query('limit') ?? 50), 200)
    const offset = Math.max(Number(c.req.query('offset') ?? 0), 0)
    return c.json({
      ...(await submissions.list(limit, offset, filterOf(c))),
      forms: await submissions.forms(),
    })
  })

  /** The messages as a spreadsheet (one column per field), with the filters of the list. */
  app.get('/api/submissions/export.csv', requireUser, async (c) => {
    const { items } = await submissions.list(10_000, 0, filterOf(c))
    const fields = [...new Set(items.flatMap((m) => Object.keys(m.data)))]
    const cell = (v: string) => {
      // A leading =, +, - or @ would run as a formula in a spreadsheet.
      const safe = /^[=+\-@\t\r]/.test(v) ? `'${v}` : v
      return /[",\n;]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe
    }
    const rows = [
      ['Data', 'Modulo', 'Pagina', ...fields],
      ...items.map((m) => [
        m.createdAt.toISOString(),
        m.formName || m.form,
        m.page,
        ...fields.map((f) => m.data[f] ?? ''),
      ]),
    ]
    await record(c, 'message.exported', '', { count: items.length })
    // With the byte order mark, Excel reads accented letters right.
    return new Response(`﻿${rows.map((r) => r.map(cell).join(',')).join('\r\n')}\r\n`, {
      headers: {
        'content-type': 'text/csv; charset=utf-8',
        'content-disposition': `attachment; filename="messaggi-${new Date().toISOString().slice(0, 10)}.csv"`,
        'cache-control': 'no-store',
      },
    })
  })

  app.patch('/api/submissions/:id', requireUser, async (c) => {
    const input = await body(c, z.object({ read: z.boolean().optional(), spam: z.boolean().optional() }))
    const id = c.req.param('id')
    if (input.read !== undefined) await submissions.markRead(id, input.read)
    if (input.spam !== undefined) await submissions.markSpam(id, input.spam ? 'Segnato a mano' : null)
    return c.json({ ok: true })
  })

  /** A file sent with a message: always downloaded, never opened in the panel's own page. */
  app.get('/api/submissions/:id/files/:n', requireUser, async (c) => {
    const message = await submissions.get(c.req.param('id'))
    const file = message?.files[Number(c.req.param('n'))]
    if (!message || !file) throw new ApiError(404, 'not_found', 'File non trovato')
    const bytes = await readFile(join(uploadsDir, file.path)).catch(() => null)
    if (!bytes) throw new ApiError(404, 'not_found', 'Il file non c’è più')
    return new Response(bytes, {
      headers: {
        'content-type': 'application/octet-stream',
        'content-disposition': `attachment; filename*=UTF-8''${encodeURIComponent(file.name)}`,
        'x-content-type-options': 'nosniff',
        'cache-control': 'no-store',
      },
    })
  })

  app.delete('/api/submissions/:id', requireUser, requireAdmin, async (c) => {
    await submissions.remove(c.req.param('id'))
    await removeFiles(uploadsDir, c.req.param('id'))
    await record(c, 'message.deleted')
    return c.body(null, 204)
  })

  /** How long messages are kept, and the key to check webhook calls (admins only see the key). */
  app.get('/api/forms/settings', requireUser, async (c) => {
    const current = await formsSettings()
    const admin = c.get('user').role === 'admin'
    return c.json({
      keepMonths: current.keepMonths ?? null,
      webhookSecret: admin ? await webhookSecret() : null,
    })
  })

  app.put('/api/forms/settings', requireUser, requireAdmin, async (c) => {
    const input = await body(c, z.object({ keepMonths: z.number().int().min(1).max(120).nullable() }))
    const current = await formsSettings()
    await settings.set('forms', { ...current, keepMonths: input.keepMonths ?? undefined }, c.get('user').id)
    await record(c, 'settings.forms', '', { keepMonths: input.keepMonths })
    void pruneMessages()
    return c.json({ keepMonths: input.keepMonths })
  })

  /** Deletes the messages older than the kept months, with their files. */
  const pruneMessages = async () => {
    const months = (await formsSettings()).keepMonths
    if (!months) return 0
    const before = new Date()
    before.setMonth(before.getMonth() - months)
    const old = await submissions.olderThan(before)
    for (const m of old) {
      await submissions.remove(m.id)
      await removeFiles(uploadsDir, m.id)
    }
    return old.length
  }
  setTimeout(() => void pruneMessages().catch(() => {}), 10_000).unref?.()
  setInterval(() => void pruneMessages().catch(() => {}), 6 * 3_600_000).unref?.()

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
          plausible: id(TRACKING_PATTERNS.plausible, 'Scrivi il dominio come su Plausible, per esempio example.com'),
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
    sitePublished()
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
    sitePublished()
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
    sitePublished()
    await record(c, 'settings.redirects', '', { count: redirects.length })
    return c.json({ redirects })
  })

  // Template pages: a page designed on the canvas that shows each entry of a collection.
  app.get('/api/templates', requireUser, async (c) => c.json({ templates: (await settings.get('templates')) ?? {} }))

  app.put('/api/templates', requireUser, async (c) => {
    const input = await body(c, z.object({ templates: z.record(z.string(), z.string()) }))
    await settings.set('templates', input.templates, c.get('user').id)
    sitePublished()
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
    sitePublished()
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
    // What goes on or off the site by itself, for a label in the list.
    const pending = await schedules.pending()
    const when = (id: string, action: 'publish' | 'unpublish') =>
      pending.find((p) => p.documentId === id && p.action === action)?.runAt ?? null
    return c.json({
      ...result,
      items: result.items.map((i) => ({
        ...i,
        url: urlOf(i.slug),
        publishAt: when(i.id, 'publish'),
        unpublishAt: when(i.id, 'unpublish'),
      })),
    })
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
    return c.json(await toJson(doc), 201)
  })

  const loadDocument = async (id: string) => {
    const doc = await content.get(id)
    if (!doc) throw new ApiError(404, 'not_found', 'This document does not exist')
    return doc
  }

  app.get('/api/documents/:id', requireUser, async (c) => c.json(await toJson(await loadDocument(c.req.param('id')))))

  app.put('/api/documents/:id', requireUser, async (c) => {
    const existing = await loadDocument(c.req.param('id'))
    const input = await body(c, documentBody)
    const def = collection(existing.collection)
    const draft = draftData(def, input.data)
    guardEmbeds(c.get('user'), existing.data, draft.data)
    for (const [name, f] of Object.entries(def.fields))
      if (f.kind === 'page') await guardDesign(c.get('user'), existing.data[name], draft.data[name])
    const doc = await slugGuard(() => content.update(existing.id, { ...draft, userId: c.get('user').id }))
    return c.json(await toJson(doc as StoredDocument))
  })

  /** Puts a document's draft on the site: the same steps from the button and from a schedule. */
  const publishDocument = async (existing: StoredDocument, userId: string | undefined) => {
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
        await settings.set('redirects', next, userId)
    }
    const doc = (await content.publish(existing.id, userId, data)) as StoredDocument
    sitePublished()
    return { doc, url: after }
  }

  const unpublishDocument = async (existing: StoredDocument, userId: string | undefined) => {
    const doc = (await content.unpublish(existing.id, userId)) as StoredDocument
    if (existing.publishedAt) sitePublished()
    return doc
  }

  app.post('/api/documents/:id/publish', requireUser, async (c) => {
    const existing = await loadDocument(c.req.param('id'))
    const { doc, url } = await publishDocument(existing, c.get('user').id)
    // Published by hand: a publication still waiting would only repeat it.
    await schedules.cancel(existing.id, 'publish')
    await record(c, 'document.published', doc.title, { collection: doc.collection, id: doc.id, url })
    return c.json(await toJson(doc))
  })

  app.post('/api/documents/:id/unpublish', requireUser, async (c) => {
    const existing = await loadDocument(c.req.param('id'))
    const doc = await unpublishDocument(existing, c.get('user').id)
    await schedules.cancel(existing.id, 'unpublish')
    await record(c, 'document.unpublished', doc.title, { collection: doc.collection, id: doc.id })
    return c.json(await toJson(doc))
  })

  /**
   * When a document goes on the site, or comes off it, by itself. `at` null cancels. A publication
   * is checked now too, so missing fields show up when it is set, not when it fails at night.
   */
  app.put('/api/documents/:id/schedule', requireUser, async (c) => {
    const existing = await loadDocument(c.req.param('id'))
    const input = await body(
      c,
      z.object({ action: z.enum(['publish', 'unpublish']), at: z.iso.datetime({ offset: true }).nullable() }),
    )
    const user = c.get('user')
    const label = input.action === 'publish' ? 'publish' : 'unpublish'
    if (input.at === null) {
      await schedules.cancel(existing.id, input.action)
      await record(c, `document.schedule_cancelled`, existing.title, {
        collection: existing.collection,
        id: existing.id,
        action: label,
      })
      return c.json(await toJson(existing))
    }
    const at = new Date(input.at)
    if (at.getTime() <= Date.now() + 30_000)
      throw new ApiError(400, 'past_time', 'Scegli un momento nel futuro, almeno tra un minuto')
    const current = await schedules.forDocument(existing.id)
    if (input.action === 'publish') publishableData(collection(existing.collection), existing.data)
    else {
      if (!existing.publishedAt && !current.publish)
        throw new ApiError(409, 'not_published', 'La pagina non è sul sito: programma prima la pubblicazione')
      if (current.publish && current.publish.runAt >= at)
        throw new ApiError(400, 'before_publish', 'La pagina verrebbe tolta prima di essere pubblicata')
    }
    if (input.action === 'publish' && current.unpublish && current.unpublish.runAt <= at)
      throw new ApiError(400, 'after_unpublish', 'La pubblicazione verrebbe dopo il momento in cui la pagina va tolta')
    await schedules.set({ documentId: existing.id, action: input.action, runAt: at, user })
    await record(c, 'document.scheduled', existing.title, {
      collection: existing.collection,
      id: existing.id,
      action: label,
      at: at.toISOString(),
    })
    return c.json(await toJson(existing))
  })

  /** Why a document's draft cannot go on the site now, in words; null when it can. */
  const publishProblem = (doc: StoredDocument): string | null => {
    const def = ctx.config().collections.find((x) => x.name === doc.collection)
    if (!def) return 'La raccolta non esiste più'
    const check = validate(def, prepare(def, doc.data))
    if (check.ok) return null
    const fields = [...new Set(check.issues.map((i) => def.fields[i.path.split('.')[0] ?? '']?.label ?? i.path))]
    return `Alcuni campi vanno completati${fields.length ? `: ${fields.join(', ')}` : ''}`
  }

  /**
   * Runs the actions whose time has come, as the person who set them. A server that was off at the
   * time catches up when it starts. A publication whose fields are no longer complete fails with a
   * reason the panel shows, instead of putting a broken page online.
   */
  let schedulesRunning = false
  const runSchedules = async (now = new Date()): Promise<number> => {
    if (schedulesRunning) return 0
    schedulesRunning = true
    let ran = 0
    try {
      for (const item of await schedules.due(now)) {
        const note = (action: string, target: string, detail: Record<string, unknown>) =>
          activityLog
            .record({
              userId: item.createdBy,
              userName: item.createdByName,
              action,
              target,
              detail: { ...detail, scheduled: true },
              ip: null,
            })
            .catch((error) => console.error('Materialize: activity not recorded', error))
        const existing = await content.get(item.documentId)
        if (!existing) {
          await schedules.finish(item.id, 'failed', 'La pagina non esiste più')
          continue
        }
        try {
          if (item.action === 'publish') {
            const problem = publishProblem(existing)
            if (problem) throw new Error(problem)
            const { doc, url } = await publishDocument(existing, item.createdBy ?? undefined)
            await schedules.finish(item.id, 'done')
            await note('document.published', doc.title, { collection: doc.collection, id: doc.id, url })
          } else {
            const doc = await unpublishDocument(existing, item.createdBy ?? undefined)
            await schedules.finish(item.id, 'done')
            await note('document.unpublished', doc.title, { collection: doc.collection, id: doc.id })
          }
          ran++
        } catch (error) {
          const message = error instanceof Error && error.message ? error.message : 'Errore imprevisto'
          await schedules.finish(item.id, 'failed', message)
          await note('document.schedule_failed', existing.title, {
            collection: existing.collection,
            id: existing.id,
            action: item.action,
            message,
          })
        }
      }
      for (const release of await releases.due(now)) {
        const by = release.scheduledBy ? { id: release.scheduledBy, name: release.scheduledByName } : null
        if (await releaseOut(release, by)) ran++
      }
    } catch (error) {
      console.error('Materialize: scheduled publishing failed', error)
    } finally {
      schedulesRunning = false
    }
    return ran
  }
  setTimeout(() => void runSchedules(), 5_000).unref?.()
  setInterval(() => void runSchedules(), 30_000).unref?.()

  /** What is coming: every pending publication and removal, soonest first. */
  app.get('/api/schedules', requireUser, async (c) => {
    const items = await schedules.pending()
    const docs = new Map<string, StoredDocument | null>()
    for (const i of items) if (!docs.has(i.documentId)) docs.set(i.documentId, await content.get(i.documentId))
    return c.json({
      items: items.flatMap((i) => {
        const doc = docs.get(i.documentId)
        return doc ? [{ ...i, title: doc.title, collection: doc.collection, locale: doc.locale }] : []
      }),
    })
  })

  // ---------- releases ----------

  type ReleaseProblem = { documentId: string; title: string; message: string }

  /** What stops a release from going out: every document must be ready, or none goes. */
  const releaseProblems = async (release: Release): Promise<ReleaseProblem[]> => {
    const out: ReleaseProblem[] = []
    for (const item of release.items) {
      const doc = await content.get(item.documentId)
      if (!doc) out.push({ documentId: item.documentId, title: '', message: 'La pagina non esiste più' })
      else if (item.action === 'publish') {
        const message = publishProblem(doc)
        if (message) out.push({ documentId: doc.id, title: doc.title, message })
      }
    }
    if (!release.items.length) out.push({ documentId: '', title: '', message: 'Il rilascio è vuoto' })
    return out
  }

  /**
   * Puts a release on the site: checked first, all or nothing. Returns whether it went out; when
   * it did not, the release is marked failed with the reason, and the panel shows it.
   */
  const releaseOut = async (release: Release, by: { id: string; name: string } | null): Promise<boolean> => {
    const note = (action: string, target: string, detail: Record<string, unknown>) =>
      activityLog
        .record({ userId: by?.id ?? null, userName: by?.name ?? '', action, target, detail, ip: null })
        .catch((error) => console.error('Materialize: activity not recorded', error))
    const problems = await releaseProblems(release)
    if (problems.length) {
      const message = problems.map((p) => (p.title ? `${p.title}: ${p.message}` : p.message)).join('; ')
      await releases.finish(release.id, 'failed', message)
      await note('release.failed', release.name, { id: release.id, message })
      return false
    }
    const done: string[] = []
    try {
      for (const item of release.items) {
        const doc = await content.get(item.documentId)
        if (!doc) continue
        if (item.action === 'publish') {
          await publishDocument(doc, by?.id)
          await schedules.cancel(doc.id, 'publish')
        } else if (doc.publishedAt) {
          await unpublishDocument(doc, by?.id)
          await schedules.cancel(doc.id, 'unpublish')
        }
        done.push(doc.title)
      }
    } catch (error) {
      const why = error instanceof Error && error.message ? error.message : 'Errore imprevisto'
      const message = `${why}${done.length ? ` (già uscite: ${done.join(', ')})` : ''}`
      await releases.finish(release.id, 'failed', message)
      await note('release.failed', release.name, { id: release.id, message })
      return false
    }
    await releases.finish(release.id, 'published')
    await note('release.published', release.name, { id: release.id, items: release.items.length })
    return true
  }

  /** A release as the panel shows it: each document with its title, state and what stops it. */
  const releaseJson = async (release: Release) => {
    const problems = release.status === 'published' ? [] : await releaseProblems(release)
    const items = []
    for (const item of release.items) {
      const doc = await content.get(item.documentId)
      if (!doc) continue
      items.push({
        ...item,
        title: doc.title,
        collection: doc.collection,
        locale: doc.locale,
        status: doc.status,
        problem: problems.find((p) => p.documentId === doc.id)?.message ?? null,
      })
    }
    return { ...release, items, ready: problems.length === 0 }
  }

  const loadRelease = async (id: string) => {
    const release = await releases.get(id)
    if (!release) throw new ApiError(404, 'not_found', 'Questo rilascio non esiste')
    return release
  }
  const openRelease = async (id: string) => {
    const release = await loadRelease(id)
    if (release.status === 'published' || release.status === 'cancelled')
      throw new ApiError(409, 'release_closed', 'Questo rilascio è già uscito o è stato annullato')
    return release
  }

  app.get('/api/releases', requireUser, async (c) => {
    const { active, done } = await releases.list()
    return c.json({
      releases: await Promise.all(active.map(releaseJson)),
      published: await Promise.all(done.map(releaseJson)),
    })
  })

  app.post('/api/releases', requireUser, async (c) => {
    const input = await body(c, z.object({ name: z.string().trim().min(1).max(120) }))
    const release = await releases.create(input.name, c.get('user'))
    await record(c, 'release.created', release.name, { id: release.id })
    return c.json(await releaseJson(release), 201)
  })

  app.get('/api/releases/:id', requireUser, async (c) =>
    c.json(await releaseJson(await loadRelease(c.req.param('id')))),
  )

  app.patch('/api/releases/:id', requireUser, async (c) => {
    const release = await openRelease(c.req.param('id'))
    const input = await body(c, z.object({ name: z.string().trim().min(1).max(120) }))
    await releases.rename(release.id, input.name)
    return c.json(await releaseJson(await loadRelease(release.id)))
  })

  /** Cancels a release: its documents stay as they are. */
  app.delete('/api/releases/:id', requireUser, async (c) => {
    const release = await openRelease(c.req.param('id'))
    await releases.finish(release.id, 'cancelled')
    await record(c, 'release.cancelled', release.name, { id: release.id })
    return c.body(null, 204)
  })

  /** Adds a document (or changes what happens to it): it leaves any other release. */
  app.put('/api/releases/:id/items/:documentId', requireUser, async (c) => {
    const release = await openRelease(c.req.param('id'))
    const doc = await loadDocument(c.req.param('documentId'))
    const input = await body(c, z.object({ action: z.enum(['publish', 'unpublish']).default('publish') }))
    if (input.action === 'unpublish' && !doc.publishedAt)
      throw new ApiError(409, 'not_published', 'La pagina non è sul sito: non c’è niente da togliere')
    await releases.put(release.id, doc.id, input.action)
    await record(c, 'release.item_added', doc.title, { id: release.id, release: release.name, action: input.action })
    return c.json(await releaseJson(await loadRelease(release.id)))
  })

  app.delete('/api/releases/:id/items/:documentId', requireUser, async (c) => {
    const release = await openRelease(c.req.param('id'))
    await releases.remove(release.id, c.req.param('documentId'))
    return c.json(await releaseJson(await loadRelease(release.id)))
  })

  /** Everything in the release goes on the site now, or nothing does (the reasons come back). */
  app.post('/api/releases/:id/publish', requireUser, async (c) => {
    const release = await openRelease(c.req.param('id'))
    const problems = await releaseProblems(release)
    if (problems.length)
      return c.json(
        {
          error: {
            code: 'release_not_ready',
            message: 'Alcune pagine non sono pronte: non è uscito niente',
            problems,
          },
        },
        422,
      )
    const user = c.get('user')
    const ok = await releaseOut(release, user)
    const after = await loadRelease(release.id)
    if (!ok) throw new ApiError(422, 'release_failed', after.error ?? 'Il rilascio non è uscito')
    return c.json(await releaseJson(after))
  })

  /** When the release goes out by itself; at null: only by hand. Checked now, and again at that moment. */
  app.put('/api/releases/:id/schedule', requireUser, async (c) => {
    const release = await openRelease(c.req.param('id'))
    const input = await body(c, z.object({ at: z.iso.datetime({ offset: true }).nullable() }))
    const user = c.get('user')
    if (input.at === null) {
      await releases.schedule(release.id, null, null)
      await record(c, 'release.schedule_cancelled', release.name, { id: release.id })
      return c.json(await releaseJson(await loadRelease(release.id)))
    }
    const at = new Date(input.at)
    if (at.getTime() <= Date.now() + 30_000)
      throw new ApiError(400, 'past_time', 'Scegli un momento nel futuro, almeno tra un minuto')
    if (!release.items.length) throw new ApiError(400, 'empty_release', 'Aggiungi prima qualcosa al rilascio')
    await releases.schedule(release.id, at, user)
    await record(c, 'release.scheduled', release.name, { id: release.id, at: at.toISOString() })
    return c.json(await releaseJson(await loadRelease(release.id)))
  })

  // ---------- shared preview links ----------

  const previewJson = (c: Context, link: PreviewLink) => {
    const path = `/_materialize/share/${link.token}`
    return { ...link, path, url: new URL(path, publicOrigin(c)).toString() }
  }

  /** The links that still work for a document, newest first. */
  app.get('/api/documents/:id/previews', requireUser, async (c) => {
    const existing = await loadDocument(c.req.param('id'))
    return c.json({ items: (await previewLinks.forDocument(existing.id)).map((l) => previewJson(c, l)) })
  })

  /**
   * A secret address that shows the latest saved draft with the site's own design, to people
   * without an account: a client, a colleague. `days` null: until someone revokes it.
   */
  app.post('/api/documents/:id/previews', requireUser, async (c) => {
    const existing = await loadDocument(c.req.param('id'))
    const input = await body(c, z.object({ days: z.number().int().min(1).max(365).nullable() }))
    if (!ctx.preview) throw new ApiError(409, 'no_site', 'Questo sito non ha pagine da mostrare in anteprima')
    if (!collection(existing.collection).url)
      throw new ApiError(400, 'no_page', 'Questo contenuto non ha una pagina sul sito')
    const expiresAt = input.days === null ? null : new Date(Date.now() + input.days * 86_400_000)
    const link = await previewLinks.create({ documentId: existing.id, expiresAt, user: c.get('user') })
    await record(c, 'document.preview_shared', existing.title, {
      collection: existing.collection,
      id: existing.id,
      expiresAt: expiresAt?.toISOString() ?? null,
    })
    return c.json(previewJson(c, link), 201)
  })

  app.delete('/api/previews/:id', requireUser, async (c) => {
    const link = await previewLinks.get(c.req.param('id'))
    if (!link) throw new ApiError(404, 'not_found', 'Link non trovato')
    const doc = await content.get(link.documentId)
    await previewLinks.revoke(link.id)
    await record(c, 'document.preview_revoked', doc?.title ?? '', { id: link.documentId })
    return c.body(null, 204)
  })
  void previewLinks.prune().catch(() => {})

  app.delete('/api/documents/:id', requireUser, requireAdmin, async (c) => {
    const existing = await loadDocument(c.req.param('id'))
    await content.remove(existing.id)
    await schedules.removeForDocument(existing.id)
    await releases.removeDocument(existing.id)
    await previewLinks.removeForDocument(existing.id)
    if (existing.publishedAt) sitePublished()
    await record(c, 'document.deleted', existing.title, { collection: existing.collection })
    return c.body(null, 204)
  })

  app.get('/api/documents/:id/revisions', requireUser, async (c) => {
    const existing = await loadDocument(c.req.param('id'))
    // Who made each version, by name; null for a person removed since (and for versions with no author).
    const names = new Map((await auth.listUsers()).map((u) => [u.id, u.name]))
    const items = (await content.revisions(existing.id)).map((r) => ({
      ...r,
      authorName: r.authorId ? (names.get(r.authorId) ?? null) : null,
    }))
    return c.json({ items })
  })

  app.post('/api/documents/:id/revisions/:revision/restore', requireUser, async (c) => {
    const existing = await loadDocument(c.req.param('id'))
    const doc = await content.restore(existing.id, c.req.param('revision'), c.get('user').id)
    if (!doc) throw new ApiError(404, 'not_found', 'This version does not exist')
    await record(c, 'document.restored', doc.title, { collection: doc.collection, id: doc.id })
    return c.json(await toJson(doc))
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
    sitePublished()
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
      undefined,
      await voiceText('style'),
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
    return c.json(await toJson(created), 201)
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
          undefined,
          await voiceText('style'),
        ).catch(aiFailed)
        for (const [i, slot] of own.entries()) slot.set(translated[i] as string)
      }
    }
    for (const [name, f] of Object.entries(def.fields))
      if (f.kind === 'page') await guardDesign(c.get('user'), doc.data[name], data[name])
    const draft = draftData(def, data)
    const saved = await slugGuard(() => content.update(doc.id, { ...draft, userId: c.get('user').id }))
    return c.json({ document: await toJson(saved as StoredDocument), added: fresh.size })
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

  /** The caller's credentials, for tools that go through the API as them. */
  const credentialsOf = (c: Context): Record<string, string> => {
    const authorization = c.req.header('authorization')
    const cookie = c.req.header('cookie')
    return authorization ? { authorization } : cookie ? { cookie } : {}
  }

  /**
   * An imported page laid out again by the AI with the section library, in its draft. The texts
   * and images must stay the same (checked after): otherwise the page is left as it was.
   */
  const relayoutPage = async (
    ai: Awaited<ReturnType<typeof readyAi>>,
    id: string,
    user: { id: string; name: string },
    credentials: Record<string, string>,
  ): Promise<string | null> => {
    const doc = await content.get(id)
    if (!doc) return 'la pagina non c’è più'
    const def = collection(doc.collection)
    const field = Object.entries(def.fields).find(([, f]) => f.kind === 'page')?.[0]
    const before = field && Array.isArray(doc.data[field]) ? (doc.data[field] as PageNode[]) : null
    if (!field || !before?.length) return 'la pagina è vuota'
    const page = { nodes: before }
    const call = apiCaller(app.fetch, credentials)
    const getSchema = () => call<SiteSchema>('GET', '/api/schema')
    const tools = [
      ...contentTools(call, getSchema).filter((t) => ['list_library', 'get_theme'].includes(t.name)),
      ...pageTools({
        withId: false,
        brand: async () => ctx.config().site.name,
        source: async () => ({
          load: async () => page.nodes,
          save: async (nodes) => {
            page.nodes = nodes
          },
        }),
      }),
    ]
    const system = `You redesign one page of the website "${ctx.config().site.name}", just imported from WordPress into Materialize. Its content arrived as a plain column of texts, images and buttons, one section per heading. Rebuild it so it looks designed, with the section library.

How: read the page (get_page) and the library (list_library); replace the plain sections with library sections (edit_page: add_section, then fill them; remove what you replace and the library sample nodes you do not use); read the page again at the end and fix what is left.

Rules:
- Keep every text word for word: you may split it across sections, change its style (title, body, eyebrow) or turn a list into cards, but do not rewrite, shorten or translate it.
- Keep every image (same src and alt) and every button with its link.
- Add no text of your own: no new headings, slogans, labels or facts. Library sample texts and pictures you do not replace with the page's own content must be removed.
- Do not add a menu or a footer: the site has its own.
- Keep it simple: a clear opening, then sections that follow the page's order.
When done, reply with one short sentence.`
    await runTurn(
      ai,
      { provider: ai.provider, messages: [] },
      { system, text: `Lay out the page "${doc.title}".`, tools, onEvent: () => {}, maxSteps: 30 },
    )
    const problem = relayoutProblem(before, page.nodes)
    if (problem) return problem
    const draft = draftData(def, { ...doc.data, [field]: restoreAlts(before, page.nodes).map(plain) })
    await content.update(doc.id, { ...draft, userId: user.id })
    return null
  }

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
          aiLayout: z.boolean().optional(),
        }),
      }),
    )
    const held = wpSites.get(input.token)
    const ai = input.plan.aiLayout ? await readyAi() : null
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
      relaid: 0,
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
      relayout: ai ? (doc) => relayoutPage(ai, doc.id, user, credentialsOf(c)) : undefined,
    }
    void runImport(held.site, plan, deps)
      .then(async (result) => {
        await settings.set('imports:media', known, user.id)
        if (result.created.some((d) => d.published) || result.redirects) sitePublished()
        await activityLog.record({
          userId: user.id,
          userName: user.name,
          action: 'import.wordpress',
          target: held.site.name,
          detail: {
            created: result.created.length,
            media: result.media.downloaded,
            redirects: result.redirects,
            ...(result.relaid ? { relaid: result.relaid } : {}),
          },
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

  // runSchedules: for the tests, which cannot wait for the clock.
  return Object.assign(app, { runSchedules })
}
