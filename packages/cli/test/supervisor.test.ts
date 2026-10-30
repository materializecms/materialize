import { existsSync } from 'node:fs'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { applyPending, type Pending, revertPending, updatesDir } from '../src/supervisor.ts'

let site: string

/** A fake installed version: node_modules with a marker, and package.json naming it. */
async function version(dir: string, v: string) {
  await mkdir(join(dir, 'node_modules'), { recursive: true })
  await writeFile(join(dir, 'node_modules', 'marker'), v)
  await writeFile(join(dir, 'package.json'), JSON.stringify({ dependencies: { '@materializecms/cli': v } }))
}
const installed = (dir: string) => readFile(join(dir, 'node_modules', 'marker'), 'utf8')
const pending = (kind: Pending['kind'], from: string, to: string): Pending => ({ kind, from, to, at: '' })

beforeEach(async () => {
  site = await mkdtemp(join(tmpdir(), 'mz-swap-'))
  await version(site, '0.1.0')
  await mkdir(join(site, 'src'))
  await writeFile(join(site, 'src', 'page.astro'), 'mio')
})
afterEach(() => rm(site, { recursive: true, force: true }))

describe('version swap', () => {
  it('installs the new version and keeps the old one for going back', async () => {
    await version(join(updatesDir(site), 'next'), '0.2.0')
    await applyPending(site, pending('install', '0.1.0', '0.2.0'))
    expect(await installed(site)).toBe('0.2.0')
    expect(await installed(join(updatesDir(site), 'previous'))).toBe('0.1.0')
    expect(existsSync(join(updatesDir(site), 'next'))).toBe(false)
    // The site's own files are never touched.
    expect(await readFile(join(site, 'src', 'page.astro'), 'utf8')).toBe('mio')
  })

  it('goes back, and forward again', async () => {
    await version(join(updatesDir(site), 'next'), '0.2.0')
    await applyPending(site, pending('install', '0.1.0', '0.2.0'))
    await applyPending(site, pending('rollback', '0.2.0', '0.1.0'))
    expect(await installed(site)).toBe('0.1.0')
    await applyPending(site, pending('rollback', '0.1.0', '0.2.0'))
    expect(await installed(site)).toBe('0.2.0')
  })

  it('undoes a failed install and forgets the failed version', async () => {
    await version(join(updatesDir(site), 'next'), '0.2.0')
    const p = pending('install', '0.1.0', '0.2.0')
    await applyPending(site, p)
    await revertPending(site, p)
    expect(await installed(site)).toBe('0.1.0')
    expect(JSON.parse(await readFile(join(site, 'package.json'), 'utf8')).dependencies['@materializecms/cli']).toBe(
      '0.1.0',
    )
    expect(existsSync(join(updatesDir(site), 'previous'))).toBe(false)
  })

  it('refuses a swap with nothing to swap in', async () => {
    await expect(applyPending(site, pending('install', '0.1.0', '0.2.0'))).rejects.toThrow(/non è stata scaricata/)
    await expect(applyPending(site, pending('rollback', '0.1.0', '0.0.9'))).rejects.toThrow(/versione precedente/)
    expect(await installed(site)).toBe('0.1.0')
  })
})
