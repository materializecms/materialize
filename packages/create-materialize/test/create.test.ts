import { existsSync } from 'node:fs'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createProject } from '../src/index.ts'

let root: string

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'create-materialize-'))
})

afterEach(async () => {
  await rm(root, { recursive: true, force: true })
})

describe('createProject', () => {
  it('copies the starter and fills in the names', async () => {
    const dir = await createProject(join(root, 'studio-rossi'))
    expect(existsSync(join(dir, '.gitignore'))).toBe(true)
    expect(existsSync(join(dir, 'gitignore'))).toBe(false)
    const pkg = JSON.parse(await readFile(join(dir, 'package.json'), 'utf8'))
    expect(pkg.name).toBe('studio-rossi')
    const config = await readFile(join(dir, 'materialize.config.ts'), 'utf8')
    expect(config).toContain("site: { name: 'Studio rossi' }")
    expect(config).not.toContain('__')
  })

  it('refuses to overwrite a folder with files', async () => {
    await writeFile(join(root, 'keep.txt'), 'x')
    await expect(createProject(root)).rejects.toThrow('non è vuota')
  })
})
