import { randomBytes, type ScryptOptions, scrypt, timingSafeEqual } from 'node:crypto'

const PARAMS = { N: 2 ** 15, r: 8, p: 1, keylen: 32 }

function derive(
  password: string,
  salt: Buffer,
  o: { N: number; r: number; p: number; keylen: number },
): Promise<Buffer> {
  const options: ScryptOptions = { N: o.N, r: o.r, p: o.p, maxmem: 128 * o.N * o.r * 2 }
  return new Promise((resolve, reject) =>
    scrypt(password.normalize('NFKC'), salt, o.keylen, options, (err, key) => (err ? reject(err) : resolve(key))),
  )
}

/** scrypt from the Node standard library: no native dependency to install. */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16)
  const key = await derive(password, salt, PARAMS)
  return ['scrypt', PARAMS.N, PARAMS.r, PARAMS.p, salt.toString('base64url'), key.toString('base64url')].join('$')
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, n, r, p, salt, hash] = stored.split('$')
  if (scheme !== 'scrypt' || !salt || !hash) return false
  const expected = Buffer.from(hash, 'base64url')
  const key = await derive(password, Buffer.from(salt, 'base64url'), {
    N: Number(n),
    r: Number(r),
    p: Number(p),
    keylen: expected.length,
  })
  return key.length === expected.length && timingSafeEqual(key, expected)
}
