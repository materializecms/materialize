import { buildSection, LIBRARY } from '@materializecms/core/library'
import {
  type Component,
  cloneNode,
  collapseComponents,
  collapseGlobals,
  expandComponents,
  expandGlobals,
  findNode,
  insertNode,
  newId,
  type PageNode,
  plainText,
  removeNode,
  updateNode,
} from '@materializecms/core/page'
import { z } from 'zod'

/**
 * What an AI can do with the site, shared by the MCP server and the editor's assistant. Every tool
 * goes through the HTTP API as the person who asked (their token or their session), so it can do
 * exactly what they could do in the panel: the same checks, the same Content mode limits.
 */

/** Calls the site's own API as the person using the tools. */
export type ApiCall = <T = unknown>(method: string, path: string, body?: unknown) => Promise<T>

/** A page being edited: loaded and saved through the API, or held by the editor (the assistant). */
export interface PageSource {
  load: () => Promise<PageNode[]>
  save: (nodes: PageNode[]) => Promise<void>
}

export interface SiteTool {
  name: string
  /** A short title for clients that show one. */
  title: string
  description: string
  input: z.ZodObject
  /** Only reads: clients may run it without asking. */
  readOnly?: boolean
  run: (input: never) => Promise<unknown>
}

/** An answer the model can act on: what went wrong, in words. */
export class ToolError extends Error {}

const tool = <S extends z.ZodObject>(def: {
  name: string
  title: string
  description: string
  input: S
  readOnly?: boolean
  run: (input: z.infer<S>) => Promise<unknown>
}): SiteTool => def as unknown as SiteTool

type FieldInfo = { name: string; kind: string; label?: string }
type CollectionInfo = {
  name: string
  label?: string
  singleton?: boolean
  fields: FieldInfo[]
  titleField?: string
  slugField?: string
}
type Schema = {
  site: { name: string }
  locales: { default: string; available: string[] }
  collections: CollectionInfo[]
}
type Doc = { id: string; collection: string; title: string; data: Record<string, unknown>; url: string | null }

/** How the page model works, for a model that is about to edit one. */
export const PAGE_GUIDE = `Pages are trees of nodes. The top level holds sections (type "frame"); sections hold frames, texts, images, buttons, icons, videos, scenes and form inputs.
Every node has an "id" (keep existing ids; new nodes may omit it, one is assigned) and a "type".

Common properties:
- Layout of a frame: layout "col" | "row" | "grid", cols (grid columns), gap (px), align "start"|"center"|"end"|"stretch", justify "start"|"center"|"end"|"between", wrap.
- Size: width "fill"|"hug"|"fixed" with fixedW, maxW, h (px or "60vh"), minH (percent of screen height, sections), padX/padY (px), size "xs"|"s"|"m"|"l" (a section's vertical padding).
- Look: bg (theme token or CSS color), scheme "default"|"surface"|"inverse"|"accent" (a section's color scheme), radius (px | "btn" | "card"), border, shadow "none"|"sm"|"lg", gradient, bgImage {src, alt}, bgDim 0-1.
- Text ("text"): text (plain) or runs [{t, b?, i?, href?}], style "display"|"h1"|"h2"|"h3"|"body"|"small"|"eyebrow"|"logo"|"button", tag "h1".."h4"|"p" (HTML element, defaults from style), color, talign "left"|"center"|"right", fontSize, weight, upper, italic.
- Button ("button"): text, href, variant "primary"|"secondary"|"ghost", newTab.
- Image ("image"): src (a URL from the media library, e.g. /media/photo.jpg), alt, ratio ("16/9", "1/1"…), fit "cover"|"contain".
- Icon ("icon"): icon "lucide:arrow-right" style names.
- Motion: anim "fade"|"up"|"down"|"left"|"right"|"zoom"|"blur"|"reveal"|"pop", animTrig "load"|"scroll", hover "lift"|"grow"|"dim"|"zoomimg".
- Tablet and mobile changes go in over: {tablet: {...}, mobile: {...}} (only the properties that differ).
Theme color tokens: bg, surface, text, muted, accent, onAccent, inverse, onInverse, border, line.
Prefer adding ready-made sections from the library (add_section) and then changing their texts, images and colors: they are designed and responsive. Write content in the site's language.`

/** One line per node, indented: what the model reads before editing. */
export function outline(nodes: PageNode[]): string {
  const lines: string[] = []
  const go = (list: PageNode[], depth: number) => {
    for (const n of list) {
      const bits: string[] = [n.type]
      if (n.name) bits.push(`"${n.name}"`)
      if (n.global) bits.push('(shared section: changes apply to every page using it)')
      if (n.component) bits.push('(component copy)')
      if (n.type === 'frame' && n.layout) bits.push(`layout=${n.layout}${n.cols ? ` cols=${n.cols}` : ''}`)
      if (n.style) bits.push(`style=${n.style}`)
      const text = plainText(n)
      if (text) bits.push(JSON.stringify(text.length > 90 ? `${text.slice(0, 90)}…` : text))
      if (n.src) bits.push(`src=${n.src}`)
      if (n.href) bits.push(`href=${n.href}`)
      if (n.bind) bits.push(`list of ${n.bind.collection}`)
      if (n.field) bits.push(`shows field ${n.field}`)
      if (n.hidden) bits.push('hidden')
      lines.push(`${'  '.repeat(depth)}- [${n.id}] ${bits.join(' ')}`)
      if (n.children?.length) go(n.children, depth + 1)
    }
  }
  go(nodes, 0)
  return lines.length ? lines.join('\n') : '(empty page)'
}

/** New nodes get ids where they lack one; the rest stay as they are. */
function withIds(n: PageNode): PageNode {
  return { ...n, id: typeof n.id === 'string' && n.id ? n.id : newId(), children: n.children?.map(withIds) }
}

const nodeShape = z.looseObject({ type: z.string(), id: z.string().optional() })

const operation = z.discriminatedUnion('op', [
  z.object({
    op: z.literal('add_section'),
    key: z.string().describe('Library section, e.g. "hero.split" (see list_library)'),
    index: z.number().int().optional().describe('Position among the sections; default: at the end'),
  }),
  z.object({
    op: z.literal('insert'),
    parentId: z.string().nullable().describe('Container to insert into; null for a new section on the page'),
    index: z.number().int().optional().describe('Position among its children; default: at the end'),
    node: nodeShape.describe('The new node, with its children'),
  }),
  z.object({
    op: z.literal('update'),
    nodeId: z.string(),
    props: z.record(z.string(), z.unknown()).describe('Properties to set; null removes one'),
  }),
  z.object({ op: z.literal('replace'), nodeId: z.string(), node: nodeShape }),
  z.object({ op: z.literal('remove'), nodeId: z.string() }),
  z.object({
    op: z.literal('move'),
    nodeId: z.string(),
    parentId: z.string().nullable(),
    index: z.number().int(),
  }),
  z.object({ op: z.literal('duplicate'), nodeId: z.string() }),
])
export type PageOperation = z.infer<typeof operation>

/** Applies edits to a page tree; stops at the first that cannot apply, saying which and why. */
export function applyOperations(nodes: PageNode[], ops: PageOperation[], brand: string): PageNode[] {
  let tree = nodes
  for (const [i, op] of ops.entries()) {
    const fail = (why: string) => {
      throw new ToolError(`Operation ${i + 1} (${op.op}): ${why}. Nothing was changed.`)
    }
    const need = (id: string) => findNode(tree, id) ?? fail(`there is no node "${id}"`)
    switch (op.op) {
      case 'add_section': {
        if (!LIBRARY.some((c) => c.variants.some((v) => v.key === op.key))) fail(`no library section "${op.key}"`)
        tree = insertNode(tree, null, op.index ?? tree.length, buildSection(op.key, brand))
        break
      }
      case 'insert': {
        if (op.parentId) need(op.parentId)
        const parent = op.parentId ? findNode(tree, op.parentId)?.node : null
        if (parent && parent.type !== 'frame') fail('only frames can hold other nodes')
        const count = parent ? (parent.children?.length ?? 0) : tree.length
        tree = insertNode(tree, op.parentId, op.index ?? count, withIds(op.node as unknown as PageNode))
        break
      }
      case 'update': {
        need(op.nodeId)
        tree = updateNode(tree, op.nodeId, (n) => {
          const next: Record<string, unknown> = { ...n }
          for (const [k, v] of Object.entries(op.props)) {
            if (k === 'id' || k === 'children') continue
            if (v === null) delete next[k]
            else next[k] = v
          }
          // Plain text replaces formatted text.
          if ('text' in op.props && !('runs' in op.props)) delete next.runs
          return next as unknown as PageNode
        })
        break
      }
      case 'replace': {
        need(op.nodeId)
        tree = updateNode(tree, op.nodeId, () => withIds({ ...(op.node as unknown as PageNode), id: op.nodeId }))
        break
      }
      case 'remove':
        need(op.nodeId)
        tree = removeNode(tree, op.nodeId)
        break
      case 'move': {
        const found = need(op.nodeId)
        if (op.parentId && findNode([found.node], op.parentId)) fail('a node cannot go inside itself')
        if (op.parentId) need(op.parentId)
        tree = insertNode(removeNode(tree, op.nodeId), op.parentId, op.index, found.node)
        break
      }
      case 'duplicate': {
        const found = need(op.nodeId)
        tree = insertNode(tree, found.parent?.id ?? null, found.index + 1, cloneNode(found.node))
        break
      }
    }
  }
  return tree
}

/** The page tools: read the outline and a node, and edit. */
export function pageTools(options: {
  /** The page to work on: by document id (MCP), or the one open in the editor (no id). */
  source: (id: string | undefined) => Promise<PageSource>
  withId: boolean
  brand: () => Promise<string>
}): SiteTool[] {
  const id = options.withId
    ? { id: z.string().describe('The page document id (from list_entries)') }
    : ({} as Record<string, never>)
  const idOf = (input: object) => (input as { id?: string }).id
  return [
    tool({
      name: 'get_page',
      title: 'Leggo la pagina',
      description:
        'The page as an outline: one line per node with its id, type, name and text. Read it before editing, and again after big changes.',
      input: z.object({ ...id }),
      readOnly: true,
      run: async (input) => outline(await (await options.source(idOf(input))).load()),
    }),
    tool({
      name: 'get_node',
      title: 'Leggo un elemento',
      description:
        'One node with all its properties and children, as JSON: to see its exact design before changing it.',
      input: z.object({ ...id, nodeId: z.string() }),
      readOnly: true,
      run: async (input) => {
        const found = findNode(await (await options.source(idOf(input))).load(), input.nodeId)
        if (!found) throw new ToolError(`There is no node "${input.nodeId}" on this page`)
        return found.node
      },
    }),
    tool({
      name: 'edit_page',
      title: 'Modifico la pagina',
      description: `Changes the page with a list of operations, applied in order and saved together (all or nothing): add_section from the library, insert a node, update properties, replace, remove, move, duplicate. Returns the new outline.\n\n${PAGE_GUIDE}`,
      input: z.object({ ...id, operations: z.array(operation).min(1).max(60) }),
      run: async (input) => {
        const page = await options.source(idOf(input))
        const next = applyOperations(await page.load(), input.operations, await options.brand())
        await page.save(next)
        return outline(next)
      },
    }),
  ]
}

/** Tools for the whole site: collections and entries, pages by id, theme, media. */
export function siteTools(call: ApiCall): SiteTool[] {
  let schema: Schema | null = null
  const getSchema = async () => (schema ??= await call<Schema>('GET', '/api/schema'))
  const pageField = async (doc: Doc) => {
    const def = (await getSchema()).collections.find((c) => c.name === doc.collection)
    const field = def?.fields.find((f) => f.kind === 'page')
    if (!field) throw new ToolError(`"${doc.title}" is not a page built on the canvas`)
    return field.name
  }

  // A page by id, with shared sections and components expanded as in the editor; saving folds them back.
  const source = async (id: string | undefined): Promise<PageSource> => {
    if (!id) throw new ToolError('Say which page: its id')
    const doc = await call<Doc>('GET', `/api/documents/${encodeURIComponent(id)}`)
    const name = await pageField(doc)
    const { globals } = await call<{ globals: Record<string, PageNode> }>('GET', '/api/globals')
    const { components } = await call<{ components: Record<string, Component> }>('GET', '/api/components')
    return {
      load: async () =>
        expandComponents(
          expandGlobals(Array.isArray(doc.data[name]) ? (doc.data[name] as PageNode[]) : [], globals),
          components,
        ),
      save: async (nodes) => {
        const withRefs = collapseComponents(nodes, components)
        if (JSON.stringify(withRefs.components) !== JSON.stringify(components))
          await call('PUT', '/api/components', { components: withRefs.components })
        const collapsed = collapseGlobals(withRefs.nodes)
        const merged = { ...globals, ...collapsed.globals }
        if (JSON.stringify(merged) !== JSON.stringify(globals)) await call('PUT', '/api/globals', { globals: merged })
        await call('PUT', `/api/documents/${encodeURIComponent(doc.id)}`, {
          data: { ...doc.data, [name]: collapsed.nodes },
        })
      },
    }
  }

  return [
    ...contentTools(call, getSchema),
    ...pageTools({ source, withId: true, brand: async () => (await getSchema()).site.name }),
  ]
}

/**
 * The editor's assistant: the site tools that make sense next to the open page (no publishing:
 * the editor has its own button), and page tools working on the page as the editor holds it.
 */
export function assistantTools(call: ApiCall, page: { nodes: PageNode[] }, brand: string): SiteTool[] {
  let schema: Schema | null = null
  const getSchema = async () => (schema ??= await call<Schema>('GET', '/api/schema'))
  const source = async (): Promise<PageSource> => ({
    load: async () => page.nodes,
    save: async (nodes) => {
      page.nodes = nodes
    },
  })
  return [
    ...contentTools(call, getSchema).filter((t) => t.name !== 'publish_entry' && t.name !== 'unpublish_entry'),
    ...pageTools({ source, withId: false, brand: async () => brand }),
  ]
}

/** Everything but the page editing: shared with the editor's assistant, which edits the open page itself. */
export function contentTools(call: ApiCall, getSchema: () => Promise<Schema>): SiteTool[] {
  return [
    tool({
      name: 'get_site',
      title: 'Guardo il sito',
      description:
        'The site: its name, languages and collections (pages, articles, projects…) with their fields. Start here.',
      input: z.object({}),
      readOnly: true,
      run: async () => {
        const s = await getSchema()
        return {
          site: s.site,
          locales: s.locales,
          collections: s.collections.map((c) => ({
            name: c.name,
            label: c.label,
            singleton: c.singleton,
            fields: c.fields.map((f) => ({ name: f.name, kind: f.kind, label: f.label })),
          })),
        }
      },
    }),
    tool({
      name: 'list_entries',
      title: 'Elenco i contenuti',
      description: 'Entries of a collection (newest changes first), with id, title, address and whether published.',
      input: z.object({
        collection: z.string(),
        search: z.string().optional().describe('Words in the title'),
        locale: z.string().optional(),
        limit: z.number().int().min(1).max(100).optional(),
        offset: z.number().int().min(0).optional(),
      }),
      readOnly: true,
      run: async (input) => {
        const q = new URLSearchParams()
        for (const k of ['search', 'locale', 'limit', 'offset'] as const)
          if (input[k] !== undefined) q.set(k, String(input[k]))
        return call('GET', `/api/collections/${encodeURIComponent(input.collection)}?${q}`)
      },
    }),
    tool({
      name: 'get_entry',
      title: 'Leggo un contenuto',
      description:
        'An entry with all its fields. For pages built on the canvas the page field is long: use get_page to read it as an outline.',
      input: z.object({ id: z.string() }),
      readOnly: true,
      run: async (input) => {
        const doc = await call<Doc & { issues?: unknown[] }>('GET', `/api/documents/${encodeURIComponent(input.id)}`)
        const data: Record<string, unknown> = {}
        for (const [k, v] of Object.entries(doc.data))
          data[k] =
            Array.isArray(v) && (v[0] as PageNode | undefined)?.type
              ? `(page with ${v.length} sections: use get_page)`
              : v
        return { ...doc, data }
      },
    }),
    tool({
      name: 'create_entry',
      title: 'Creo un contenuto',
      description:
        'A new draft in a collection, with the fields given (see get_site for their names). The address (slug) follows the title when left out. Publish it with publish_entry.',
      input: z.object({
        collection: z.string(),
        data: z.record(z.string(), z.unknown()),
        locale: z.string().optional(),
      }),
      run: async (input) => {
        const doc = await call<Doc & { issues?: unknown[] }>(
          'POST',
          `/api/collections/${encodeURIComponent(input.collection)}`,
          { data: input.data, locale: input.locale },
        )
        return { id: doc.id, title: doc.title, url: doc.url, issues: doc.issues }
      },
    }),
    tool({
      name: 'update_entry',
      title: 'Modifico un contenuto',
      description:
        'Changes some fields of an entry (the others stay as they are) and saves the draft. Use edit_page for the design of a page.',
      input: z.object({ id: z.string(), data: z.record(z.string(), z.unknown()) }),
      run: async (input) => {
        const doc = await call<Doc>('GET', `/api/documents/${encodeURIComponent(input.id)}`)
        const saved = await call<Doc & { issues?: unknown[] }>('PUT', `/api/documents/${encodeURIComponent(doc.id)}`, {
          data: { ...doc.data, ...input.data },
        })
        return { id: saved.id, title: saved.title, url: saved.url, issues: saved.issues }
      },
    }),
    tool({
      name: 'publish_entry',
      title: 'Pubblico',
      description: 'Puts the current draft of an entry on the public site.',
      input: z.object({ id: z.string() }),
      run: async (input) => {
        const doc = await call<Doc>('POST', `/api/documents/${encodeURIComponent(input.id)}/publish`)
        return { id: doc.id, title: doc.title, url: doc.url, published: true }
      },
    }),
    tool({
      name: 'unpublish_entry',
      title: 'Tolgo dal sito',
      description: 'Takes an entry off the public site; it stays as a draft.',
      input: z.object({ id: z.string() }),
      run: async (input) => {
        const doc = await call<Doc>('POST', `/api/documents/${encodeURIComponent(input.id)}/unpublish`)
        return { id: doc.id, title: doc.title, published: false }
      },
    }),
    tool({
      name: 'list_translations',
      title: 'Guardo le lingue',
      description:
        'The language versions of an entry (its original and translations, with id and status) and the site languages it is still missing.',
      input: z.object({ id: z.string() }),
      readOnly: true,
      run: (input) => call('GET', `/api/documents/${encodeURIComponent(input.id)}/translations`),
    }),
    tool({
      name: 'translate_entry',
      title: 'Traduco',
      description:
        'Creates the version of an entry in another site language, as a draft linked to the original. With translate: true the site AI translates every text (and the address); otherwise it is a copy to translate, e.g. with update_entry or edit_page. Menus and footers shared by pages are translated once per language in the editor.',
      input: z.object({
        id: z.string(),
        locale: z.string().describe('A language code from get_site, e.g. "en"'),
        translate: z.boolean().default(true),
      }),
      run: async (input) => {
        const doc = await call<Doc>('POST', `/api/documents/${encodeURIComponent(input.id)}/translations`, {
          locale: input.locale,
          translate: input.translate,
        })
        return { id: doc.id, title: doc.title, url: doc.url, locale: input.locale, published: false }
      },
    }),
    tool({
      name: 'list_library',
      title: 'Guardo la libreria di sezioni',
      description: 'Ready-made sections that can be added to a page (edit_page → add_section), by category.',
      input: z.object({}),
      readOnly: true,
      run: async () =>
        LIBRARY.map((c) => ({ category: c.label, sections: c.variants.map((v) => `${v.key} (${v.label})`) })),
    }),
    tool({
      name: 'get_theme',
      title: 'Leggo il tema',
      description: 'The design theme: colors (light and dark), fonts, roundness, text styles.',
      input: z.object({}),
      readOnly: true,
      run: async () => (await call<{ theme: unknown }>('GET', '/api/theme')).theme,
    }),
    tool({
      name: 'update_theme',
      title: 'Modifico il tema',
      description:
        'Changes the theme: give only what changes, e.g. {"display": "Fraunces", "colors": {"light": {"accent": "#e94f37"}}}. Fonts are Google Fonts names. Applies to the whole site at once.',
      input: z.object({ patch: z.record(z.string(), z.unknown()) }),
      run: async (input) => {
        const { theme } = await call<{ theme: Record<string, unknown> }>('GET', '/api/theme')
        return (await call<{ theme: unknown }>('PUT', '/api/theme', { theme: merge(theme, input.patch) })).theme
      },
    }),
    tool({
      name: 'list_media',
      title: 'Guardo la libreria media',
      description: 'Images and files already uploaded, with their address (src) to use in pages and fields.',
      input: z.object({ search: z.string().optional(), limit: z.number().int().min(1).max(100).optional() }),
      readOnly: true,
      run: async (input) => {
        const q = new URLSearchParams({ limit: String(input.limit ?? 40) })
        if (input.search) q.set('search', input.search)
        return call('GET', `/api/media?${q}`)
      },
    }),
    tool({
      name: 'upload_media_from_url',
      title: 'Aggiungo un’immagine dal web',
      description:
        'Downloads an image from a public https address into the media library and returns its src. Only use images the site may publish.',
      input: z.object({ url: z.url(), alt: z.string().max(500).optional() }),
      run: async (input) => call('POST', '/api/media/from-url', input),
    }),
  ]
}

/** Deep merge of plain objects: what the patch has wins, the rest stays. */
function merge(base: Record<string, unknown>, patch: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...base }
  for (const [k, v] of Object.entries(patch)) {
    const b = base[k]
    out[k] =
      v && typeof v === 'object' && !Array.isArray(v) && b && typeof b === 'object' && !Array.isArray(b)
        ? merge(b as Record<string, unknown>, v as Record<string, unknown>)
        : v
  }
  return out
}

/**
 * Calls the API as whoever sent `auth` (cookie or bearer header): in process through the Hono app's
 * `fetch`, or over the network to a running server at `origin` (`materialize mcp`).
 */
export function apiCaller(
  fetch: (req: Request) => Response | Promise<Response>,
  auth: Record<string, string>,
  origin = 'http://materialize.internal',
): ApiCall {
  return async (method, path, body) => {
    const res = await fetch(
      new Request(origin + path, {
        method,
        headers: { ...auth, origin, ...(body === undefined ? {} : { 'content-type': 'application/json' }) },
        body: body === undefined ? undefined : JSON.stringify(body),
      }),
    )
    const json = (await res.json().catch(() => null)) as {
      error?: { message?: string; issues?: { path: string; message: string }[] }
    } | null
    if (!res.ok) {
      const issues = json?.error?.issues?.map((i) => `${i.path}: ${i.message}`).join('; ')
      throw new ToolError(`${json?.error?.message ?? `HTTP ${res.status}`}${issues ? ` (${issues})` : ''}`)
    }
    return json as never
  }
}
