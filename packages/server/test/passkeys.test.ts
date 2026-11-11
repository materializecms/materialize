import { createHash, generateKeyPairSync, type KeyObject, randomBytes, sign } from 'node:crypto'
import { defineCollection, defineConfig, f } from '@materializecms/core'
import { type Database, openDatabase } from '@materializecms/db'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createApp } from '../src/index.ts'

const config = defineConfig({
  site: { name: 'Studio Rossi' },
  collections: [defineCollection({ name: 'pages', fields: { title: f.text({ required: true }) } })],
})

let database: Database
let app: ReturnType<typeof createApp>
const PASSWORD = 'una-password-lunga'

/** A browser of its own, with its session cookie, at an origin of choice. */
function client(origin = 'http://localhost', ip = '10.0.0.1') {
  let cookie = ''
  return async (method: string, path: string, json?: unknown) => {
    const res = await app.request(new URL(path, origin).toString(), {
      method,
      headers: {
        origin,
        'x-forwarded-for': ip,
        ...(json ? { 'content-type': 'application/json' } : {}),
        ...(cookie ? { cookie } : {}),
      },
      body: json ? JSON.stringify(json) : undefined,
    })
    const set = res.headers.get('set-cookie')
    if (set) cookie = set.split(';')[0] ?? ''
    const text = await res.text()
    return { status: res.status, body: text ? JSON.parse(text) : null }
  }
}

// ---------- a tiny authenticator: CBOR, an ES256 key, the signatures a phone would make ----------

function cbor(value: unknown): Buffer {
  const head = (major: number, n: number) => {
    if (n < 24) return Buffer.from([(major << 5) | n])
    if (n < 256) return Buffer.from([(major << 5) | 24, n])
    return Buffer.from([(major << 5) | 25, n >> 8, n & 255])
  }
  if (typeof value === 'number') return value >= 0 ? head(0, value) : head(1, -1 - value)
  if (typeof value === 'string') return Buffer.concat([head(3, Buffer.byteLength(value)), Buffer.from(value)])
  if (Buffer.isBuffer(value)) return Buffer.concat([head(2, value.length), value])
  const entries = value instanceof Map ? [...value] : Object.entries(value as object)
  return Buffer.concat([head(5, entries.length), ...entries.flatMap(([k, v]) => [cbor(k), cbor(v)])])
}

const b64 = (b: Buffer) => b.toString('base64url')
const sha256 = (b: Buffer | string) => createHash('sha256').update(b).digest()

function authenticator(rpID = 'localhost', origin = 'http://localhost') {
  const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' })
  const jwk = publicKey.export({ format: 'jwk' })
  const id = randomBytes(16)
  let counter = 0
  // UP (user present) + UV (user verified), and AT when a credential is attached.
  const authData = (flags: number, attested?: Buffer) => {
    const count = Buffer.alloc(4)
    count.writeUInt32BE(counter)
    return Buffer.concat([sha256(rpID), Buffer.from([flags]), count, ...(attested ? [attested] : [])])
  }
  const client = (type: string, challenge: string, at = origin) =>
    Buffer.from(JSON.stringify({ type, challenge, origin: at, crossOrigin: false }))

  return {
    id: b64(id),
    set counter(n: number) {
      counter = n
    },
    create(challenge: string, at?: string) {
      const coseKey = cbor(
        new Map<number, unknown>([
          [1, 2],
          [3, -7],
          [-1, 1],
          [-2, Buffer.from(jwk.x as string, 'base64url')],
          [-3, Buffer.from(jwk.y as string, 'base64url')],
        ]),
      )
      const length = Buffer.from([id.length >> 8, id.length & 255])
      const attested = Buffer.concat([Buffer.alloc(16), length, id, coseKey])
      const attestationObject = cbor({ fmt: 'none', attStmt: new Map(), authData: authData(0x45, attested) })
      return {
        id: b64(id),
        rawId: b64(id),
        type: 'public-key',
        clientExtensionResults: {},
        response: {
          clientDataJSON: b64(client('webauthn.create', challenge, at)),
          attestationObject: b64(attestationObject),
          transports: ['internal'],
        },
      }
    },
    get(challenge: string, key: KeyObject = privateKey) {
      counter += 1
      const data = authData(0x05)
      const clientData = client('webauthn.get', challenge)
      const signature = sign('sha256', Buffer.concat([data, sha256(clientData)]), key)
      return {
        id: b64(id),
        rawId: b64(id),
        type: 'public-key',
        clientExtensionResults: {},
        response: {
          clientDataJSON: b64(clientData),
          authenticatorData: b64(data),
          signature: b64(signature),
        },
      }
    },
  }
}

type Client = ReturnType<typeof client>

/** Adds a passkey to whoever `who` is, with the device given. */
async function addPasskey(who: Client, device: ReturnType<typeof authenticator>) {
  const options = await who('POST', '/api/auth/passkeys/options', { password: PASSWORD })
  expect(options.status).toBe(200)
  return who('POST', '/api/auth/passkeys', {
    ticket: options.body.ticket,
    response: device.create(options.body.options.challenge),
    name: 'iPhone',
  })
}

async function signInWith(who: Client, device: ReturnType<typeof authenticator>) {
  const options = await who('POST', '/api/auth/passkey/options')
  return who('POST', '/api/auth/passkey', {
    ticket: options.body.ticket,
    response: device.get(options.body.options.challenge),
  })
}

let admin: Client

beforeEach(async () => {
  database = await openDatabase({ url: ':memory:' })
  app = createApp({ config: () => ({ ...config, server: { ...config.server, trustProxy: true } }), database })
  admin = client()
  await admin('POST', '/api/setup', { email: 'elena@example.com', name: 'Elena', password: PASSWORD })
})

afterEach(() => database.close())

describe('passkeys', () => {
  it('are bound to the address in use, and need the password to be added', async () => {
    const options = await admin('POST', '/api/auth/passkeys/options', { password: PASSWORD })
    expect(options.body.options.rp).toEqual({ id: 'localhost', name: 'Studio Rossi' })
    expect(options.body.options.authenticatorSelection).toMatchObject({ residentKey: 'required' })
    expect((await admin('POST', '/api/auth/passkeys/options', { password: 'sbagliata' })).status).toBe(422)
  })

  it('sign in with no email and no password, and show in the profile', async () => {
    const phone = authenticator()
    expect((await addPasskey(admin, phone)).status).toBe(201)
    const me = await admin('GET', '/api/auth/me')
    expect(me.body.user.passkeys).toBe(1)
    const security = await admin('GET', '/api/auth/security')
    expect(security.body.passkeys).toMatchObject([{ name: 'iPhone' }])

    const laptop = client('http://localhost', '10.0.0.2')
    const signedIn = await signInWith(laptop, phone)
    expect(signedIn.status).toBe(200)
    expect(signedIn.body.user.email).toBe('elena@example.com')
    expect((await laptop('GET', '/api/auth/me')).status).toBe(200)
    const log = await admin('GET', '/api/activity?group=access')
    expect(JSON.stringify(log.body)).toContain('passkey.added')
  })

  it('refuse a forged signature, a counter that goes back, and a challenge used twice', async () => {
    const phone = authenticator()
    await addPasskey(admin, phone)
    const stranger = client('http://localhost', '10.0.0.3')

    const options = await stranger('POST', '/api/auth/passkey/options')
    const forged = phone.get(
      options.body.options.challenge,
      generateKeyPairSync('ec', { namedCurve: 'P-256' }).privateKey,
    )
    expect(
      (await stranger('POST', '/api/auth/passkey', { ticket: options.body.ticket, response: forged })).status,
    ).toBe(401)
    // The same challenge, now with a good signature: it worked once (it failed), and is gone.
    const reused = phone.get(options.body.options.challenge)
    expect(
      (await stranger('POST', '/api/auth/passkey', { ticket: options.body.ticket, response: reused })).status,
    ).toBe(401)

    expect((await signInWith(stranger, phone)).status).toBe(200)
    // A copy of the key with an older counter: a clone.
    phone.counter = 0
    expect((await signInWith(client('http://localhost', '10.0.0.4'), phone)).status).toBe(401)
  })

  it('refuse an answer made for another address', async () => {
    const options = await admin('POST', '/api/auth/passkeys/options', { password: PASSWORD })
    const phishing = authenticator('localhost', 'https://looks-like-localhost.example')
    const res = await admin('POST', '/api/auth/passkeys', {
      ticket: options.body.ticket,
      response: phishing.create(options.body.options.challenge),
    })
    expect(res.status).toBe(422)
  })

  it('online, use the site address, never the Host of a stranger', async () => {
    database.close()
    database = await openDatabase({ url: ':memory:' })
    app = createApp({
      config: () => ({ ...config, site: { ...config.site, url: 'https://studio.example' } }),
      database,
    })
    const site = client('https://studio.example')
    await site('POST', '/api/setup', { email: 'elena@example.com', name: 'Elena', password: PASSWORD })
    const options = await site('POST', '/api/auth/passkey/options')
    expect(options.body.options.rpId).toBe('studio.example')

    const other = client('https://attacker.example')
    expect((await other('POST', '/api/auth/passkey/options')).body.options.rpId).toBe('studio.example')
  })

  it('count as the second step a site can require, and an admin reset removes them', async () => {
    const phone = authenticator()
    await addPasskey(admin, phone)
    expect((await admin('PUT', '/api/security', { requireTwoFactor: true })).status).toBe(200)
    // With a passkey only, the password alone is not enough where the site asks for two steps.
    const password = await client('http://localhost', '10.0.0.6')('POST', '/api/auth/login', {
      email: 'elena@example.com',
      password: PASSWORD,
    })
    expect(password).toMatchObject({ status: 403, body: { error: { code: 'passkey_required' } } })
    // Its only passkey cannot go while the site requires a second step.
    const [first] = (await admin('GET', '/api/auth/security')).body.passkeys
    expect((await admin('DELETE', `/api/auth/passkeys/${first.id}`)).status).toBe(409)

    await admin('PUT', '/api/security', { requireTwoFactor: false })
    const people = (await admin('GET', '/api/users')).body.users as { id: string; email: string }[]
    const elena = people.find((p) => p.email === 'elena@example.com')
    expect((await admin('DELETE', `/api/users/${elena?.id}/two-factor`)).status).toBe(200)
    expect((await signInWith(client('http://localhost', '10.0.0.7'), phone)).status).toBe(401)
  })

  it('a new password from a reset link is not a way around the passkey', async () => {
    const phone = authenticator()
    await addPasskey(admin, phone)
    expect((await admin('PUT', '/api/security', { requireTwoFactor: true })).status).toBe(200)
    const people = (await admin('GET', '/api/users')).body.users as { id: string }[]
    const reset = await admin('POST', `/api/users/${people[0]?.id}/reset`)
    expect(reset.status).toBe(201)
    const token = String(reset.body.link).split('/').pop()
    const stranger = client('http://localhost', '10.0.0.9')
    const accepted = await stranger('POST', `/api/invites/${token}/accept`, {
      name: 'Elena',
      password: 'una-password-nuova-e-lunga',
    })
    expect(accepted).toMatchObject({ status: 403, body: { error: { code: 'passkey_required' } } })
    expect((await stranger('GET', '/api/auth/me')).status).toBe(401)
    // The passkey still works.
    expect((await signInWith(stranger, phone)).status).toBe(200)
  })
})
