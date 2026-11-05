import {
  type Component,
  collapseComponents,
  collapseGlobals,
  expandComponents,
  expandGlobals,
  type PageNode,
} from '@materializecms/core/page'
import { type ApiCall, contentTools, pageTools, type SiteSchema, type SiteTool, ToolError } from './tools.ts'

/**
 * The request on the dashboard: the AI works on the whole site, in drafts only. It cannot
 * publish, schedule, share or change what is live at once (the theme, shared sections,
 * components): those stay with the person, in the panel.
 */

/** Tools that act on the live site at once: left out. */
const LIVE = new Set([
  'publish_entry',
  'unpublish_entry',
  'schedule_entry',
  'share_preview',
  'update_theme',
  'publish_release',
  'schedule_release',
])

export interface Touched {
  id: string
  collection: string
  title: string
}

type Doc = { id: string; collection: string; title: string; data: Record<string, unknown> }

export function studioTools(call: ApiCall, onTouched: (doc: Touched) => void): SiteTool[] {
  let schema: SiteSchema | null = null
  const getSchema = async () => (schema ??= await call<SiteSchema>('GET', '/api/schema'))
  const touched = (doc: { id: string; collection?: string; title: string }) =>
    doc.collection && onTouched({ id: doc.id, collection: doc.collection, title: doc.title })

  const base = contentTools(call, getSchema)
    .filter((t) => !LIVE.has(t.name))
    .map((t) =>
      ['create_entry', 'update_entry', 'translate_entry'].includes(t.name)
        ? {
            ...t,
            run: async (input: never) => {
              const out = (await t.run(input)) as { id?: string; title?: string }
              if (out?.id) {
                const doc = await call<Doc>('GET', `/api/documents/${encodeURIComponent(out.id)}`)
                touched(doc)
              }
              return out
            },
          }
        : t,
    )

  const page = pageTools({
    withId: true,
    brand: async () => (await getSchema()).site.name,
    source: async (id) => {
      if (!id) throw new ToolError('Say which page: its id')
      const doc = await call<Doc>('GET', `/api/documents/${encodeURIComponent(id)}`)
      const def = (await getSchema()).collections.find((c) => c.name === doc.collection)
      const field = def?.fields.find((f) => f.kind === 'page')?.name
      if (!field) throw new ToolError(`"${doc.title}" is not a page built on the canvas`)
      const { globals } = await call<{ globals: Record<string, PageNode> }>('GET', '/api/globals')
      const { components } = await call<{ components: Record<string, Component> }>('GET', '/api/components')
      return {
        load: async () =>
          expandComponents(
            expandGlobals(Array.isArray(doc.data[field]) ? (doc.data[field] as PageNode[]) : [], globals),
            components,
          ),
        save: async (nodes) => {
          const withRefs = collapseComponents(nodes, components)
          const collapsed = collapseGlobals(withRefs.nodes)
          const changedShared =
            JSON.stringify(withRefs.components) !== JSON.stringify(components) ||
            Object.entries(collapsed.globals).some(([k, v]) => JSON.stringify(v) !== JSON.stringify(globals[k]))
          if (changedShared)
            throw new ToolError(
              'That changes a shared section or a component, which is live on every page at once: leave it as it is and tell the person to change it in the editor. Nothing was saved.',
            )
          await call('PUT', `/api/documents/${encodeURIComponent(doc.id)}`, {
            data: { ...doc.data, [field]: collapsed.nodes },
          })
          touched(doc)
        },
      }
    },
  })
  return [...base, ...page]
}

export function studioSystem(input: { site: string; user: string; voice: string; limited: boolean }): string {
  return `${input.voice ? `${input.voice}\n\n` : ''}You are the assistant on the dashboard of Materialize, the CMS of the website "${input.site}". ${input.user} asks you for something about the site: pages, articles, texts, translations, the search engine fields.

Work with the tools: look first (get_site, list_entries, get_entry, get_page), then change. Every change goes into drafts: you cannot publish, schedule, share or change the theme, shared sections (menus, footers) or components. When something needs those, do the rest and say what the person should do in the panel.
Change only what was asked; keep the design and the ids of existing nodes; prefer library sections for new ones. Use only facts you find on the site or in the request: where one is missing, write a placeholder in square brackets.
${input.limited ? 'This person may change only contents (texts, links, images), not layout or design.\n' : ''}When done, reply in the person's language in two or three short sentences: what you changed and what to check before publishing. If you could not do something, say so.`
}
