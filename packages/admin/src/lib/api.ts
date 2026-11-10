import type { CollectionDescription, FieldDescription, RichText, ValidationIssue } from '@materializecms/core'
import type { BoundEntry, Component, PageNode, Theme } from '@materializecms/core/page'
import type { Redirect, SiteSeo } from '@materializecms/core/seo'
import type { TrackingSettings } from '@materializecms/core/tracking'
import type { UpdateSettings, UpdateStatus } from '@materializecms/core/updates'
import type { BrandVoice } from '@materializecms/core/voice'

import { lang, t } from './i18n.ts'

export type { CollectionDescription, FieldDescription, ValidationIssue }

export type DocumentStatus = 'draft' | 'published' | 'changed'
export type Data = Record<string, unknown>

export interface User {
  id: string
  email: string
  name: string
  /** Signs in with a code from an authenticator app too. */
  twoFactor?: boolean
  role: 'admin' | 'editor'
  /** The panel's language; null: the browser's. */
  locale?: 'it' | 'en' | null
}

export interface Member extends User {
  createdAt: string
  lastSeenAt: string | null
}

export interface Invite {
  id: string
  kind: 'invite' | 'reset'
  email: string
  name: string
  role: User['role']
  createdAt: string
  expiresAt: string
}

export interface Schema {
  site: { name: string; url?: string }
  /** The site renders previews with its own components (Astro): the canvas shows the real page. */
  preview?: boolean
  locales: { default: string; available: string[] }
  collections: CollectionDescription[]
}

export interface DocumentSummary {
  id: string
  title: string
  slug: string | null
  status: DocumentStatus
  updatedAt: string
  publishedAt: string | null
  /** First image in the document, for thumbnails. */
  image?: string | null
  /** Public address, when the collection has pages ("/" for the home page). */
  url?: string | null
  /** The other languages it exists in. */
  locales?: string[]
  /** When it goes on or off the site by itself (lists only). */
  publishAt?: string | null
  unpublishAt?: string | null
}

/** One language version of a document. */
export interface Translation {
  id: string
  locale: string
  title: string
  status: DocumentStatus
  sourceId: string | null
}

export interface FontInfo {
  id: string
  family: string
  category: string
  weights: number[]
  styles: string[]
  variable: boolean
}

export type SignIn = { user: User; twoFactor?: undefined } | { twoFactor: true; ticket: string; user?: undefined }

/** Profilo → Sicurezza. */
export interface AccountSecurity {
  twoFactor: { enabled: boolean; recoveryLeft: number }
  /** The site requires it of everyone. */
  required: boolean
  sessions: {
    id: string
    userAgent: string | null
    ip: string | null
    createdAt: string
    lastSeenAt: string
    current: boolean
  }[]
}

/** One line of the activity log. */
export interface ActivityEntry {
  id: string
  seq: number
  at: string
  userId: string | null
  userName: string
  action: string
  target: string
  detail: Record<string, unknown> | null
  ip: string | null
}

/** One point of the security overview, most urgent first. */
export interface SecurityCheck {
  id: string
  status: 'ok' | 'warn' | 'bad' | 'info'
  title: string
  detail: string
  action?: 'people' | 'profile' | 'mail' | 'backups'
}

export interface BackupFile {
  name: string
  size: number
  createdAt: string
}

/** Impostazioni → Sicurezza → Backup. */
export interface OffsiteForm {
  kind: 'off' | 's3' | 'webdav'
  keep: number
  s3?: {
    endpoint: string
    region: string
    bucket: string
    prefix?: string
    accessKeyId: string
    secretAccessKey: string
  }
  webdav?: { url: string; user: string; password: string }
}

export interface OffsiteState {
  kind: OffsiteForm['kind']
  keep: number
  hasKey: boolean
  s3?: NonNullable<OffsiteForm['s3']> & { hasSecret: boolean }
  webdav?: NonNullable<OffsiteForm['webdav']> & { hasSecret: boolean }
  status: { at: string; ok: boolean; message?: string; database?: string; media?: number; fonts?: number } | null
  running: boolean
}

export interface BackupState {
  enabled: boolean
  keep: number
  /** False when the database is hosted (Turso, libSQL): its provider keeps the copies. */
  available: boolean
  items: BackupFile[]
  /** The copy of the uploaded files beside the backups. */
  media: { files: number; size: number }
}

export type WpSource =
  | 'title'
  | 'slug'
  | 'content'
  | 'excerpt'
  | 'date'
  | 'featured'
  | 'categories'
  | 'tags'
  | 'author'
  | 'seo'

export interface WpTarget {
  collection: string
  fields: Record<string, WpSource>
}

/** A WordPress site read, waiting for where its items go. */
export interface WpAnalysis {
  token: string
  site: { name: string; url: string }
  counts: { posts: number; pages: number; drafts: number }
  samples: { posts: string[]; pages: string[] }
  categories: string[]
  suggestions: { posts: WpTarget | null; pages: WpTarget | null }
  fields: Record<
    string,
    Record<string, { label: string; kind: string; sources: WpSource[]; options?: { value: string; label: string }[] }>
  >
}

export interface WpPlan {
  posts: WpTarget | null
  pages: WpTarget | null
  publish: boolean
  redirects: boolean
  locale?: string
  categories?: Record<string, string>
  fallbackCategory?: string
  /** Pages on the canvas laid out again by the AI with the section library. */
  aiLayout?: boolean
}

export interface WpProgress {
  phase: 'media' | 'content' | 'layout' | 'done' | 'failed'
  done: number
  total: number
  created: { id: string; collection: string; title: string; published: boolean }[]
  skipped: { title: string; reason: string }[]
  problems: { title: string; reason: string }[]
  media: { downloaded: number; failed: number; reasons: Record<string, number> }
  redirects: number
  /** Pages the AI laid out again. */
  relaid?: number
  error?: string
}

export interface Overview {
  counts: { collection: string; total: number; drafts: number; changed: number }[]
  recent: (DocumentSummary & { collection: string; updatedBy: string | null })[]
  media: number
}

export interface StoredDocument extends DocumentSummary {
  collection: string
  locale: string
  data: Data
  publishedData: Data | null
  createdAt: string
  url: string | null
  /** The original this document translates; null for originals. */
  sourceId?: string | null
  /** Problems to fix before publishing; returned when a draft is saved. */
  issues?: ValidationIssue[]
  /** When it goes on or off the site by itself, and the last scheduled action that failed. */
  schedule?: DocumentSchedule
  /** The release it goes out with, if any. */
  release?: { id: string; name: string; runAt: string | null; action?: 'publish' | 'unpublish' } | null
}

/** A secret address that shows the latest saved draft to someone without an account. */
export interface PreviewLink {
  id: string
  documentId: string
  expiresAt: string | null
  createdByName: string
  createdAt: string
  viewedAt: string | null
  views: number
  /** Full address, to copy and send. */
  url: string
}

/** Something the AI review found on a page, with the exact words and what to put instead. */
export interface ReviewIssue {
  slot: number
  kind: 'spelling' | 'grammar' | 'voice' | 'consistency' | 'link' | 'clarity'
  find: string
  /** Empty: only a person can fix it. */
  replace: string
  note: string
  /** The canvas element, to select it. */
  node: string | null
  /** The text around it, without formatting. */
  context: string
}

export interface Schedule {
  id: string
  documentId: string
  action: 'publish' | 'unpublish'
  runAt: string
  status: 'pending' | 'done' | 'failed' | 'cancelled'
  error: string | null
  createdByName: string
}

export interface ReleaseItem {
  documentId: string
  action: 'publish' | 'unpublish'
  title: string
  collection: string
  locale: string
  status: DocumentStatus
  /** What stops it from going out, in words. */
  problem: string | null
}

export interface Release {
  id: string
  name: string
  status: 'open' | 'published' | 'failed' | 'cancelled'
  runAt: string | null
  error: string | null
  createdByName: string
  scheduledByName: string
  createdAt: string
  publishedAt: string | null
  items: ReleaseItem[]
  /** Every document can go out. */
  ready: boolean
}

export interface Subscriber {
  id: string
  email: string
  name: string
  status: 'pending' | 'active' | 'unsubscribed'
  source: string
  createdAt: string
  confirmedAt: string | null
  unsubscribedAt: string | null
}

export interface NewsletterStats {
  total: number
  sent: number
  failed: number
  pending: number
  opened: number
  clicked: number
  unsubscribed: number
}

export interface Newsletter {
  id: string
  subject: string
  preheader: string
  body: RichText
  status: 'draft' | 'scheduled' | 'sending' | 'sent' | 'failed'
  runAt: string | null
  error: string | null
  createdByName: string
  createdAt: string
  updatedAt: string
  sentAt: string | null
  stats: NewsletterStats
}

export interface DocumentSchedule {
  publish: Schedule | null
  unpublish: Schedule | null
  failed: Schedule | null
}

export interface Revision {
  id: string
  kind: 'save' | 'publish' | 'restore'
  data: Data
  createdAt: string
  authorId: string | null
  /** The author's name; null for a person removed since, or a version with no author. */
  authorName?: string | null
}

export interface MediaAsset {
  id: string
  key: string
  url: string
  filename: string
  mime: string
  size: number
  width: number | null
  height: number | null
  alt: string
  createdAt: string
  /** Documents that use the file; only on the detail request. */
  usage?: number
}

export interface DomainCheck {
  id: 'spf' | 'dkim' | 'dmarc'
  state: 'ok' | 'warn' | 'bad' | 'info'
  title: string
  detail: string
}

export interface MailSettings {
  host: string
  port: number
  security: 'tls' | 'starttls' | 'none'
  user: string
  from: string
  to: string
  /** The provider chosen from the list (core/mail.ts); empty for another one. */
  provider?: string
  /** A password is saved (it is never sent back). */
  hasPassword?: boolean
}

/** The AI behind the assistant and the text actions: the key never comes back. */
export interface AiSettings {
  provider: 'anthropic' | 'openai'
  baseUrl: string
  model: string
  /** For the quick actions (✨, SEO, alternative text). Empty: Claude Haiku 5.5, or the main model. */
  fastModel?: string
  hasKey?: boolean
  /** The server has ANTHROPIC_API_KEY in its environment. */
  envKey?: boolean
  ready: boolean
}

/** The AI tokens of this month: what the provider bills. */
export interface AiUsage {
  month: string
  requests: number
  input: number
  output: number
  cacheRead: number
  cacheWrite: number
}

/** A personal access token as listed (the secret is shown only when created). */
export interface ApiToken {
  id: string
  name: string
  hint: string
  createdAt: string
  lastUsedAt: string | null
}

export type TextAction =
  | 'rewrite'
  | 'shorten'
  | 'expand'
  | 'fix'
  | 'formal'
  | 'friendly'
  | 'translate'
  | 'custom'
  | 'seo_title'
  | 'seo_description'
  | 'alt'

/** What the assistant reports while it works, then its answer and the changed page. */
export interface BuiltPage {
  id: string
  collection: string
  title: string
  url: string | null
}

export type SiteEvent =
  | { type: 'status'; text: string }
  | { type: 'tool'; name: string; title: string }
  | { type: 'created'; doc: BuiltPage }
  | { type: 'result'; created: BuiltPage[]; theme: Theme | null; voice: BrandVoice | null }
  | { type: 'text'; text: string }
  | { type: 'error'; message: string }
  /** With the run's id when the person can answer the AI and go on. */
  | { type: 'done'; runId?: string }

/** A POST answered with server-sent events: "data: {...}" lines, a blank line after each. */
async function streamEvents<E>(path: string, input: unknown, onEvent: (e: E) => void, signal?: AbortSignal) {
  let res: Response
  try {
    res = await fetch(path, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'content-type': 'application/json', 'x-mz-lang': lang() },
      body: JSON.stringify(input),
      signal,
    })
  } catch (error) {
    if ((error as Error).name === 'AbortError') throw error
    throw new ApiError(0, 'offline', t('Il server non risponde. Controlla che materialize dev sia attivo.'))
  }
  if (!res.ok || !res.body) throw errorFrom(res.status, await res.json().catch(() => null))
  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader()
  let buffer = ''
  for (;;) {
    const { value, done } = await reader.read()
    if (done) break
    buffer += value
    let end = buffer.indexOf('\n\n')
    while (end >= 0) {
      const chunk = buffer.slice(0, end)
      buffer = buffer.slice(end + 2)
      const data = chunk
        .split('\n')
        .filter((l) => l.startsWith('data:'))
        .map((l) => l.slice(5).trimStart())
        .join('\n')
      if (data) onEvent(JSON.parse(data) as E)
      end = buffer.indexOf('\n\n')
    }
  }
}

export type StudioEvent =
  | { type: 'status'; text: string }
  | { type: 'tool'; name: string; title: string }
  | { type: 'touched'; doc: { id: string; collection: string; title: string } }
  | { type: 'text'; text: string }
  | { type: 'error'; message: string }
  | { type: 'done'; runId?: string }

export type ChatEvent =
  | { type: 'status'; text: string }
  | { type: 'tool'; name: string; title: string }
  | { type: 'text'; text: string }
  | { type: 'page'; nodes: PageNode[] }
  | { type: 'error'; message: string }
  | { type: 'done'; chatId: string }

export interface Submission {
  id: string
  form: string
  /** The form's name when it was sent ("Contatti"). */
  formName: string
  page: string
  data: Record<string, string>
  read: boolean
  mailed: boolean
  /** Why it looks like spam; null for a real message. */
  spam: string | null
  files: { field: string; name: string; size: number; type: string }[]
  webhook: 'ok' | 'failed' | null
  createdAt: string
}

export type SubmissionQuery = {
  limit?: number
  offset?: number
  form?: string
  status?: 'unread' | 'spam'
  q?: string
}

export interface PageComment {
  id: string
  documentId: string
  nodeId: string | null
  authorId: string | null
  authorName: string
  body: string
  resolved: boolean
  createdAt: string
}

export class ApiError extends Error {
  readonly status: number
  readonly code: string
  readonly issues: ValidationIssue[]
  constructor(status: number, code: string, message: string, issues: ValidationIssue[] = []) {
    super(message)
    this.status = status
    this.code = code
    this.issues = issues
  }
}

function errorFrom(
  status: number,
  json: { error?: { code?: string; message?: string; issues?: ValidationIssue[] } } | null,
) {
  const error = json?.error ?? {}
  return new ApiError(status, error.code ?? 'error', translate(error.code, error.message), error.issues ?? [])
}

/**
 * This browser tab, for edit turns: a document is edited from one tab at a time, and the server
 * refuses saves from the others. New in every tab (a copied tab gets its own).
 */
export const TAB =
  typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  let res: Response
  try {
    res = await fetch(`/api${path}`, {
      method,
      credentials: 'same-origin',
      headers: {
        'x-mz-tab': TAB,
        'x-mz-lang': lang(),
        ...(body === undefined ? {} : { 'content-type': 'application/json' }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch {
    throw new ApiError(0, 'offline', t('Il server non risponde. Controlla che materialize dev sia attivo.'))
  }
  if (res.status === 204) return undefined as T
  const json = await res.json().catch(() => null)
  if (!res.ok) throw errorFrom(res.status, json)
  return json as T
}

/** A form with a file (an export to read), answered in JSON. */
async function requestForm<T>(path: string, form: FormData): Promise<T> {
  let res: Response
  try {
    res = await fetch(`/api${path}`, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'x-mz-lang': lang() },
      body: form,
    })
  } catch {
    throw new ApiError(0, 'offline', t('Il server non risponde. Controlla che materialize dev sia attivo.'))
  }
  const json = await res.json().catch(() => null)
  if (!res.ok) throw errorFrom(res.status, json)
  return json as T
}

// The API speaks English; the admin speaks to editors in the panel's language.
const messages = (): Record<string, string> => ({
  invalid_credentials: t('Email o password non corretti'),
  unauthenticated: t('Accedi per continuare'),
  forbidden: t('Solo gli amministratori possono farlo'),
  invalid_content: t('Alcuni campi vanno sistemati'),
  invalid_request: t('Controlla i dati inseriti'),
  slug_taken: t('Questo indirizzo è già usato da un altro documento'),
  singleton_exists: t('Questo documento esiste già'),
  already_set_up: t('Un amministratore esiste già'),
  not_found: t('Documento non trovato'),
  file_too_large: t('Il file è troppo grande: al massimo 25 MB'),
  missing_file: t('Nessun file ricevuto'),
  email_taken: t('Questo indirizzo ha già un account'),
  last_admin: t('Serve almeno un amministratore: nomina prima qualcun altro'),
  remove_self: t('Non puoi rimuovere te stesso'),
  invalid_link: t('Il link non è valido o è scaduto: chiedine uno nuovo a chi ti ha invitato'),
  wrong_password: t('La password attuale non è corretta'),
  mail_not_configured: t('Prima configura l’invio delle email: server e mittente'),
  ai_not_configured: t('L’AI non è configurata: Impostazioni → AI e MCP'),
  translation_exists: t('Questa lingua esiste già'),
  unknown_locale: t('Questa lingua non è attiva: Impostazioni → Lingue'),
  session_required: t('Questa azione si fa dal pannello'),
  invalid_code: t('Il codice non è corretto'),
  challenge_expired: t('È passato troppo tempo: accedi di nuovo'),
  two_factor_required: t('Questo sito richiede la verifica in due passaggi'),
  two_factor_off: t('Prima attiva la verifica in due passaggi per te'),
  no_setup: t('Ricomincia l’attivazione'),
  backups_unavailable: t('Il database è ospitato da un fornitore: i backup li fa lui'),
  import_expired: t('È passato troppo tempo: leggi di nuovo il sito'),
})

function translate(code: string | undefined, fallback: string | undefined): string {
  return (code && messages()[code]) || fallback || t('Qualcosa è andato storto')
}

const q = (params: Record<string, string | number | undefined>) => {
  const s = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== '') s.set(k, String(v))
  const text = s.toString()
  return text ? `?${text}` : ''
}

export type UpdateState = UpdateStatus & { settings: UpdateSettings }

export interface SetupCheck {
  id: string
  label: string
  state: 'ok' | 'warn' | 'error'
  detail: string
}

/** Before the first account: what the installation needs to show. */
export type SetupStatus =
  | { needsSetup: false }
  | { needsSetup: true; needsToken: boolean; checks: SetupCheck[]; site: { name: string; locale: string } }

export const api = {
  setupStatus: () => request<SetupStatus>('GET', '/setup'),
  setup: (input: {
    email: string
    name: string
    password: string
    token?: string
    site?: { name?: string; locale?: string }
  }) => request<{ user: User }>('POST', '/setup', input),
  /** Either signed in, or a ticket for the second step (two-step verification). */
  login: (input: { email: string; password: string }) => request<SignIn>('POST', '/auth/login', input),
  verifyLogin: (input: { ticket: string; code: string }) =>
    request<{ user: User }>('POST', '/auth/login/verify', input),
  logout: () => request<{ ok: true }>('POST', '/auth/logout'),
  /** Whether "Password dimenticata?" can send an email (otherwise someone has to help). */
  recovery: () => request<{ mail: boolean }>('GET', '/auth/recovery'),
  forgot: (email: string) => request<{ ok: true; mail: boolean }>('POST', '/auth/forgot', { email }),
  me: () => request<{ user: User; needsTwoFactor?: boolean }>('GET', '/auth/me'),
  security: () => request<AccountSecurity>('GET', '/auth/security'),
  setupTwoFactor: () => request<{ secret: string; uri: string }>('POST', '/auth/2fa/setup'),
  enableTwoFactor: (code: string) => request<{ recoveryCodes: string[] }>('POST', '/auth/2fa/enable', { code }),
  disableTwoFactor: (password: string) => request<{ ok: true }>('POST', '/auth/2fa/disable', { password }),
  newRecoveryCodes: (password: string) =>
    request<{ recoveryCodes: string[] }>('POST', '/auth/2fa/recovery', { password }),
  endSession: (id: string) => request<{ ok: true }>('DELETE', `/auth/sessions/${encodeURIComponent(id)}`),
  endOtherSessions: () => request<{ ended: number }>('POST', '/auth/sessions/others'),
  siteSecurity: () => request<{ requireTwoFactor: boolean }>('GET', '/security'),
  saveSiteSecurity: (input: { requireTwoFactor: boolean }) =>
    request<{ requireTwoFactor: boolean }>('PUT', '/security', input),
  resetTwoFactor: (userId: string) => request<{ user: User }>('DELETE', `/users/${userId}/two-factor`),
  activity: (params: { group?: string; before?: number }) =>
    request<{ items: ActivityEntry[] }>('GET', `/activity${q(params)}`),
  securityOverview: () => request<{ checks: SecurityCheck[] }>('GET', '/security/overview'),
  tracking: () => request<{ tracking: TrackingSettings }>('GET', '/tracking'),
  updates: () => request<UpdateState>('GET', '/updates'),
  checkUpdates: () => request<UpdateState>('POST', '/updates/check'),
  installUpdate: (version: string) => request<UpdateState>('POST', '/updates/install', { version }),
  rollbackUpdate: () => request<UpdateState>('POST', '/updates/rollback'),
  saveUpdateSettings: (settings: UpdateSettings) => request<UpdateState>('PUT', '/updates/settings', settings),
  health: () => request<{ ok: boolean; version: string }>('GET', '/health'),
  saveTracking: (tracking: TrackingSettings) =>
    request<{ tracking: TrackingSettings }>('PUT', '/tracking', { tracking }),
  readWordPress: (input: { url: string; user?: string; password?: string; limit?: number } | File) => {
    if (input instanceof File) {
      const form = new FormData()
      form.set('file', input)
      return requestForm<WpAnalysis>('/import/wordpress/analyze', form)
    }
    return request<WpAnalysis>('POST', '/import/wordpress/analyze', input)
  },
  importWordPress: (token: string, plan: WpPlan) =>
    request<{ job: string }>('POST', '/import/wordpress/run', { token, plan }),
  importJob: (id: string) => request<WpProgress>('GET', `/import/jobs/${id}`),
  backups: () => request<BackupState>('GET', '/backups'),
  saveBackups: (input: { enabled: boolean; keep: number }) => request<BackupState>('PUT', '/backups', input),
  offsite: () => request<OffsiteState>('GET', '/backups/offsite'),
  saveOffsite: (input: OffsiteForm) =>
    request<OffsiteState & { recoveryKey?: string }>('PUT', '/backups/offsite', input),
  testOffsite: (input: OffsiteForm) =>
    request<{ ok: boolean; message?: string }>('POST', '/backups/offsite/test', input),
  runOffsite: () => request<OffsiteState>('POST', '/backups/offsite/run'),
  offsiteKey: (password: string) => request<{ recoveryKey: string }>('POST', '/backups/offsite/key', { password }),
  createBackup: () => request<{ backup: BackupFile }>('POST', '/backups'),
  removeBackup: (name: string) => request<{ ok: true }>('DELETE', `/backups/${encodeURIComponent(name)}`),
  schema: () => request<Schema>('GET', '/schema'),
  theme: () => request<{ theme: Theme }>('GET', '/theme'),
  fonts: () => request<{ items: FontInfo[] }>('GET', '/fonts'),
  components: () => request<{ components: Record<string, Component> }>('GET', '/components'),
  saveComponents: (components: Record<string, Component>) =>
    request<{ components: Record<string, Component> }>('PUT', '/components', { components }),
  /** Global sections, and the titles of the pages that use each one. */
  globals: (locale?: string) =>
    request<{ globals: Record<string, PageNode>; usage?: Record<string, string[]> }>('GET', `/globals${q({ locale })}`),
  languages: () =>
    request<{ locales: { default: string; available: string[] }; documents: Record<string, number> }>(
      'GET',
      '/locales',
    ),
  saveLanguages: (locales: { default: string; available: string[] }) =>
    request<{ locales: { default: string; available: string[] }; documents: Record<string, number> }>(
      'PUT',
      '/locales',
      locales,
    ),
  translations: (id: string) =>
    request<{ translations: Translation[]; missing: string[] }>('GET', `/documents/${id}/translations`),
  translate: (id: string, locale: string, translate: boolean) =>
    request<StoredDocument>('POST', `/documents/${id}/translations`, { locale, translate }),
  syncTranslation: (id: string, translate: boolean) =>
    request<{ document: StoredDocument; added: number }>('POST', `/documents/${id}/sync`, { translate }),
  comments: (docId: string) => request<{ items: PageComment[] }>('GET', `/documents/${docId}/comments`),
  addComment: (docId: string, input: { nodeId: string | null; body: string }) =>
    request<{ comment: PageComment }>('POST', `/documents/${docId}/comments`, input),
  resolveComment: (id: string, resolved: boolean) => request<{ ok: true }>('PATCH', `/comments/${id}`, { resolved }),
  removeComment: (id: string) => request<void>('DELETE', `/comments/${id}`),
  /** Holds (or asks for, or takes) the turn to edit a document from this tab. */
  turn: (docId: string, take = false) =>
    request<{
      mine: boolean
      holder: { name: string; since: string; self: boolean } | null
      takenBy?: string | null
    }>('POST', `/documents/${docId}/turn`, { tab: TAB, take }),
  /** Leaves the turn; works while the page is closing too. */
  leaveTurn: (docId: string) => {
    void fetch(`/api/documents/${docId}/turn?tab=${encodeURIComponent(TAB)}`, {
      method: 'DELETE',
      credentials: 'same-origin',
      keepalive: true,
      headers: { 'x-mz-tab': TAB, 'x-mz-lang': lang() },
    }).catch(() => {})
  },
  presence: (docId: string, selected: string | null) =>
    request<{ others: { id: string; name: string; selected: string | null }[] }>(
      'POST',
      `/documents/${docId}/presence`,
      { selected },
    ),
  mail: () => request<{ mail: MailSettings }>('GET', '/mail'),
  saveMail: (mail: MailSettings & { pass?: string | null }) =>
    request<{ mail: MailSettings }>('PUT', '/mail', { mail }),
  testMail: () => request<{ ok: boolean; to: string; message?: string; hint?: string }>('POST', '/mail/test'),
  mailDomain: (from: string, provider?: string) =>
    request<{ domain: string; checks: DomainCheck[] }>('POST', '/mail/domain', { from, provider }),
  /** usage: for administrators only. */
  ai: () => request<{ ai: AiSettings; usage?: AiUsage }>('GET', '/ai'),
  saveAi: (ai: Omit<AiSettings, 'ready' | 'hasKey' | 'envKey'> & { apiKey?: string | null }) =>
    request<{ ai: AiSettings }>('PUT', '/ai', { ai }),
  testAi: () => request<{ ok: true; reply: string }>('POST', '/ai/test'),
  aiText: (input: {
    action: TextAction
    text?: string
    instruction?: string
    src?: string
    locale?: string
    format?: 'plain' | 'rich'
    max?: number
  }) => request<{ text: string }>('POST', '/ai/text', input),
  tokens: () => request<{ tokens: ApiToken[] }>('GET', '/tokens'),
  createToken: (name: string) => request<{ token: string; record: ApiToken }>('POST', '/tokens', { name }),
  revokeToken: (id: string) => request<{ ok: true }>('DELETE', `/tokens/${id}`),
  /** A turn with the assistant: events arrive as the server sends them. */
  chat: (
    input: {
      chatId?: string
      message: string
      nodes: PageNode[]
      page: { title: string; collection: string; url?: string | null }
      selected?: string[]
      /** Reference pictures, base64. */
      images?: { mime: 'image/jpeg'; data: string }[]
    },
    onEvent: (e: ChatEvent) => void,
    signal?: AbortSignal,
  ) => streamEvents('/api/ai/chat', input, onEvent, signal),
  /** A request from the dashboard: the AI works on the site, in drafts only. */
  studio: (
    input: { runId?: string; message: string; images?: { mime: 'image/jpeg'; data: string }[] },
    onEvent: (e: StudioEvent) => void,
    signal?: AbortSignal,
  ) => streamEvents('/api/ai/studio', input, onEvent, signal),
  /** A first version of the site from a brief: new drafts, with theme and voice proposed. */
  buildSite: (
    input: {
      brief?: string
      runId?: string
      message?: string
      theme: boolean
      images?: { mime: 'image/jpeg'; data: string }[]
    },
    onEvent: (e: SiteEvent) => void,
    signal?: AbortSignal,
  ) => streamEvents('/api/ai/site', input, onEvent, signal),
  submissions: (params: SubmissionQuery = {}) =>
    request<{
      items: Submission[]
      total: number
      unread: number
      spam: number
      forms: { form: string; name: string; total: number }[]
    }>('GET', `/submissions${q(params)}`),
  markSubmission: (id: string, read: boolean) => request<{ ok: true }>('PATCH', `/submissions/${id}`, { read }),
  markSpam: (id: string, spam: boolean) => request<{ ok: true }>('PATCH', `/submissions/${id}`, { spam }),
  /** Address of a file sent with a message (downloaded, never opened in the panel). */
  submissionFile: (id: string, n: number) => `/api/submissions/${id}/files/${n}`,
  // A plain link sends no headers: the panel's language travels in the address.
  submissionsCsv: (params: SubmissionQuery = {}) => `/api/submissions/export.csv${q({ ...params, lang: lang() })}`,
  formsSettings: () => request<{ keepMonths: number | null; webhookSecret: string | null }>('GET', '/forms/settings'),
  saveFormsSettings: (keepMonths: number | null) =>
    request<{ keepMonths: number | null }>('PUT', '/forms/settings', { keepMonths }),
  removeSubmission: (id: string) => request<void>('DELETE', `/submissions/${id}`),
  templates: () => request<{ templates: Record<string, string> }>('GET', '/templates'),
  /** The AI reads the draft (as the editor holds it) and lists what to fix: nothing is changed. */
  review: (id: string, data: Data) => request<{ issues: ReviewIssue[] }>('POST', `/documents/${id}/review`, { data }),
  /** One suggestion applied to the draft, given back for the editor to take as one change. */
  applyReview: (id: string, data: Data, issue: Pick<ReviewIssue, 'slot' | 'find' | 'replace'>) =>
    request<{ data: Data }>('POST', `/documents/${id}/review/apply`, { data, ...issue }),
  voice: () => request<{ voice: BrandVoice }>('GET', '/voice'),
  saveVoice: (voice: BrandVoice) => request<{ voice: BrandVoice }>('PUT', '/voice', { voice }),
  /** A voice read by the AI from the texts already published: nothing is saved. */
  suggestVoice: () => request<{ voice: BrandVoice; texts: number }>('POST', '/voice/suggest'),
  seo: () => request<{ seo: SiteSeo }>('GET', '/seo'),
  saveSeo: (seo: SiteSeo) => request<{ seo: SiteSeo }>('PUT', '/seo', { seo }),
  redirects: () => request<{ redirects: Redirect[] }>('GET', '/redirects'),
  urls: () => request<{ urls: string[] }>('GET', '/urls'),
  editorial: () => request<{ editorial: { editorsContentOnly?: boolean } }>('GET', '/editorial'),
  saveEditorial: (editorial: { editorsContentOnly?: boolean }) =>
    request<{ editorial: { editorsContentOnly?: boolean } }>('PUT', '/editorial', { editorial }),
  saveRedirects: (redirects: Redirect[]) => request<{ redirects: Redirect[] }>('PUT', '/redirects', { redirects }),
  saveTemplates: (templates: Record<string, string>) =>
    request<{ templates: Record<string, string> }>('PUT', '/templates', { templates }),
  saveGlobals: (globals: Record<string, PageNode>, locale?: string) =>
    request<{ globals: Record<string, PageNode> }>('PUT', '/globals', { globals, locale }),
  entries: (collection: string, locale: string) =>
    request<{ items: (BoundEntry & { id: string })[] }>(
      'GET',
      `/collections/${collection}/entries${q({ locale, limit: 100 })}`,
    ),
  saveTheme: (theme: Theme) => request<{ theme: Theme }>('PUT', '/theme', { theme }),
  overview: (locale: string) => request<Overview>('GET', `/overview${q({ locale })}`),
  list: (collection: string, params: { locale?: string; search?: string; limit?: number; offset?: number }) =>
    request<{ items: DocumentSummary[]; total: number }>('GET', `/collections/${collection}${q(params)}`),
  create: (collection: string, data: Data, locale?: string) =>
    request<StoredDocument>('POST', `/collections/${collection}`, { data, locale }),
  get: (id: string) => request<StoredDocument>('GET', `/documents/${id}`),
  save: (id: string, data: Data) => request<StoredDocument>('PUT', `/documents/${id}`, { data }),
  publish: (id: string) => request<StoredDocument>('POST', `/documents/${id}/publish`),
  unpublish: (id: string) => request<StoredDocument>('POST', `/documents/${id}/unpublish`),
  /** When a document goes on (publish) or off (unpublish) the site by itself; null cancels. */
  schedule: (id: string, action: 'publish' | 'unpublish', at: Date | null) =>
    request<StoredDocument>('PUT', `/documents/${id}/schedule`, { action, at: at?.toISOString() ?? null }),
  subscribers: (params: { status?: Subscriber['status']; search?: string; limit?: number; offset?: number } = {}) =>
    request<{ items: Subscriber[]; total: number; counts: Record<Subscriber['status'], number> }>(
      'GET',
      `/subscribers${q(params)}`,
    ),
  addSubscriber: (input: { email: string; name?: string }) =>
    request<{ subscriber: Subscriber; mailed: boolean }>('POST', '/subscribers', input),
  removeSubscriber: (id: string) => request<void>('DELETE', `/subscribers/${id}`),
  importSubscribers: (csv: string) =>
    request<{ found: number; added: number; skipped: number; unsubscribed: number }>('POST', '/subscribers/import', {
      csv,
    }),
  subscribersCsv: () => `/api/subscribers/export.csv${q({ lang: lang() })}`,
  newsletterSettings: () => request<{ footer: string; tracking: boolean }>('GET', '/newsletter/settings'),
  saveNewsletterSettings: (input: { footer: string; tracking: boolean }) =>
    request<{ footer: string; tracking: boolean }>('PUT', '/newsletter/settings', input),
  newsletters: () => request<{ newsletters: Newsletter[] }>('GET', '/newsletters'),
  newsletter: (id: string) => request<Newsletter>('GET', `/newsletters/${id}`),
  createNewsletter: (input: { subject: string; preheader?: string; body?: RichText }) =>
    request<Newsletter>('POST', '/newsletters', input),
  newsletterFromDocument: (id: string) => request<Newsletter>('POST', '/newsletters/from-document', { id }),
  aiNewsletter: (input: { count?: number; note?: string }) => request<Newsletter>('POST', '/ai/newsletter', input),
  saveNewsletter: (id: string, input: { subject: string; preheader: string; body: RichText }) =>
    request<Newsletter>('PUT', `/newsletters/${id}`, input),
  removeNewsletter: (id: string) => request<void>('DELETE', `/newsletters/${id}`),
  testNewsletter: (id: string, to?: string) => request<{ ok: true }>('POST', `/newsletters/${id}/test`, { to }),
  sendNewsletter: (id: string) => request<Newsletter>('POST', `/newsletters/${id}/send`),
  scheduleNewsletter: (id: string, at: Date | null) =>
    request<Newsletter>('PUT', `/newsletters/${id}/schedule`, { at: at?.toISOString() ?? null }),
  releases: () => request<{ releases: Release[]; published: Release[] }>('GET', '/releases'),
  createRelease: (name: string) => request<Release>('POST', '/releases', { name }),
  renameRelease: (id: string, name: string) => request<Release>('PATCH', `/releases/${id}`, { name }),
  cancelRelease: (id: string) => request<void>('DELETE', `/releases/${id}`),
  putReleaseItem: (id: string, documentId: string, action: 'publish' | 'unpublish') =>
    request<Release>('PUT', `/releases/${id}/items/${documentId}`, { action }),
  removeReleaseItem: (id: string, documentId: string) =>
    request<Release>('DELETE', `/releases/${id}/items/${documentId}`),
  /** Everything goes out now, or nothing (the error says why). */
  publishRelease: (id: string) => request<Release>('POST', `/releases/${id}/publish`),
  scheduleRelease: (id: string, at: Date | null) =>
    request<Release>('PUT', `/releases/${id}/schedule`, { at: at?.toISOString() ?? null }),
  schedules: () =>
    request<{ items: (Schedule & { title: string; collection: string; locale: string })[] }>('GET', '/schedules'),
  previews: (id: string) => request<{ items: PreviewLink[] }>('GET', `/documents/${id}/previews`),
  /** days null: until someone revokes it. */
  sharePreview: (id: string, days: number | null) =>
    request<PreviewLink>('POST', `/documents/${id}/previews`, { days }),
  revokePreview: (id: string) => request<void>('DELETE', `/previews/${id}`),
  remove: (id: string) => request<void>('DELETE', `/documents/${id}`),
  revisions: (id: string) => request<{ items: Revision[] }>('GET', `/documents/${id}/revisions`),
  restore: (id: string, revision: string) =>
    request<StoredDocument>('POST', `/documents/${id}/revisions/${revision}/restore`),
  people: () => request<{ users: Member[]; invites: Invite[] }>('GET', '/users'),
  invite: (input: { email: string; name?: string; role: User['role'] }) =>
    request<{ invite: Invite; link: string; mailed?: boolean }>('POST', '/users/invites', input),
  revokeInvite: (id: string) => request<void>('DELETE', `/users/invites/${encodeURIComponent(id)}`),
  updateUser: (id: string, input: { role?: User['role']; name?: string; email?: string }) =>
    request<{ user: User }>('PATCH', `/users/${id}`, input),
  removeUser: (id: string) => request<void>('DELETE', `/users/${id}`),
  resetLink: (id: string) => request<{ invite: Invite; link: string; mailed?: boolean }>('POST', `/users/${id}/reset`),
  inviteInfo: (token: string) =>
    request<{ kind: Invite['kind']; email: string; name: string; role: User['role']; expiresAt: string; site: string }>(
      'GET',
      `/invites/${token}`,
    ),
  acceptInvite: (token: string, input: { name?: string; password: string }) =>
    request<SignIn>('POST', `/invites/${token}/accept`, input),
  updateMe: (input: { name?: string; locale?: 'it' | 'en' | null }) =>
    request<{ user: User }>('PATCH', '/auth/me', input),
  changeEmail: (input: { email: string; password: string }) => request<{ user: User }>('POST', '/auth/email', input),
  changePassword: (input: { current: string; next: string }) => request<{ ok: true }>('POST', '/auth/password', input),
  media: (params: { search?: string; limit?: number; offset?: number }) =>
    request<{ items: MediaAsset[]; total: number }>('GET', `/media${q(params)}`),
  mediaItem: (id: string) => request<MediaAsset>('GET', `/media/${id}`),
  updateMedia: (id: string, input: { alt: string }) => request<MediaAsset>('PATCH', `/media/${id}`, input),
  removeMedia: (id: string) => request<void>('DELETE', `/media/${id}`),
  /** Uploads one file, reporting progress from 0 to 1. */
  upload: (file: File, onProgress?: (fraction: number) => void) =>
    new Promise<MediaAsset>((resolve, reject) => {
      const xhr = new XMLHttpRequest()
      xhr.open('POST', '/api/media')
      xhr.responseType = 'json'
      xhr.setRequestHeader('x-mz-lang', lang())
      xhr.upload.onprogress = (e) => e.lengthComputable && onProgress?.(e.loaded / e.total)
      xhr.onload = () => (xhr.status < 300 ? resolve(xhr.response) : reject(errorFrom(xhr.status, xhr.response)))
      xhr.onerror = () => reject(new ApiError(0, 'offline', t('Caricamento interrotto: controlla la connessione')))
      const form = new FormData()
      form.set('file', file)
      xhr.send(form)
    }),
}

/** A lighter copy of a library image for previews (the server makes it on first request). */
export function thumb(src: string, width = 640): string {
  return src.startsWith('/media/') && !/\.(gif|glb)$/.test(src) ? `${src}@${width}.webp` : src
}
