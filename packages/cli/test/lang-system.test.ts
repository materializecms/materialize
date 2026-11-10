import { describe, expect, it } from 'vitest'
import { systemLang } from '../src/lang.ts'

describe('terminal language', () => {
  it('follows MATERIALIZE_LANG first, then the system', () => {
    expect(systemLang({ MATERIALIZE_LANG: 'en', LANG: 'it_IT.UTF-8' })).toBe('en')
    expect(systemLang({ LANG: 'it_IT.UTF-8' })).toBe('it')
    expect(systemLang({ LANG: 'en_US.UTF-8' })).toBe('en')
    expect(systemLang({ LC_ALL: 'de_DE.UTF-8', LANG: 'it_IT.UTF-8' })).toBe('en')
  })
})
