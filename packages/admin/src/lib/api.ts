import type { CollectionDescription, FieldDescription, ValidationIssue } from '@materializecms/core'
import type { BoundEntry, Component, PageNode, Theme } from '@materializecms/core/page'

export type { CollectionDescription, FieldDescription, ValidationIssue }

export type DocumentStatus = 'draft' | 'published' | 'changed'
export type Data = Record<string, unknown>

export interface User {
  id: string
  email: string
  name: string
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
}

export interface FontInfo {
  id: string
  family: string
  category: string
  weights: number[]
  styles: string[]
  variable: boolean
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
  too_many_attempts: 'Troppi tentativi. Riprova tra un minuto',
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
  login: (input: { email: string; password: string }) => request<{ user: User }>('POST', '/auth/login', input),
  logout: () => request<{ ok: true }>('POST', '/auth/logout'),
  me: () => request<{ user: User }>('GET', '/auth/me'),
  schema: () => request<Schema>('GET', '/schema'),
  theme: () => request<{ theme: Theme }>('GET', '/theme'),
  fonts: () => request<{ items: FontInfo[] }>('GET', '/fonts'),
  components: () => request<{ components: Record<string, Component> }>('GET', '/components'),
  saveComponents: (components: Record<string, Component>) =>
    request<{ components: Record<string, Component> }>('PUT', '/components', { components }),
  globals: () => request<{ globals: Record<string, PageNode> }>('GET', '/globals'),
  saveGlobals: (globals: Record<string, PageNode>) =>
    request<{ globals: Record<string, PageNode> }>('PUT', '/globals', { globals }),
  entries: (collection: string, locale: string) =>
    request<{ items: (BoundEntry & { id: string })[] }>('GET', `/collections/${collection}/entries${q({ locale })}`),
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
    request<{ invite: Invite; link: string }>('POST', '/users/invites', input),
  revokeInvite: (id: string) => request<void>('DELETE', `/users/invites/${encodeURIComponent(id)}`),
  updateUser: (id: string, input: { role?: User['role']; name?: string }) =>
    request<{ user: User }>('PATCH', `/users/${id}`, input),
  removeUser: (id: string) => request<void>('DELETE', `/users/${id}`),
  resetLink: (id: string) => request<{ invite: Invite; link: string }>('POST', `/users/${id}/reset`),
  inviteInfo: (token: string) =>
    request<{ kind: Invite['kind']; email: string; name: string; role: User['role']; expiresAt: string; site: string }>(
      'GET',
      `/invites/${token}`,
    ),
  acceptInvite: (token: string, input: { name?: string; password: string }) =>
    request<{ user: User }>('POST', `/invites/${token}/accept`, input),
  updateMe: (input: { name: string }) => request<{ user: User }>('PATCH', '/auth/me', input),
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
