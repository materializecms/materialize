import { lookup } from 'node:dns/promises'
import { isIP } from 'node:net'

/** Raised when a remote file cannot be fetched: the message says why, in words. */
export class RemoteError extends Error {}

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

/**
 * Downloads a public file (an image an AI found on the web): http(s) only, never to an address on
 * this machine or its network, redirects checked one by one, at most `max` bytes.
 */
export async function fetchPublicFile(
  url: string,
  max: number,
): Promise<{ bytes: Buffer; type: string; name: string }> {
  let current = new URL(url)
  for (let hop = 0; hop < 4; hop++) {
    if (current.protocol !== 'https:' && current.protocol !== 'http:')
      throw new RemoteError('Only http and https addresses')
    const host = current.hostname.replace(/^\[|\]$/g, '')
    const addresses = isIP(host) ? [host] : (await lookup(host, { all: true })).map((a) => a.address)
    if (!addresses.length || addresses.some(isPrivate)) throw new RemoteError('This address is not public')
    const res = await fetch(current, { redirect: 'manual', signal: AbortSignal.timeout(15_000) })
    if (res.status >= 300 && res.status < 400) {
      const to = res.headers.get('location')
      if (!to) throw new RemoteError(`Redirect without a destination (${res.status})`)
      current = new URL(to, current)
      continue
    }
    if (!res.ok) throw new RemoteError(`The server answered ${res.status}`)
    const type = (res.headers.get('content-type') ?? '').split(';')[0]?.trim() ?? ''
    if (Number(res.headers.get('content-length') ?? 0) > max) throw new RemoteError('The file is too large')
    const chunks: Buffer[] = []
    let size = 0
    for await (const chunk of res.body ?? []) {
      size += chunk.length
      if (size > max) throw new RemoteError('The file is too large')
      chunks.push(Buffer.from(chunk))
    }
    const name = decodeURIComponent(current.pathname.split('/').pop() || 'immagine')
    return { bytes: Buffer.concat(chunks), type, name }
  }
  throw new RemoteError('Too many redirects')
}
