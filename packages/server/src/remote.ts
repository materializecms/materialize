import { lookup } from 'node:dns/promises'
import { isIP } from 'node:net'
import { t } from './t.ts'

/**
 * Raised when a remote file cannot be fetched: the message says why, in words (in the reader's
 * language); `reason` says it to code.
 */
export class RemoteError extends Error {
  readonly reason?: 'too_large'
  constructor(message: string, reason?: 'too_large') {
    super(message)
    this.reason = reason
  }
}

/** Loopback, private, link-local and other addresses a public file never lives at. */
function isPrivate(address: string): boolean {
  if (isIP(address) === 6) {
    const a = address.toLowerCase()
    if (a.startsWith('::ffff:')) return isPrivate(a.slice(7))
    return a === '::1' || a === '::' || a.startsWith('fc') || a.startsWith('fd') || a.startsWith('fe80')
  }
  const [x = 0, y = 0] = address.split('.').map(Number)
  return (
    x === 10 ||
    x === 127 ||
    x === 0 ||
    (x === 169 && y === 254) ||
    (x === 172 && y >= 16 && y <= 31) ||
    (x === 192 && y === 168) ||
    (x === 100 && y >= 64 && y <= 127) ||
    x >= 224
  )
}

export interface RemoteResponse {
  status: number
  headers: Headers
  bytes: Buffer
  type: string
  /** The file name at the final address (after redirects). */
  name: string
  url: string
}

/**
 * Fetches from the web: http(s) only, redirects checked one by one, at most `max` bytes. Addresses
 * on this machine or its network are refused, unless `allowPrivate` (an administrator importing
 * from a WordPress on their own network). Headers are sent to the first host only.
 */
export async function remoteFetch(
  url: string,
  options: { max: number; headers?: Record<string, string>; allowPrivate?: boolean; timeout?: number },
): Promise<RemoteResponse> {
  let current = new URL(url)
  const origin = current.origin
  for (let hop = 0; hop < 5; hop++) {
    if (current.protocol !== 'https:' && current.protocol !== 'http:')
      throw new RemoteError(t('Solo indirizzi http e https'))
    if (!options.allowPrivate) {
      const host = current.hostname.replace(/^\[|\]$/g, '')
      const addresses = isIP(host) ? [host] : (await lookup(host, { all: true })).map((a) => a.address)
      if (!addresses.length || addresses.some(isPrivate)) throw new RemoteError(t('Questo indirizzo non è pubblico'))
    }
    const res = await fetch(current, {
      redirect: 'manual',
      headers: current.origin === origin ? options.headers : undefined,
      signal: AbortSignal.timeout(options.timeout ?? 15_000),
    })
    if (res.status >= 300 && res.status < 400) {
      const to = res.headers.get('location')
      if (!to) throw new RemoteError(t('Reindirizzamento senza destinazione ({status})', { status: res.status }))
      current = new URL(to, current)
      continue
    }
    const type = (res.headers.get('content-type') ?? '').split(';')[0]?.trim() ?? ''
    if (Number(res.headers.get('content-length') ?? 0) > options.max)
      throw new RemoteError(t('Il file è troppo grande'), 'too_large')
    const chunks: Buffer[] = []
    let size = 0
    for await (const chunk of res.body ?? []) {
      size += chunk.length
      if (size > options.max) throw new RemoteError(t('Il file è troppo grande'), 'too_large')
      chunks.push(Buffer.from(chunk))
    }
    const name = decodeURIComponent(current.pathname.split('/').pop() || 'immagine')
    return { status: res.status, headers: res.headers, bytes: Buffer.concat(chunks), type, name, url: current.href }
  }
  throw new RemoteError(t('Troppi reindirizzamenti'))
}

/**
 * Downloads a public file (an image an AI found on the web): http(s) only, never to an address on
 * this machine or its network, redirects checked one by one, at most `max` bytes.
 */
export async function fetchPublicFile(
  url: string,
  max: number,
): Promise<{ bytes: Buffer; type: string; name: string }> {
  const res = await remoteFetch(url, { max })
  if (res.status < 200 || res.status >= 300)
    throw new RemoteError(t('Il server ha risposto {status}', { status: res.status }))
  return { bytes: res.bytes, type: res.type, name: res.name }
}
