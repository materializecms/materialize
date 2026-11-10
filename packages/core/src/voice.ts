/**
 * The brand voice: how the site speaks, kept in the "voice" setting and given to the AI with
 * every text it writes or changes (quick actions, the editor's assistant, translations, MCP).
 */

import { t } from './t.ts'

/** Tones to choose from, at most three: the values kept in the setting (see voiceToneLabel). */
export const VOICE_TONES = [
  'Professionale',
  'Amichevole',
  'Diretto',
  'Ispirazionale',
  'Tecnico',
  'Elegante',
  'Rassicurante',
  'Ironico',
] as const

export type VoiceTone = (typeof VOICE_TONES)[number]

/** A tone as the panel shows it; the value kept in the setting stays the Italian word. */
export function voiceToneLabel(tone: VoiceTone): string {
  const labels: Record<VoiceTone, string> = {
    Professionale: t('Professionale'),
    Amichevole: t('Amichevole'),
    Diretto: t('Diretto'),
    Ispirazionale: t('Ispirazionale'),
    Tecnico: t('Tecnico'),
    Elegante: t('Elegante'),
    Rassicurante: t('Rassicurante'),
    Ironico: t('Ironico'),
  }
  return labels[tone]
}

export type VoiceAddress = 'tu' | 'voi' | 'lei'

export interface BrandVoice {
  /** Who the site is and who it writes for. */
  about?: string
  tones?: string[]
  /** How readers are addressed. */
  address?: VoiceAddress | null
  /** Words and phrases to use, one per line or comma separated. */
  prefer?: string
  /** Words and phrases never to use. */
  avoid?: string
  /** Anything else: "no exclamation marks", "short sentences". */
  rules?: string
  /** A text that sounds like the brand: its style, never its content, is followed. */
  example?: string
}

const ADDRESS: Record<VoiceAddress, string> = {
  tu: 'informally, one reader at a time (in Italian "tu"; the informal form in other languages)',
  voi: 'informally, readers as a group (in Italian "voi")',
  lei: 'formally (in Italian "Lei"; the formal form in other languages)',
}

const list = (v?: string) =>
  (v ?? '')
    .split(/[\n,;]/)
    .map((w) => w.trim())
    .filter(Boolean)

/** Whether anything of the voice is filled in. */
export const hasVoice = (v: BrandVoice | null | undefined) =>
  !!v &&
  !!(
    v.about?.trim() ||
    v.tones?.length ||
    v.address ||
    v.prefer?.trim() ||
    v.avoid?.trim() ||
    v.rules?.trim() ||
    v.example?.trim()
  )

/**
 * The voice as instructions for a model; empty when nothing is set.
 *
 * - `full` (writing from scratch: a page title, a new section, a request in words): style and
 *   context, who the brand is and its words, as material to write with.
 * - `style` (changing a text someone wrote: rewrite, shorten, translate): only how to say it.
 *   Who the brand is and its favourite phrases stay out, or the model adds them as facts.
 */
export function voicePrompt(v: BrandVoice | null | undefined, use: 'full' | 'style' = 'full'): string {
  if (!v || !hasVoice(v)) return ''
  const full = use === 'full'
  const lines: string[] = []
  if (full && v.about?.trim()) lines.push(`- Who we are and who we write for: ${v.about.trim()}`)
  if (v.tones?.length) lines.push(`- Tone: ${v.tones.join(', ').toLowerCase()}.`)
  if (v.address) lines.push(`- Address readers ${ADDRESS[v.address]}.`)
  const prefer = list(v.prefer)
  if (full && prefer.length) lines.push(`- Words and phrases we like to use: ${prefer.join(', ')}.`)
  const avoid = list(v.avoid)
  if (avoid.length) lines.push(`- Never use these words or phrases: ${avoid.join(', ')}.`)
  if (v.rules?.trim()) lines.push(`- Other rules: ${v.rules.trim()}`)
  if (v.example?.trim())
    lines.push(
      `- A text in our voice (follow its style, never copy its content):\n<example>\n${v.example.trim()}\n</example>`,
    )
  if (!lines.length) return ''
  const how = full
    ? 'How this site speaks. Follow it in every text you write, unless the person asks for something else; what it says about us is true and may be used.'
    : 'How this site speaks. Apply it to the way the text is written only: keep its content, add no facts, services, numbers or claims it does not have, and keep the length you were asked for.'
  return `<brand_voice>\n${how}\n${lines.join('\n')}\n</brand_voice>`
}
