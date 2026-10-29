import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  type AuthStore,
  type ContentStore,
  createAuthStore,
  createContentStore,
  type Database,
  EmailTakenError,
  openDatabase,
  SlugTakenError,
} from '../src/index.ts'

let database: Database
let content: ContentStore
let auth: AuthStore

beforeEach(async () => {
  database = await openDatabase({ url: ':memory:' })
  content = createContentStore(database.db)
  auth = createAuthStore(database.db)
})

afterEach(() => database.close())

const page = (title: string, slug: string) => ({
  collection: 'pages',
  locale: 'it',
  title,
  slug,
  data: { title, slug },
})

describe('documents', () => {
  it('creates drafts that are not live until published', async () => {
    const doc = await content.create(page('Home', 'home'))
    expect(doc.status).toBe('draft')
    expect(doc.publishedData).toBeNull()

    const published = await content.publish(doc.id)
    expect(published?.status).toBe('published')
    expect(published?.publishedData).toEqual({ title: 'Home', slug: 'home' })

    const edited = await content.update(doc.id, { title: 'Casa', slug: 'home', data: { title: 'Casa', slug: 'home' } })
    expect(edited?.status).toBe('changed')
    expect(edited?.publishedData).toEqual({ title: 'Home', slug: 'home' })
  })

  it('rejects a slug already used in the same collection and locale', async () => {
    await content.create(page('Home', 'home'))
    await expect(content.create(page('Altra', 'home'))).rejects.toBeInstanceOf(SlugTakenError)
    await expect(content.create({ ...page('Home EN', 'home'), locale: 'en' })).resolves.toBeTruthy()
  })

  it('lists, searches and filters published documents', async () => {
    const a = await content.create(page('Progetti', 'progetti'))
    await content.create(page('Contatti', 'contatti'))
    await content.publish(a.id)

    expect((await content.list('pages', { locale: 'it' })).total).toBe(2)
    expect((await content.list('pages', { locale: 'it', search: 'prog' })).items.map((d) => d.slug)).toEqual([
      'progetti',
    ])
    expect((await content.list('pages', { locale: 'it', publishedOnly: true })).items.map((d) => d.slug)).toEqual([
      'progetti',
    ])
  })

  it('keeps revisions and restores an old version into the draft', async () => {
    const doc = await content.create(page('Prima', 'pagina'))
    await content.publish(doc.id)
    await content.update(doc.id, { title: 'Seconda', slug: 'pagina', data: { title: 'Seconda' } })
    const history = await content.revisions(doc.id)
    expect(history.map((r) => r.kind)).toEqual(['save', 'publish', 'save'])
    const first = history.find((r) => r.data.title === 'Prima')
    const restored = await content.restore(doc.id, first?.id ?? '')
    expect(restored?.data.title).toBe('Prima')
    expect((await content.revisions(doc.id)).map((r) => r.kind)).toContain('restore')
  })

  it('merges quick consecutive saves into one revision', async () => {
    const doc = await content.create(page('Bozza', 'bozza'))
    for (const title of ['B', 'Bo', 'Bozza finale']) {
      await content.update(doc.id, { title, slug: 'bozza', data: { title } })
    }
    const history = await content.revisions(doc.id)
    expect(history).toHaveLength(1)
    expect(history[0]?.data.title).toBe('Bozza finale')
  })

  it('loads published documents for building the site', async () => {
    const a = await content.create(page('Home', 'home'))
    const b = await content.create(page('Contatti', 'contatti'))
    await content.create({ ...page('Home', 'home'), locale: 'en' })
    await content.publish(a.id)
    await content.publish(b.id)
    expect((await content.published('pages', 'it')).map((d) => d.slug)).toEqual(['home', 'contatti'])
    expect(await content.published('pages', 'en')).toEqual([])
    expect((await content.getMany([b.id, 'missing'])).map((d) => d.title)).toEqual(['Contatti'])
  })

  it('unpublishes and deletes', async () => {
    const doc = await content.create(page('Temporanea', 'temp'))
    await content.publish(doc.id)
    expect((await content.unpublish(doc.id))?.status).toBe('draft')
    expect(await content.remove(doc.id)).toBe(true)
    expect(await content.get(doc.id)).toBeNull()
    expect(await content.revisions(doc.id)).toEqual([])
  })
})

describe('auth', () => {
  it('stores users and resolves sessions by token', async () => {
    expect(await auth.countUsers()).toBe(0)
    const user = await auth.createUser({ email: ' Elena@Studio.it ', name: 'Elena', role: 'admin', passwordHash: 'x' })
    expect(user.email).toBe('elena@studio.it')
    expect(await auth.findForLogin('ELENA@studio.it')).toMatchObject({ id: user.id, passwordHash: 'x' })

    const { token } = await auth.createSession(user.id, 60_000)
    expect(await auth.userForSession(token)).toMatchObject({ id: user.id, role: 'admin' })
    await auth.deleteSession(token)
    expect(await auth.userForSession(token)).toBeNull()
  })

  it('treats expired sessions as missing', async () => {
    const user = await auth.createUser({ email: 'a@b.it', name: 'A', role: 'editor', passwordHash: 'x' })
    const { token } = await auth.createSession(user.id, -1)
    expect(await auth.userForSession(token)).toBeNull()
  })
})

describe('people and invitations', () => {
  it('invites once per email, and links work only until used or expired', async () => {
    const admin = await auth.createUser({ email: 'elena@studio.it', name: 'Elena', role: 'admin', passwordHash: 'x' })
    const { token } = await auth.createInvite({
      kind: 'invite',
      email: 'Marco@Studio.it',
      role: 'editor',
      ttlMs: 60_000,
    })
    expect((await auth.findInvite(token))?.email).toBe('marco@studio.it')
    expect((await auth.pendingInvites()).map((i) => i.email)).toEqual(['marco@studio.it'])

    // A new invitation to the same address replaces the old link.
    const second = await auth.createInvite({ kind: 'invite', email: 'marco@studio.it', role: 'admin', ttlMs: 60_000 })
    expect(await auth.findInvite(token)).toBeNull()
    await auth.consumeInvite(second.token)
    expect(await auth.findInvite(second.token)).toBeNull()

    const expired = await auth.createInvite({ kind: 'invite', email: 'luca@studio.it', role: 'editor', ttlMs: -1 })
    expect(await auth.findInvite(expired.token)).toBeNull()

    await expect(
      auth.createInvite({ kind: 'invite', email: admin.email, role: 'editor', ttlMs: 60_000 }),
    ).rejects.toBeInstanceOf(EmailTakenError)
  })

  it('changes roles, lists last sign-in and signs out everywhere on a new password', async () => {
    const a = await auth.createUser({ email: 'a@studio.it', name: 'A', role: 'admin', passwordHash: 'x' })
    const b = await auth.createUser({ email: 'b@studio.it', name: 'B', role: 'editor', passwordHash: 'x' })
    const keep = await auth.createSession(b.id, 60_000)
    const other = await auth.createSession(b.id, 60_000)
    expect((await auth.listUsers()).map((u) => [u.name, u.lastSeenAt !== null])).toEqual([
      ['A', false],
      ['B', true],
    ])

    await auth.updateUser(b.id, { role: 'admin' })
    expect(await auth.countAdmins()).toBe(2)

    await auth.setPassword(b.id, 'y', keep.token)
    expect(await auth.userForSession(keep.token)).not.toBeNull()
    expect(await auth.userForSession(other.token)).toBeNull()
    expect(await auth.getPasswordHash(b.id)).toBe('y')

    expect(await auth.deleteUser(a.id)).toBe(true)
    expect(await auth.countUsers()).toBe(1)
  })
})
