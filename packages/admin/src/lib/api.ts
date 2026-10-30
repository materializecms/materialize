import type { CollectionDescription, FieldDescription, ValidationIssue } from '@materializecms/core'
import type { BoundEntry, Component, PageNode, Theme } from '@materializecms/core/page'
import type { Redirect, SiteSeo } from '@materializecms/core/seo'

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
}

export interface Revision {
  id: string
  kind: 'save' | 'publish' | 'restore'
  data: Data
  createdAt: string
  authorId: string | null
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

export interface MailSettings {
  host: string
  port: number
  security: 'tls' | 'starttls' | 'none'
  user: string
  from: string
  to: string
  /** A password is saved (it is never sent back). */
  hasPassword?: boolean
}

/** The AI behind the assistant and the text actions: the key never comes back. */
export interface AiSettings {
  provider: 'anthropic' | 'openai'
  baseUrl: string
  model: string
  hasKey?: boolean
  /** The server has ANTHROPIC_API_KEY in its environment. */
  envKey?: boolean
  ready: boolean
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
  page: string
  data: Record<string, string>
  read: boolean
  mailed: boolean
  createdAt: string
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

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  let res: Response
  try {
    res = await fetch(`/api${path}`, {
      method,
      credentials: 'same-origin',
      headers: body === undefined ? undefined : { 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch {
    throw new ApiError(0, 'offline', 'Il server non risponde. Controlla che materialize dev sia attivo.')
  }
  if (res.status === 204) return undefined as T
  const json = await res.json().catch(() => null)
  if (!res.ok) throw errorFrom(res.status, json)
  return json as T
}

// The API speaks English; the admin speaks to editors in Italian.
const MESSAGES: Record<string, string> = {
  invalid_credentials: 'Email o password non corretti',
  unauthenticated: 'Accedi per continuare',
  forbidden: 'Solo gli amministratori possono farlo',
  invalid_content: 'Alcuni campi vanno sistemati',
  invalid_request: 'Controlla i dati inseriti',
  slug_taken: 'Questo indirizzo è già usato da un altro documento',
  singleton_exists: 'Questo documento esiste già',
  already_set_up: 'Un amministratore esiste già',
  not_found: 'Documento non trovato',
  file_too_large: 'Il file è troppo grande: al massimo 25 MB',
  missing_file: 'Nessun file ricevuto',
  email_taken: 'Questo indirizzo ha già un account',
  last_admin: 'Serve almeno un amministratore: nomina prima qualcun altro',
  remove_self: 'Non puoi rimuovere te stesso',
  invalid_link: 'Il link non è valido o è scaduto: chiedine uno nuovo a chi ti ha invitato',
  wrong_password: 'La password attuale non è corretta',
  mail_not_configured: 'Prima configura l’invio delle email: server e mittente',
  ai_not_configured: 'L’AI non è configurata: Impostazioni → AI e MCP',
  translation_exists: 'Questa lingua esiste già',
  unknown_locale: 'Questa lingua non è attiva: Impostazioni → Lingue',
  session_required: 'Questa azione si fa dal pannello',
  invalid_code: 'Il codice non è corretto',
  challenge_expired: 'È passato troppo tempo: accedi di nuovo',
  two_factor_required: 'Questo sito richiede la verifica in due passaggi',
  two_factor_off: 'Prima attiva la verifica in due passaggi per te',
  no_setup: 'Ricomincia l’attivazione',
}

function translate(code: string | undefined, fallback: string | undefined): string {
  return (code && MESSAGES[code]) || fallback || 'Qualcosa è andato storto'
}

const q = (params: Record<string, string | number | undefined>) => {
  const s = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== '') s.set(k, String(v))
  const text = s.toString()
  return text ? `?${text}` : ''
}

export const api = {
  setupStatus: () => request<{ needsSetup: boolean }>('GET', '/setup'),
  setup: (input: { email: string; name: string; password: string }) => request<{ user: User }>('POST', '/setup', input),
  /** Either signed in, or a ticket for the second step (two-step verification). */
  login: (input: { email: string; password: string }) => request<SignIn>('POST', '/auth/login', input),
  verifyLogin: (input: { ticket: string; code: string }) =>
    request<{ user: User }>('POST', '/auth/login/verify', input),
  logout: () => request<{ ok: true }>('POST', '/auth/logout'),
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
  presence: (docId: string, selected: string | null) =>
    request<{ others: { id: string; name: string; selected: string | null }[] }>(
      'POST',
      `/documents/${docId}/presence`,
      { selected },
    ),
  mail: () => request<{ mail: MailSettings }>('GET', '/mail'),
  saveMail: (mail: MailSettings & { pass?: string | null }) =>
    request<{ mail: MailSettings }>('PUT', '/mail', { mail }),
  testMail: () => request<{ ok: true; to: string }>('POST', '/mail/test'),
  ai: () => request<{ ai: AiSettings }>('GET', '/ai'),
  saveAi: (ai: Omit<AiSettings, 'ready' | 'hasKey' | 'envKey'> & { apiKey?: string | null }) =>
    request<{ ai: AiSettings }>('PUT', '/ai', { ai }),
  testAi: () => request<{ ok: true; reply: string }>('POST', '/ai/test'),
  aiText: (input: { action: TextAction; text?: string; instruction?: string; src?: string; locale?: string }) =>
    request<{ text: string }>('POST', '/ai/text', input),
  tokens: () => request<{ tokens: ApiToken[] }>('GET', '/tokens'),
  createToken: (name: string) => request<{ token: string; record: ApiToken }>('POST', '/tokens', { name }),
  revokeToken: (id: string) => request<{ ok: true }>('DELETE', `/tokens/${id}`),
  /** A turn with the assistant: events arrive as the server sends them. */
  chat: async (
    input: {
      chatId?: string
      message: string
      nodes: PageNode[]
      page: { title: string; collection: string; url?: string | null }
      selected?: string[]
    },
    onEvent: (e: ChatEvent) => void,
    signal?: AbortSignal,
  ) => {
    let res: Response
    try {
      res = await fetch('/api/ai/chat', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(input),
        signal,
      })
    } catch (error) {
      if ((error as Error).name === 'AbortError') throw error
      throw new ApiError(0, 'offline', 'Il server non risponde. Controlla che materialize dev sia attivo.')
    }
    if (!res.ok || !res.body) throw errorFrom(res.status, await res.json().catch(() => null))
    // Server-sent events: "data: {...}" lines, a blank line after each.
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
        if (data) onEvent(JSON.parse(data) as ChatEvent)
        end = buffer.indexOf('\n\n')
      }
    }
  },
  submissions: (params: { limit?: number; offset?: number } = {}) =>
    request<{ items: Submission[]; total: number; unread: number }>('GET', `/submissions${q(params)}`),
  markSubmission: (id: string, read: boolean) => request<{ ok: true }>('PATCH', `/submissions/${id}`, { read }),
  removeSubmission: (id: string) => request<void>('DELETE', `/submissions/${id}`),
  templates: () => request<{ templates: Record<string, string> }>('GET', '/templates'),
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
  updateMe: (input: { name: string }) => request<{ user: User }>('PATCH', '/auth/me', input),
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
      xhr.upload.onprogress = (e) => e.lengthComputable && onProgress?.(e.loaded / e.total)
      xhr.onload = () => (xhr.status < 300 ? resolve(xhr.response) : reject(errorFrom(xhr.status, xhr.response)))
      xhr.onerror = () => reject(new ApiError(0, 'offline', 'Caricamento interrotto: controlla la connessione'))
      const form = new FormData()
      form.set('file', file)
      xhr.send(form)
    }),
}

/** A lighter copy of a library image for previews (the server makes it on first request). */
export function thumb(src: string, width = 640): string {
  return src.startsWith('/media/') && !/\.(gif|glb)$/.test(src) ? `${src}@${width}.webp` : src
}
