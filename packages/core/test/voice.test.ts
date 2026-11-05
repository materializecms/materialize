import { describe, expect, it } from 'vitest'
import { hasVoice, voicePrompt } from '../src/voice.ts'

describe('brand voice', () => {
  it('is empty until something is set', () => {
    expect(voicePrompt(null)).toBe('')
    expect(voicePrompt({ about: '  ', tones: [] })).toBe('')
    expect(hasVoice({ address: 'tu' })).toBe(true)
  })

  it('turns the fields into instructions, lists split on commas and lines', () => {
    const text = voicePrompt({
      about: 'Studio di architettura a Milano.',
      tones: ['Elegante', 'Diretto'],
      address: 'tu',
      prefer: 'luce, progetto\nsu misura',
      avoid: 'eccellenza;leader',
      rules: 'Frasi brevi.',
      example: 'Disegniamo case che respirano.',
    })
    expect(text).toContain('- Tone: elegante, diretto.')
    expect(text).toContain('Address readers informally, one reader at a time')
    expect(text).toContain('like to use: luce, progetto, su misura.')
    expect(text).toContain('Never use these words or phrases: eccellenza, leader.')
    expect(text).toContain('<example>\nDisegniamo case che respirano.\n</example>')
    expect(text.startsWith('<brand_voice>')).toBe(true)
  })

  it('keeps who we are and our phrases out when only the style is needed', () => {
    const voice = {
      about: 'Studio di architettura.',
      prefer: 'un solo interlocutore',
      tones: ['Diretto'],
      avoid: 'leader',
    }
    const style = voicePrompt(voice, 'style')
    expect(style).not.toContain('Studio di architettura')
    expect(style).not.toContain('un solo interlocutore')
    expect(style).toContain('Never use these words or phrases: leader.')
    expect(style).toContain('keep its content')
    // Nothing of the style filled in: nothing to say.
    expect(voicePrompt({ about: 'Studio di architettura.' }, 'style')).toBe('')
  })
})
