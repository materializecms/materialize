import { lookup as dnsLookup, type LookupAddress } from 'node:dns'
import { request as httpRequest, type IncomingMessage } from 'node:http'
import { request as httpsRequest } from 'node:https'
import { isIP, type LookupFunction } from 'node:net'
import type { Readable } from 'node:stream'
import { createBrotliDecompress, createGunzip, createInflate } from 'node:zlib'
import { t } from './t.ts'

/**
 * Raised when a remote file cannot be fetched: the message says why, in words (in the reader's
 * language); `reason` says it to code.
 */
export class RemoteError extends Error {
  readonly reason?: 'too_large' | 'private'
  constructor(message: string, reason?: 'too_large' | 'private') {
    super(message)
    this.reason = reason
  }
}

/** The four numbers of an IPv4 address written the usual way, or null. */
function ipv4Parts(address: string): number[] | null {
  const parts = address.split('.')
  if (parts.length !== 4 || parts.some((p) => !/^\d{1,3}$/.test(p) || Number(p) > 255)) return null
  return parts.map(Number)
}

/** Loopback, private, shared, link-local, test and multicast IPv4 ranges: no public file lives there. */
function privateV4([a = 0, b = 0, c = 0]: number[]): boolean {
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 0 && (c === 0 || c === 2)) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19)) ||
    (a === 198 && b === 51 && c === 100) ||
    (a === 203 && b === 0 && c === 113) ||
    a >= 224
  )
}

/**
 * The eight 16-bit groups of an IPv6 address, with "::" filled in and a dotted IPv4 tail
 * (::ffff:1.2.3.4) turned into its two groups; null when it is not one.
 */
function ipv6Groups(address: string): number[] | null {
  let a = address.toLowerCase().replace(/^\[|\]$/g, '')
  const zone = a.indexOf('%')
  if (zone >= 0) a = a.slice(0, zone)
  if (a.includes('.')) {
    const at = a.lastIndexOf(':')
    const v4 = ipv4Parts(a.slice(at + 1))
    if (!v4) return null
    a = `${a.slice(0, at + 1)}${(((v4[0] ?? 0) << 8) | (v4[1] ?? 0)).toString(16)}:${(((v4[2] ?? 0) << 8) | (v4[3] ?? 0)).toString(16)}`
  }
  const halves = a.split('::')
  if (halves.length > 2) return null
  const read = (s: string) => (s ? s.split(':') : [])
  const head = read(halves[0] ?? '')
  const tail = read(halves[1] ?? '')
  const missing = 8 - head.length - tail.length
  if (halves.length === 1 ? missing !== 0 : missing < 1) return null
  const groups = [...head, ...Array<string>(halves.length === 2 ? missing : 0).fill('0'), ...tail]
  if (groups.some((g) => !/^[0-9a-f]{1,4}$/.test(g))) return null
  return groups.map((g) => Number.parseInt(g, 16))
}

/** The IPv4 address carried in two IPv6 groups. */
const v4Of = (hi: number, lo: number) => [hi >> 8, hi & 0xff, lo >> 8, lo & 0xff]

/**
 * Loopback, private, link-local and other addresses a public file never lives at. IPv6 is read
 * group by group, so the same IPv4 address cannot slip through written another way (mapped as
 * ::ffff:7f00:1, compatible, NAT64, 6to4). Anything that is not an address counts as private.
 */
export function isPrivate(address: string): boolean {
  const v4 = ipv4Parts(address)
  if (v4) return privateV4(v4)
  const g = ipv6Groups(address)
  if (!g) return true
  const [g0 = 0, g1 = 0, g2 = 0, g3 = 0, g4 = 0, g5 = 0, g6 = 0, g7 = 0] = g
  const zeros = (...xs: number[]) => xs.every((x) => x === 0)
  // ::, ::1 and the old IPv4-compatible ::a.b.c.d, which no public server uses.
  if (zeros(g0, g1, g2, g3, g4, g5)) return true
  // IPv4 inside (::ffff:a.b.c.d, ::ffff:0:a.b.c.d): judged as that IPv4.
  if (zeros(g0, g1, g2, g3, g4) && g5 === 0xffff) return privateV4(v4Of(g6, g7))
  if (zeros(g0, g1, g2, g3) && g4 === 0xffff && g5 === 0) return privateV4(v4Of(g6, g7))
  // NAT64 (64:ff9b::/96 carries an IPv4; 64:ff9b:1::/48 is for local networks).
  if (g0 === 0x64 && g1 === 0xff9b) return g2 === 1 || !zeros(g2, g3, g4, g5) || privateV4(v4Of(g6, g7))
  // 6to4: the IPv4 sits in the second and third groups.
  if (g0 === 0x2002) return privateV4(v4Of(g1, g2))
  // Teredo (its IPv4 is scrambled) and the documentation range: never a real public file.
  if (g0 === 0x2001 && (g1 === 0 || g1 === 0xdb8)) return true
  // Discard-only (100::/64).
  if (g0 === 0x100 && zeros(g1, g2, g3)) return true
  return (
    (g0 & 0xfe00) === 0xfc00 || // unique local
    (g0 & 0xffc0) === 0xfe80 || // link-local
    (g0 & 0xffc0) === 0xfec0 || // site-local (old)
    (g0 & 0xff00) === 0xff00 // multicast
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

export interface RemoteOptions {
  max: number
  headers?: Record<string, string>
  allowPrivate?: boolean
  timeout?: number
  method?: 'GET' | 'POST'
  body?: string
  /** Redirects followed before giving up; 0 refuses any (a webhook must answer where it was set). */
  maxRedirects?: number
}

/**
 * Resolves a name and refuses it when any of its addresses is private: run by the connection
 * itself, so the address checked is the one connected to (a name cannot answer with a public
 * address to the check and a private one a moment later).
 */
const publicLookup: LookupFunction = (hostname, options, callback) => {
  dnsLookup(hostname, { ...options, all: true }, (error, found: LookupAddress[]) => {
    if (error) return callback(error, '', 0)
    if (!found.length || found.some((a) => isPrivate(a.address)))
      return callback(new RemoteError(t('Questo indirizzo non è pubblico'), 'private'), '', 0)
    if (options.all) return callback(null, found)
    const first = found[0] as LookupAddress
    callback(null, first.address, first.family)
  })
}

/** Turns Node's response headers into the Headers callers read. */
function headersOf(res: IncomingMessage): Headers {
  const out = new Headers()
  for (const [k, v] of Object.entries(res.headers)) {
    if (v === undefined) continue
    for (const one of Array.isArray(v) ? v : [v]) out.append(k, one)
  }
  return out
}

/** One request, one answer: no redirects followed here. */
function send(url: URL, options: RemoteOptions, headers: Record<string, string> | undefined): Promise<IncomingMessage> {
  return new Promise((resolve, reject) => {
    const req = (url.protocol === 'https:' ? httpsRequest : httpRequest)(url, {
      method: options.method ?? 'GET',
      headers: {
        ...headers,
        ...(options.body !== undefined ? { 'content-length': String(Buffer.byteLength(options.body)) } : {}),
      },
      ...(options.allowPrivate ? {} : { lookup: publicLookup }),
      signal: AbortSignal.timeout(options.timeout ?? 15_000),
    })
    req.on('response', resolve)
    req.on('error', reject)
    req.end(options.body)
  })
}

/** The body as sent, uncompressed when the server compressed it anyway. */
function decoded(res: IncomingMessage): Readable {
  const encoding = (res.headers['content-encoding'] ?? '').toLowerCase().trim()
  if (encoding === 'gzip' || encoding === 'x-gzip') return res.pipe(createGunzip())
  if (encoding === 'deflate') return res.pipe(createInflate())
  if (encoding === 'br') return res.pipe(createBrotliDecompress())
  return res
}

/**
 * Fetches from the web: http(s) only, redirects checked one by one, at most `max` bytes. Addresses
 * on this machine or its network are refused, unless `allowPrivate` (an administrator importing
 * from a WordPress on their own network), and checked when connecting, not before. Headers are
 * sent to the first host only.
 */
export async function remoteFetch(url: string, options: RemoteOptions): Promise<RemoteResponse> {
  let current = new URL(url)
  const origin = current.origin
  const hops = (options.maxRedirects ?? 4) + 1
  for (let hop = 0; hop < hops; hop++) {
    if (current.protocol !== 'https:' && current.protocol !== 'http:')
      throw new RemoteError(t('Solo indirizzi http e https'))
    // An address written as numbers never goes through the lookup: it is checked here.
    const host = current.hostname.replace(/^\[|\]$/g, '')
    if (!options.allowPrivate && isIP(host) && isPrivate(host))
      throw new RemoteError(t('Questo indirizzo non è pubblico'), 'private')
    let res: IncomingMessage
    try {
      res = await send(current, options, current.origin === origin ? options.headers : undefined)
    } catch (error) {
      // The refusal from the lookup may come back wrapped by the connection: said the same way.
      if (error instanceof RemoteError) throw error
      if ((error as { cause?: unknown }).cause instanceof RemoteError) throw (error as { cause: RemoteError }).cause
      throw error
    }
    const status = res.statusCode ?? 0
    if (status >= 300 && status < 400) {
      res.resume()
      const to = res.headers.location
      if (!to) throw new RemoteError(t('Reindirizzamento senza destinazione ({status})', { status }))
      current = new URL(to, current)
      continue
    }
    const type = (res.headers['content-type'] ?? '').split(';')[0]?.trim() ?? ''
    if (Number(res.headers['content-length'] ?? 0) > options.max) {
      res.destroy()
      throw new RemoteError(t('Il file è troppo grande'), 'too_large')
    }
    const chunks: Buffer[] = []
    let size = 0
    const stream = decoded(res)
    try {
      for await (const chunk of stream) {
        size += (chunk as Buffer).length
        // Counted after decompressing: a small compressed answer cannot fill the memory.
        if (size > options.max) throw new RemoteError(t('Il file è troppo grande'), 'too_large')
        chunks.push(chunk as Buffer)
      }
    } finally {
      if (size > options.max) {
        stream.destroy()
        res.destroy()
      }
    }
    const name = decodeURIComponent(current.pathname.split('/').pop() || 'immagine')
    return { status, headers: headersOf(res), bytes: Buffer.concat(chunks), type, name, url: current.href }
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
