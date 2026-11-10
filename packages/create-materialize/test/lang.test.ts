import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { langChecks } from '../../core/test/lang-texts.ts'
import { en } from '../src/en/index.ts'
import { systemLang } from '../src/t.ts'

describe('create-materialize in English', () => langChecks(join(import.meta.dirname, '../src'), en))

describe('starter language', () => {
  it('follows MATERIALIZE_LANG first, then the system', () => {
    expect(systemLang({ MATERIALIZE_LANG: 'en', LANG: 'it_IT.UTF-8' })).toBe('en')
    expect(systemLang({ LANG: 'it_IT.UTF-8' })).toBe('it')
    expect(systemLang({ LANG: 'en_US.UTF-8' })).toBe('en')
  })
})
