import { normalizeTheme, type PageNode, type Theme } from '@materializecms/core/page'
import type { BrandVoice } from '@materializecms/core/voice'
import { z } from 'zod'
import { type ApiCall, contentTools, pageTools, type SiteTool, ToolError } from './tools.ts'

/**
 * A site from a brief: the AI reads a few lines about the business and builds the first pages
 * with the section library. Everything it makes is a new draft: it never changes pages that
 * already exist, shared sections or anything live. Colors, fonts and the brand voice are only
 * proposed; the person applies them with a click.
 */

/** At most this many new drafts in one run. */
export const BRIEF_MAX_PAGES = 8

export interface BriefResult {
  created: { id: string; collection: string; title: string; url: string | null }[]
  /** The whole theme as it would be with the proposal applied. */
  theme: Theme | null
  voice: BrandVoice | null
}

type Doc = { id: string; collection: string; title: string; data: Record<string, unknown>; url: string | null }
type Schema = {
  site: { name: string }
  locales: { default: string; available: string[] }
  collections: { name: string; label?: string; singleton?: boolean; fields: { name: string; kind: string }[] }[]
}

/** What a page may not carry when the AI makes it: links to shared content that is live. */
function plain(n: PageNode): PageNode {
  const { global: _g, component: _c, overrides: _o, ...rest } = n as PageNode & Record<string, unknown>
  return { ...(rest as PageNode), children: n.children?.map(plain) }
}

const color = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'a hex color like #1a2b3c')
const colors = z
  .object({
    bg: color,
    surface: color,
    text: color,
    muted: color,
    accent: color,
    onAccent: color,
    inverse: color,
    onInverse: color,
  })
  .partial()

export function briefTools(
  call: ApiCall,
  options: {
    onCreated: (doc: BriefResult['created'][number]) => void
    askVoice: boolean
    /** What the run made so far: a reply to the AI goes on from there. */
    result?: BriefResult
  },
): { tools: SiteTool[]; result: BriefResult } {
  const result: BriefResult = options.result ?? { created: [], theme: null, voice: null }
  let schema: Schema | null = null
  const getSchema = async () => (schema ??= await call<Schema>('GET', '/api/schema'))
  const mine = (id: string | undefined) => {
    if (!id || !result.created.some((d) => d.id === id))
      throw new ToolError(
        'You may change only the drafts you created in this run (create_entry); pages that already exist stay as they are.',
      )
    return id
  }
  const pageFieldOf = async (collection: string) =>
    (await getSchema()).collections.find((c) => c.name === collection)?.fields.find((f) => f.kind === 'page')?.name

  const base = contentTools(call, getSchema)
  const pick = (name: string) => {
    const t = base.find((x) => x.name === name)
    if (!t) throw new Error(`missing tool ${name}`)
    return t
  }

  const tools: SiteTool[] = [
    ...['get_site', 'list_entries', 'get_entry', 'list_library', 'get_theme', 'list_media'].map(pick),
    {
      ...pick('create_entry'),
      description:
        'A new draft in a collection, with the fields given (see get_site for their names). The address (slug) follows the title when left out. For a page built on the canvas, leave the page field out and fill it afterwards with edit_page.',
      run: async (input: { collection: string; data: Record<string, unknown>; locale?: string }) => {
        if (result.created.length >= BRIEF_MAX_PAGES)
          throw new ToolError(`At most ${BRIEF_MAX_PAGES} new drafts in one run: stop here.`)
        const field = await pageFieldOf(input.collection)
        const data = { ...input.data }
        if (field) data[field] = Array.isArray(data[field]) ? (data[field] as PageNode[]).map(plain) : []
        const doc = await call<Doc & { issues?: unknown[] }>(
          'POST',
          `/api/collections/${encodeURIComponent(input.collection)}`,
          { data, locale: input.locale },
        )
        const created = { id: doc.id, collection: doc.collection, title: doc.title, url: doc.url }
        result.created.push(created)
        options.onCreated(created)
        return { id: doc.id, title: doc.title, url: doc.url, issues: doc.issues }
      },
    } as SiteTool,
    {
      ...pick('update_entry'),
      run: async (input: { id: string; data: Record<string, unknown> }) => {
        const doc = await call<Doc>('GET', `/api/documents/${encodeURIComponent(mine(input.id))}`)
        const field = await pageFieldOf(doc.collection)
        const data = { ...doc.data, ...input.data }
        if (field && Array.isArray(data[field])) data[field] = (data[field] as PageNode[]).map(plain)
        const saved = await call<Doc & { issues?: unknown[] }>('PUT', `/api/documents/${encodeURIComponent(doc.id)}`, {
          data,
        })
        const entry = result.created.find((d) => d.id === doc.id)
        if (entry) Object.assign(entry, { title: saved.title, url: saved.url })
        return { id: saved.id, title: saved.title, url: saved.url, issues: saved.issues }
      },
    } as SiteTool,
    ...pageTools({
      withId: true,
      brand: async () => (await getSchema()).site.name,
      source: async (id) => {
        const doc = await call<Doc>('GET', `/api/documents/${encodeURIComponent(mine(id))}`)
        const field = await pageFieldOf(doc.collection)
        if (!field) throw new ToolError(`"${doc.title}" is not a page built on the canvas`)
        let data = doc.data
        return {
          load: async () => (Array.isArray(data[field]) ? (data[field] as PageNode[]) : []),
          save: async (nodes) => {
            data = { ...data, [field]: nodes.map(plain) }
            await call('PUT', `/api/documents/${encodeURIComponent(doc.id)}`, { data })
          },
        }
      },
    }),
    {
      name: 'propose_theme',
      title: 'Propongo colori e caratteri',
      description:
        'Proposes the site’s colors (light and dark), fonts (Google Fonts names) and roundness. Nothing changes now: the person sees the proposal at the end and applies it if they like it. Call it once, with the whole palette; pages built meanwhile use the theme tokens, so they follow it.',
      input: z.object({
        display: z.string().max(60).optional().describe('Font for titles'),
        body: z.string().max(60).optional().describe('Font for text'),
        colors: z.object({ light: colors.optional(), dark: colors.optional() }).optional(),
        btnRadius: z.number().int().min(0).max(999).optional(),
        cardRadius: z.number().int().min(0).max(64).optional(),
      }),
      run: async (input: {
        display?: string
        body?: string
        colors?: { light?: Record<string, string>; dark?: Record<string, string> }
        btnRadius?: number
        cardRadius?: number
      }) => {
        const { theme } = await call<{ theme: Theme }>('GET', '/api/theme')
        const next = normalizeTheme({
          ...theme,
          ...(input.display ? { display: input.display, displayCategory: undefined } : {}),
          ...(input.body ? { body: input.body, bodyCategory: undefined } : {}),
          ...(input.btnRadius !== undefined ? { btnRadius: input.btnRadius } : {}),
          ...(input.cardRadius !== undefined ? { cardRadius: input.cardRadius } : {}),
          colors: {
            light: { ...theme.colors.light, ...input.colors?.light },
            dark: { ...theme.colors.dark, ...input.colors?.dark },
          },
        })
        result.theme = next
        return 'Proposal kept: the person will choose whether to apply it.'
      },
    } as unknown as SiteTool,
  ]

  if (options.askVoice)
    tools.push({
      name: 'propose_voice',
      title: 'Propongo la voce del brand',
      description:
        'Proposes how the site speaks, from the brief: who the brand is and who it writes for, up to three tones, how readers are addressed, words to prefer and to avoid, other rules. Nothing is saved now: the person sees it at the end. Call it once.',
      input: z.object({
        about: z.string().max(1000).optional(),
        tones: z.array(z.string().max(40)).max(3).optional(),
        address: z.enum(['tu', 'voi', 'lei']).optional(),
        prefer: z.string().max(500).optional(),
        avoid: z.string().max(500).optional(),
        rules: z.string().max(1000).optional(),
      }),
      run: async (input: BrandVoice) => {
        result.voice = input
        return 'Proposal kept: the person will choose whether to save it.'
      },
    } as unknown as SiteTool)

  return { tools, result }
}

/** The instructions for a run, in English like the other prompts; the pages are written in the site's language. */
export function briefSystem(input: {
  site: string
  language: string
  collections: string
  existing: string
  voice: string
  askVoice: boolean
  theme: boolean
}): string {
  return `${input.voice ? `${input.voice}\n\n` : ''}You are building the first version of the website "${input.site}" in Materialize, a visual CMS. The person describes the business in a brief; you make the pages as drafts they will review, change and publish themselves.

How to work:
1. Read the site (get_site) and the section library (list_library). ${input.theme ? 'Look at the theme (get_theme) and propose colors and fonts that suit the business (propose_theme), once, before building: keep text and background contrast readable (WCAG AA) in light and dark.' : 'Keep the current theme: do not propose another one.'}${input.askVoice ? ' Propose the brand voice (propose_voice), once.' : ''}
2. Plan a small site that fits the brief: usually a home and 2–4 more pages (at most ${BRIEF_MAX_PAGES}), only the ones the business needs.
3. For each page: create the draft (create_entry, page field left empty, slug "home" for the home page when the address is free), then fill it with edit_page: add sections from the library (add_section) and rewrite every text for this business. Every page gets the same navigation at the top and footer at the bottom, with links to the pages you make (href "/" for the home, "/slug" for the others). Remove library placeholder texts you do not use; never leave "Lorem ipsum" or invented sample names.
4. Fill the search engine field of each page when its collection has one (kind "seo", see get_site) with update_entry: {"title": up to 60 characters, "description": 120–160 characters}.
5. Read each page once more (get_page) and fix what is left.

Rules:
- Write every text in ${input.language}, for real readers: concrete, short, no clichés.
- Use only facts from the brief. Where a fact is missing (prices, addresses, phone numbers, names, numbers, testimonials), write a clear placeholder in square brackets, e.g. "[Indirizzo dello studio]", so the person sees what to fill in. Never invent reviews, clients, awards or figures.
- Images: use pictures already in the media library (list_media) when they fit; otherwise keep the library's placeholder images and write a useful alt text describing the picture to add.
- Pages that already exist stay untouched; do not create a page whose address is already taken (existing pages are listed below).
- Reference pictures, when attached, show a look the person likes: take their mood, layout and colors, never their brand, logos or texts.

Collections with pages built on the canvas: ${input.collections}
Existing entries: ${input.existing}

When done, reply with a short summary in ${input.language}: the pages made and what the person should complete (the bracketed placeholders, images). No lists of technical steps.`
}
