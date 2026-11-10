import { createHash, createHmac } from 'node:crypto'
import { createReadStream, createWriteStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { t } from './t.ts'

/**
 * Storage outside the server for the backups: any S3-compatible service (Amazon S3, Cloudflare
 * R2, Backblaze B2, Hetzner, Scaleway, OVH, Wasabi, MinIO…) or a WebDAV folder (Nextcloud,
 * ownCloud, Synology and QNAP, pCloud, kDrive…). Written with fetch and node:crypto only.
 */

export interface S3Target {
  /** https://… of the service, without the bucket: https://<account>.r2.cloudflarestorage.com */
  endpoint: string
  region: string
  bucket: string
  accessKeyId: string
  secretAccessKey: string
}

export interface WebDavTarget {
  /** The folder the backups go in: https://cloud.example.com/remote.php/dav/files/nome/backup/ */
  url: string
  user: string
  password: string
}

export interface RemoteItem {
  key: string
  size: number
  modified: Date
}

export interface RemoteStorage {
  put(key: string, file: string): Promise<void>
  putText(key: string, text: string): Promise<void>
  get(key: string, file: string): Promise<void>
  getText(key: string): Promise<string>
  /** Everything under a folder of the storage ("database/", "media/"), with sizes. */
  list(prefix: string): Promise<RemoteItem[]>
  delete(key: string): Promise<void>
}

export class RemoteError extends Error {
  readonly status?: number
  constructor(message: string, status?: number) {
    super(message)
    this.status = status
  }
}

/** A human reason for an HTTP failure, the same for both kinds of storage. */
function failure(what: string, status: number, detail = ''): RemoteError {
  const why =
    status === 401 || status === 403
      ? t('accesso rifiutato: controlla le credenziali e i permessi')
      : status === 404
        ? t('non trovato: controlla l’indirizzo, il bucket o la cartella')
        : status === 409
          ? t('una cartella del percorso non esiste: crea almeno quella che contiene la cartella dei backup')
          : status === 507 || /QuotaExceeded|InsufficientStorage/i.test(detail)
            ? t('spazio esaurito')
            : t('il servizio ha risposto {status}', { status })
  const code = /<Code>([^<]+)<\/Code>/.exec(detail)?.[1]
  return new RemoteError(`${what}: ${why}${code ? ` (${code})` : ''}`, status)
}

async function reach(url: string, init: RequestInit & { duplex?: 'half' }): Promise<Response> {
  try {
    return await fetch(url, { ...init, signal: init.signal ?? AbortSignal.timeout(10 * 60_000) })
  } catch (error) {
    const cause = (error as { cause?: { code?: string } }).cause?.code
    throw new RemoteError(
      cause === 'ENOTFOUND'
        ? t('Il servizio {host} non si trova: controlla l’indirizzo', { host: new URL(url).host })
        : t('Il servizio non risponde ({cause})', { cause: cause ?? (error as Error).message }),
    )
  }
}

const fileBody = (file: string) => Readable.toWeb(createReadStream(file)) as ReadableStream

async function saveBody(res: Response, file: string) {
  if (!res.body) throw new RemoteError(t('Risposta vuota'))
  try {
    await pipeline(Readable.fromWeb(res.body as never), createWriteStream(file))
  } catch (error) {
    throw new RemoteError(t('Il download si è interrotto ({cause}): riprova', { cause: (error as Error).message }))
  }
}

// ---------- S3 ----------

const sha256 = (data: string | Buffer) => createHash('sha256').update(data).digest('hex')
const hmac = (key: Buffer | string, data: string) => createHmac('sha256', key).update(data).digest()
const EMPTY_HASH = sha256('')

/** RFC 3986 encoding, as Signature Version 4 wants it (keeps / in paths when asked). */
const encode = (text: string, slash = true) =>
  encodeURIComponent(text)
    .replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`)
    .replace(slash ? /%2F/g : /$^/, '/')

/**
 * A request signed with AWS Signature Version 4, which every S3-compatible service accepts. The
 * body is not hashed (UNSIGNED-PAYLOAD): files are streamed over HTTPS, as large as they are.
 */
export function signS3(
  target: S3Target,
  method: string,
  key: string,
  query: Record<string, string> = {},
  headers: Record<string, string> = {},
  now = new Date(),
  payloadHash = 'UNSIGNED-PAYLOAD',
): { url: string; headers: Record<string, string> } {
  const endpoint = new URL(target.endpoint)
  // Amazon wants the bucket in the host name; the others accept it in the path, which needs no DNS.
  const virtual = /\.amazonaws\.com$/i.test(endpoint.hostname)
  const host = virtual ? `${target.bucket}.${endpoint.host}` : endpoint.host
  const base = endpoint.pathname.replace(/\/+$/, '')
  // Listing the bucket: "/" on Amazon's host, "/bucket" in the path elsewhere.
  const bucketPath = `${base}${virtual ? '' : `/${encode(target.bucket)}`}`
  const path = key ? `${bucketPath}/${encode(key)}` : bucketPath || '/'
  const amzDate = now.toISOString().replace(/[-:]|\.\d{3}/g, '')
  const day = amzDate.slice(0, 8)
  const region = target.region || 'us-east-1'
  const all: Record<string, string> = {
    ...Object.fromEntries(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v])),
    host,
    'x-amz-content-sha256': payloadHash,
    'x-amz-date': amzDate,
  }
  const names = Object.keys(all).sort()
  const canonicalQuery = Object.keys(query)
    .sort()
    .map((k) => `${encode(k, false)}=${encode(query[k] ?? '', false)}`)
    .join('&')
  const canonical = [
    method,
    path,
    canonicalQuery,
    names.map((n) => `${n}:${String(all[n]).trim()}\n`).join(''),
    names.join(';'),
    payloadHash,
  ].join('\n')
  const scope = `${day}/${region}/s3/aws4_request`
  const toSign = ['AWS4-HMAC-SHA256', amzDate, scope, sha256(canonical)].join('\n')
  const signingKey = hmac(hmac(hmac(hmac(`AWS4${target.secretAccessKey}`, day), region), 's3'), 'aws4_request')
  const signature = createHmac('sha256', signingKey).update(toSign).digest('hex')
  all.authorization = `AWS4-HMAC-SHA256 Credential=${target.accessKeyId}/${scope}, SignedHeaders=${names.join(';')}, Signature=${signature}`
  delete all.host
  return { url: `${endpoint.protocol}//${host}${path}${canonicalQuery ? `?${canonicalQuery}` : ''}`, headers: all }
}

const xmlValue = (xml: string, tag: string) => new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`).exec(xml)?.[1] ?? ''
const unescapeXml = (s: string) =>
  s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')

export function createS3Storage(target: S3Target, prefix = ''): RemoteStorage {
  const full = (key: string) => `${prefix.replace(/^\/+|\/+$/g, '')}${prefix.trim() ? '/' : ''}${key}`
  const call = async (
    what: string,
    method: string,
    key: string,
    opts: { query?: Record<string, string>; headers?: Record<string, string>; body?: BodyInit; payload?: string } = {},
  ) => {
    const signed = signS3(target, method, key, opts.query, opts.headers, new Date(), opts.payload)
    const res = await reach(signed.url, {
      method,
      headers: signed.headers,
      body: opts.body,
      ...(opts.body instanceof ReadableStream ? { duplex: 'half' as const } : {}),
    })
    if (!res.ok && !(method === 'DELETE' && res.status === 404)) throw failure(what, res.status, await res.text())
    return res
  }
  return {
    async put(key, file) {
      const { size } = await stat(file)
      await call(t('Caricamento di {key}', { key }), 'PUT', full(key), {
        headers: { 'content-length': String(size), 'content-type': 'application/octet-stream' },
        body: fileBody(file),
      })
    },
    async putText(key, text) {
      const body = Buffer.from(text)
      await call(t('Caricamento di {key}', { key }), 'PUT', full(key), {
        headers: { 'content-length': String(body.length), 'content-type': 'text/plain; charset=utf-8' },
        body,
        payload: sha256(body),
      })
    },
    async get(key, file) {
      await saveBody(await call(t('Download di {key}', { key }), 'GET', full(key), { payload: EMPTY_HASH }), file)
    },
    async getText(key) {
      return (await call(t('Download di {key}', { key }), 'GET', full(key), { payload: EMPTY_HASH })).text()
    },
    async list(folder) {
      const items: RemoteItem[] = []
      const strip = full('').length
      let token = ''
      do {
        const query: Record<string, string> = { 'list-type': '2', prefix: full(folder) }
        if (token) query['continuation-token'] = token
        const xml = await (await call(t('Elenco dei file'), 'GET', '', { query, payload: EMPTY_HASH })).text()
        for (const block of xml.match(/<Contents>[\s\S]*?<\/Contents>/g) ?? [])
          items.push({
            key: unescapeXml(xmlValue(block, 'Key')).slice(strip),
            size: Number(xmlValue(block, 'Size')),
            modified: new Date(xmlValue(block, 'LastModified')),
          })
        token = xmlValue(xml, 'IsTruncated') === 'true' ? unescapeXml(xmlValue(xml, 'NextContinuationToken')) : ''
      } while (token)
      return items
    },
    async delete(key) {
      await call(t('Eliminazione di {key}', { key }), 'DELETE', full(key), { payload: EMPTY_HASH })
    },
  }
}

// ---------- WebDAV ----------

export function createWebDavStorage(target: WebDavTarget): RemoteStorage {
  const root = target.url.endsWith('/') ? target.url : `${target.url}/`
  const auth = `Basic ${Buffer.from(`${target.user}:${target.password}`).toString('base64')}`
  const url = (key: string) => new URL(key.split('/').map(encodeURIComponent).join('/'), root).toString()
  const made = new Set<string>()
  const call = async (what: string, method: string, key: string, init: RequestInit & { duplex?: 'half' } = {}) => {
    const res = await reach(url(key), { ...init, method, headers: { authorization: auth, ...init.headers } })
    if (!res.ok && !(method === 'DELETE' && res.status === 404)) throw failure(what, res.status, await res.text())
    return res
  }
  /** The folders of a path, one by one, the backup folder itself first: WebDAV does not make them. */
  const folders = async (key: string) => {
    if (!made.has('')) {
      const res = await reach(root, { method: 'MKCOL', headers: { authorization: auth } })
      if (!res.ok && res.status !== 405)
        throw failure(t('Creazione della cartella dei backup'), res.status, await res.text())
      made.add('')
    }
    const parts = key.split('/').slice(0, -1)
    for (let i = 1; i <= parts.length; i++) {
      const dir = `${parts.slice(0, i).join('/')}/`
      if (made.has(dir)) continue
      const res = await reach(url(dir), { method: 'MKCOL', headers: { authorization: auth } })
      // 405: it exists already.
      if (!res.ok && res.status !== 405)
        throw failure(t('Creazione della cartella {dir}', { dir }), res.status, await res.text())
      made.add(dir)
    }
  }
  return {
    async put(key, file) {
      await folders(key)
      const { size } = await stat(file)
      await call(t('Caricamento di {key}', { key }), 'PUT', key, {
        headers: { 'content-length': String(size), 'content-type': 'application/octet-stream' },
        body: fileBody(file),
        duplex: 'half',
      })
    },
    async putText(key, text) {
      await folders(key)
      await call(t('Caricamento di {key}', { key }), 'PUT', key, {
        headers: { 'content-type': 'text/plain; charset=utf-8' },
        body: text,
      })
    },
    async get(key, file) {
      await saveBody(await call(t('Download di {key}', { key }), 'GET', key), file)
    },
    async getText(key) {
      return (await call(t('Download di {key}', { key }), 'GET', key)).text()
    },
    async list(folder) {
      const items: RemoteItem[] = []
      const rootPath = decodeURIComponent(new URL(root).pathname)
      const walk = async (dir: string) => {
        const res = await reach(url(dir), {
          method: 'PROPFIND',
          headers: { authorization: auth, depth: '1', 'content-type': 'application/xml' },
          body: '<?xml version="1.0"?><d:propfind xmlns:d="DAV:"><d:prop><d:getcontentlength/><d:getlastmodified/><d:resourcetype/></d:prop></d:propfind>',
        })
        if (res.status === 404) return
        if (!res.ok) throw failure(t('Elenco dei file'), res.status, await res.text())
        const xml = await res.text()
        // Namespaces differ between servers (d:, D:, none): matched by local name.
        for (const block of xml.match(/<(?:\w+:)?response[\s>][\s\S]*?<\/(?:\w+:)?response>/g) ?? []) {
          const href = /<(?:\w+:)?href>([^<]+)</.exec(block)?.[1] ?? ''
          const path = decodeURIComponent(new URL(href, root).pathname)
          if (!path.startsWith(rootPath)) continue
          const key = path.slice(rootPath.length)
          if (!key || key === dir) continue
          // A folder: <d:collection/>, also with attributes (rclone), or an address ending in "/".
          if (/<(?:\w+:)?collection[\s/>]/.test(block) || key.endsWith('/')) {
            await walk(key.endsWith('/') ? key : `${key}/`)
            continue
          }
          items.push({
            key,
            size: Number(/<(?:\w+:)?getcontentlength>(\d+)</.exec(block)?.[1] ?? 0),
            modified: new Date(/<(?:\w+:)?getlastmodified>([^<]+)</.exec(block)?.[1] ?? 0),
          })
        }
      }
      await walk(folder)
      return items
    },
    async delete(key) {
      await call(t('Eliminazione di {key}', { key }), 'DELETE', key)
    },
  }
}
