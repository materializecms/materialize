import { spawnSync } from 'node:child_process'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { encryptFile, newRecoveryKey, parseRecoveryKey } from '../../server/src/offsite.ts'

const CLI = join(dirname(fileURLToPath(import.meta.url)), '../src/cli.ts')
let dir: string
const key = newRecoveryKey()

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'mz-decrypt-'))
  await mkdir(join(dir, 'giu', 'database'), { recursive: true })
  await mkdir(join(dir, 'giu', 'media'), { recursive: true })
  await writeFile(join(dir, 'db'), 'database')
  await writeFile(join(dir, 'foto'), 'immagine')
  await encryptFile(
    join(dir, 'db'),
    join(dir, 'giu', 'database', 'content-20261101-120000-auto.db.mzb'),
    parseRecoveryKey(key),
  )
  await encryptFile(join(dir, 'foto'), join(dir, 'giu', 'media', 'foto.jpg.mzb'), parseRecoveryKey(key))
})
afterEach(() => rm(dir, { recursive: true, force: true }))

const run = (args: string[], env: Record<string, string> = {}) =>
  spawnSync(process.execPath, [CLI, 'decrypt', ...args], {
    cwd: dir,
    encoding: 'utf8',
    env: { ...process.env, ...env },
  })

describe('materialize decrypt', () => {
  it('decrypts a downloaded folder with the key, and says how to restore the database', async () => {
    const out = run(['giu', '--key', key])
    expect(out.status).toBe(0)
    expect(out.stdout).toContain('2 file decifrati')
    expect(out.stdout).toContain('materialize restore giu/database/content-20261101-120000-auto.db')
    expect(await readFile(join(dir, 'giu', 'media', 'foto.jpg'), 'utf8')).toBe('immagine')
  })

  it('takes the key from MATERIALIZE_BACKUP_KEY too', () => {
    expect(run(['giu'], { MATERIALIZE_BACKUP_KEY: key }).status).toBe(0)
  })

  it('refuses a wrong key without leaving half files', async () => {
    const out = run(['giu', '--key', newRecoveryKey()])
    expect(out.status).toBe(1)
    expect(out.stderr).toMatch(/Chiave sbagliata/)
    await expect(readFile(join(dir, 'giu', 'media', 'foto.jpg'))).rejects.toThrow()
  })
})
