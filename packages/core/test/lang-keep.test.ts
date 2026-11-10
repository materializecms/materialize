import { describe, expect, it } from 'vitest'
import { setLangSource, translator } from '../src/lang.ts'

describe('kept texts', () => {
  const t = translator({
    'Troppi link ({n})': 'Too many links ({n})',
    'La pagina non esiste più': 'The page no longer exists',
    '{title}: {message}': '{title}: {message}',
  })
  let lang: 'it' | 'en' = 'it'
  setLangSource(() => lang)

  it('saves the Italian text and its values, and reads it in the reader’s language', () => {
    const stored = t.keep('Troppi link ({n})', { n: 5 })
    lang = 'it'
    expect(t.read(stored)).toBe('Troppi link (5)')
    lang = 'en'
    expect(t.read(stored)).toBe('Too many links (5)')
  })

  it('translates kept texts inside values and lists', () => {
    const one = t.keep('{title}: {message}', { title: 'Chi siamo', message: t.keep('La pagina non esiste più') })
    const both = t.keep('{list}', { list: [one, t.keep('La pagina non esiste più')] })
    lang = 'en'
    expect(t.read(both)).toBe('Chi siamo: The page no longer exists; The page no longer exists')
  })

  it('shows old plain texts as they are', () => {
    lang = 'en'
    expect(t.read('Segnato a mano')).toBe('Segnato a mano')
    expect(t.read(null)).toBe('')
    expect(t.read('i18n:{broken')).toBe('i18n:{broken')
  })
})
