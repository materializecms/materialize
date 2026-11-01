import { spawnSync } from 'node:child_process'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createAuthStore, openDatabase } from '@materializecms/db'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

const CLI = join(dirname(fileURLToPath(import.meta.url)), '../src/cli.ts')
let site: string

// Inside the repository, so the site's config finds the workspace packages.
beforeEach(async () => {
  site = await mkdtemp(join(dirname(fileURLToPath(import.meta.url)), '.site-'))
  await writeFile(
    join(site, 'materialize.config.ts'),
    `import { defineConfig } from '@materializecms/core'
export default defineConfig({ site: { name: 'Prova', url: 'https://www.example.com/' }, collections: [], database: { url: 'file:${join(site, 'content.db')}' } })
`,
  )
  const database = await openDatabase({ url: `file:${join(site, 'content.db')}` })
  await createAuthStore(database.db).createUser({
    email: 'elena@example.com',
    name: 'Elena',
    role: 'admin',
    passwordHash: 'x',
  })
  database.close()
})

afterEach(() => rm(site, { recursive: true, force: true }))

const run = (...args: string[]) =>
  spawnSync(process.execPath, [CLI, 'reset-password', ...args], { cwd: site, encoding: 'utf8' })

describe('materialize reset-password', () => {
  it('prints a one-time link on the site’s own address', async () => {
    const out = run('Elena@Example.com')
    expect(out.status).toBe(0)
    const token = /https:\/\/www\.example\.com\/admin\/_invite\/([\w-]+)/.exec(out.stdout)?.[1]
    expect(token).toBeTruthy()
    const database = await openDatabase({ url: `file:${join(site, 'content.db')}` })
    const invite = await createAuthStore(database.db).findInvite(token ?? '')
    database.close()
    expect(invite?.kind).toBe('reset')
  })

  it('says so when the email has no account', () => {
    const out = run('nessuno@example.com')
    expect(out.status).toBe(1)
    expect(out.stderr).toContain('Nessun account')
  })
})
