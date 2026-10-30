import { createHmac, randomBytes, randomInt, timingSafeEqual } from 'node:crypto'

/**
 * Two-step verification with an authenticator app (Google Authenticator, 1Password, Authy…):
 * time-based one-time passwords as in RFC 6238, 6 digits every 30 seconds, from Node's crypto.
 */

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
const PERIOD = 30

function base32(bytes: Buffer): string {
  let bits = 0
  let value = 0
  let out = ''
  for (const byte of bytes) {
    value = (value << 8) | byte
    bits += 8
    while (bits >= 5) {
      out += ALPHABET[(value >>> (bits - 5)) & 31]
      bits -= 5
    }
  }
  if (bits > 0) out += ALPHABET[(value << (5 - bits)) & 31]
  return out
}

function fromBase32(text: string): Buffer {
  let bits = 0
  let value = 0
  const out: number[] = []
  for (const char of text.replace(/=+$/, '').toUpperCase()) {
    const index = ALPHABET.indexOf(char)
    if (index < 0) continue
    value = (value << 5) | index
    bits += 5
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255)
      bits -= 8
    }
  }
  return Buffer.from(out)
}

/** A new secret: 160 random bits, in the base32 the apps read. */
export const newSecret = () => base32(randomBytes(20))

export const stepAt = (time = Date.now()) => Math.floor(time / 1000 / PERIOD)

export function codeAt(secret: string, step: number): string {
  const counter = Buffer.alloc(8)
  counter.writeBigUInt64BE(BigInt(step))
  const hmac = createHmac('sha1', fromBase32(secret)).update(counter).digest()
  const offset = (hmac[hmac.length - 1] as number) & 15
  const binary = hmac.readUInt32BE(offset) & 0x7fffffff
  return String(binary % 1_000_000).padStart(6, '0')
}

/**
 * The time step a code belongs to, or null. One step either side is accepted (a phone's clock
 * may be a little off); steps up to `after` are refused, so a code cannot be used twice.
 */
export function verifyCode(secret: string, code: string, after: number | null = null, now = Date.now()): number | null {
  const clean = code.replace(/\s/g, '')
  if (!/^\d{6}$/.test(clean)) return null
  const current = stepAt(now)
  for (const step of [current, current - 1, current + 1]) {
    if (after !== null && step <= after) continue
    if (timingSafeEqual(Buffer.from(codeAt(secret, step)), Buffer.from(clean))) return step
  }
  return null
}

/** What the app scans: the account and the site's name, so people can tell their codes apart. */
export function otpauthUri(secret: string, account: string, issuer: string): string {
  const label = encodeURIComponent(`${issuer}:${account}`)
  return `otpauth://totp/${label}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=${PERIOD}`
}

/** Ten one-time recovery codes, for when the phone is lost: "k7f2-9qxm". */
export function recoveryCodes(count = 10): string[] {
  const chars = 'abcdefghjkmnpqrstuvwxyz23456789'
  const part = () => Array.from({ length: 4 }, () => chars[randomInt(chars.length)]).join('')
  return Array.from({ length: count }, () => `${part()}-${part()}`)
}
