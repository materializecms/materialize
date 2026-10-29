import { buildSection } from '@materializecms/core/library'
import {
  type BoundEntry,
  type Breakpoint,
  type Component,
  cloneNode,
  collapseComponents,
  collapseGlobals,
  DEFAULT_THEME,
  detachComponent,
  expandComponents,
  expandGlobals,
  findNode,
  insertNode,
  makeComponent,
  type NodeProps,
  newId,
  type PageNode,
  palette,
  type Run,
  removeNode,
  resolveNode,
  type SharedTextStyle,
  TEXT_STYLE_KEYS,
  type Theme,
  updateNode,
  walk,
  withTextStyle,
} from '@materializecms/core/page'
import { useQueries, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Code,
  Eye,
  Image as ImageIcon,
  Layers as LayersIcon,
  Maximize,
  Minus,
  Monitor,
  MousePointerClick,
  Palette,
  Play,
  Plus,
  Rows3,
  Ruler,
  Smartphone,
  Sparkles,
  Tablet,
  Type,
  Video,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSession } from '../app/context.ts'
import { cx, IconButton, Segmented, toast } from '../components/ui.tsx'
import { FieldsForm } from '../fields/FieldInput.tsx'
import { api, type CollectionDescription, type Data, type FieldDescription } from '../lib/api.ts'
import { usePref } from '../lib/prefs.ts'
import { MediaPicker } from '../media/MediaPicker.tsx'
import { type AlignHow, alignPatches } from './align.ts'
import { Canvas, type DropTarget, type Mode } from './Canvas.tsx'
import { loadFont } from './fonts.ts'
import { Inspector } from './Inspector.tsx'
import { Layers } from './Layers.tsx'
import { type ElementKind, Library } from './Library.tsx'
import { simplify } from './runs.ts'
import { ThemePanel } from './ThemePanel.tsx'

type Tab = 'layers' | 'add' | 'styles'

/** The sections of a ready-made page. */
const STARTER = ['nav.classic', 'hero.split', 'features.cols', 'cta.banner', 'footer.simple']

/** Properties that are content, the same on every device. */
const CONTENT_KEYS = new Set<string>([
  'textStyle',
  'stickyHide',
  'stickyGlass',
  'stickyOverlay',
  'anchor',
  'scene',
  'bind',
  'field',
  'global',
  'html',
  'poster',
  'controls',
  'text',
  'runs',
  'src',
  'alt',
  'href',
  'newTab',
  'name',
  'focal',
  'bgImage',
  'bgDim',
])

/** The element without its own typography, so a shared text style shows through on every device. */
function clearTypography(n: PageNode): PageNode {
  const out: PageNode = { ...n }
  for (const k of TEXT_STYLE_KEYS) delete out[k]
  const over: PageNode['over'] = {}
  for (const bp of ['tablet', 'mobile'] as const) {
    const own = { ...n.over?.[bp] }
    for (const k of TEXT_STYLE_KEYS) delete own[k]
    if (Object.keys(own).length) over[bp] = own
  }
  out.over = over
  return out
}

/** The typography an element sets itself, on desktop and per device. */
function ownTypography(n: PageNode): Pick<SharedTextStyle, 'props' | 'over'> {
  const pick = (from: Partial<PageNode> | undefined) =>
    Object.fromEntries(
      TEXT_STYLE_KEYS.flatMap((k) => (from?.[k] !== undefined && from?.[k] !== null ? [[k, from[k]]] : [])),
    )
  const over: SharedTextStyle['over'] = {}
  for (const bp of ['tablet', 'mobile'] as const) {
    const own = pick(n.over?.[bp])
    if (Object.keys(own).length) over[bp] = own
  }
  return { props: pick(n), over }
}

function newElement(kind: ElementKind): PageNode {
  const id = newId()
  if (kind === 'text')
    return { id, type: 'text', name: 'Testo', text: 'Nuovo testo', style: 'body', color: 'text', width: 'fill' }
  if (kind === 'image')
    return {
      id,
      type: 'image',
      name: 'Immagine',
      src: null,
      alt: '',
      ratio: '4/3',
      tone: 1,
      radius: 'card',
      width: 'fill',
    }
  if (kind === 'scene')
    return {
      id,
      type: 'scene',
      name: 'Scena WebGL',
      scene: { preset: 'mesh' },
      ratio: '16/9',
      radius: 'card',
      width: 'fill',
    }
  if (kind === 'video')
    return { id, type: 'video', name: 'Video', src: null, ratio: '16/9', tone: 2, radius: 'card', width: 'fill' }
  if (kind === 'embed')
    return {
      id,
      type: 'embed',
      name: 'Codice',
      html: '<div style="padding:24px;text-align:center">Codice personalizzato</div>',
      width: 'fill',
    }
  if (kind === 'button')
    return {
      id,
      type: 'button',
      name: 'Pulsante',
      text: 'Pulsante',
      variant: 'primary',
      href: '/contatti',
      width: 'hug',
      padX: 24,
      padY: 14,
      radius: 'btn',
    }
  return { id, type: 'frame', name: 'Contenitore', layout: 'col', gap: 16, width: 'fill', children: [] }
}

/**
 * The canvas editor for a page field: like the design prototype, sections are made of elements
 * that can be selected, edited in place, styled per device and animated.
 */
export function PageEditor({
  collection,
  pageField,
  data,
  onChange,
  mode,
}: {
  collection: CollectionDescription
  pageField: FieldDescription
  data: Data
  onChange: (next: Data, group?: string) => void
  mode: Mode
}) {
  const { user, schema, locale } = useSession()
  const queryClient = useQueryClient()
  const globalsQuery = useQuery({ queryKey: ['globals'], queryFn: api.globals, staleTime: Infinity })
  const globals = globalsQuery.data?.globals ?? {}
  const componentsQuery = useQuery({ queryKey: ['components'], queryFn: api.components, staleTime: Infinity })
  const components = componentsQuery.data?.components ?? {}
  // Global sections are stored once for the site: the page keeps references, the canvas shows their content.
  const nodes = useMemo(
    () =>
      expandComponents(
        expandGlobals(Array.isArray(data[pageField.name]) ? (data[pageField.name] as PageNode[]) : [], globals),
        components,
      ),
    [data, pageField.name, globals, components],
  )
  // Entries for the lists bound to a collection.
  const boundNames = useMemo(() => {
    const out = new Set<string>()
    walk(nodes, (n) => {
      if (n.bind?.collection) out.add(n.bind.collection)
    })
    return [...out]
  }, [nodes])
  const boundData = useQueries({
    queries: boundNames.map((name) => ({
      queryKey: ['entries', name, locale],
      queryFn: () => api.entries(name, locale),
      staleTime: 30_000,
    })),
    combine: useCallback(
      (results: { data?: { items: BoundEntry[] } }[]) => {
        const out: Record<string, BoundEntry[]> = {}
        boundNames.forEach((name, i) => {
          out[name] = results[i]?.data?.items ?? []
        })
        return out
      },
      [boundNames],
    ),
  })
  // The selection: the last element picked is the one the inspector shows; shift adds more.
  const [selection, setSelection] = useState<string[]>([])
  const selected = selection[selection.length - 1] ?? null
  const setSelected = useCallback((id: string | null) => setSelection(id ? [id] : []), [])
  const selectionRef = useRef(selection)
  selectionRef.current = selection
  const toggleSelected = (id: string) => setSelection((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]))
  const [editing, setEditing] = useState<string | null>(null)
  const [device, setDevice] = useState<Breakpoint>('desktop')
  const [zoom, setZoom] = useState<'fit' | number>('fit')
  const [fitZoom, setFitZoom] = useState(1)
  const [tab, setTab] = usePref<Tab>('mz-page-tab', 'layers')
  const [rulerPref, setRulerPref] = usePref<'on' | 'off'>('mz-rulers', 'on')
  const rulers = rulerPref === 'on'
  const setRulers = (on: boolean) => setRulerPref(on ? 'on' : 'off')
  const [playing, setPlaying] = useState(0)
  const [previewing, setPreviewing] = useState(false)
  const [picking, setPicking] = useState<{ id: string; target: 'src' | 'bgImage' | 'poster' | 'sceneImage' } | null>(
    null,
  )
  const clipboard = useRef<PageNode | null>(null)
  const typeAhead = useRef('')

  const themeQuery = useQuery({ queryKey: ['theme'], queryFn: api.theme, staleTime: Infinity })
  const theme = themeQuery.data?.theme ?? DEFAULT_THEME
  const saveTimer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const setTheme = (next: Theme) => {
    queryClient.setQueryData(['theme'], { theme: next })
    clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      api.saveTheme(next).catch((e: Error) => toast(e.message, 'error'))
    }, 500)
  }

  // The theme's fonts, for the canvas and the library previews; fonts chosen for single elements too.
  useEffect(() => {
    loadFont(theme.display)
    loadFont(theme.body)
  }, [theme.display, theme.body])

  useEffect(() => {
    walk(nodes, (n) => {
      if (n.font?.family) loadFont(n.font.family)
    })
  }, [nodes])

  const nodesRef = useRef(nodes)
  nodesRef.current = nodes
  const dataRef = useRef(data)
  dataRef.current = data
  const globalsRef = useRef(globals)
  globalsRef.current = globals
  const componentsRef = useRef(components)
  componentsRef.current = components
  const componentsTimer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const globalsTimer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const setNodes = useCallback(
    (next: PageNode[], group?: string) => {
      // Copies of components go back to references; what changed in their design goes to the component.
      const withRefs = collapseComponents(next, componentsRef.current)
      if (JSON.stringify(withRefs.components) !== JSON.stringify(componentsRef.current)) {
        queryClient.setQueryData(['components'], { components: withRefs.components })
        componentsRef.current = withRefs.components
        clearTimeout(componentsTimer.current)
        componentsTimer.current = setTimeout(() => {
          api.saveComponents(withRefs.components).catch((e: Error) => toast(e.message, 'error'))
        }, 600)
      }
      const collapsed = collapseGlobals(withRefs.nodes)
      const merged = { ...globalsRef.current, ...collapsed.globals }
      if (JSON.stringify(merged) !== JSON.stringify(globalsRef.current)) {
        queryClient.setQueryData(['globals'], { globals: merged })
        clearTimeout(globalsTimer.current)
        globalsTimer.current = setTimeout(() => {
          api.saveGlobals(merged).catch((e: Error) => toast(e.message, 'error'))
        }, 600)
      }
      onChange({ ...dataRef.current, [pageField.name]: collapsed.nodes }, group)
    },
    [onChange, pageField.name, queryClient],
  )

  const info = findNode(nodes, selected)
  // Elements removed by undo or elsewhere leave the selection.
  useEffect(() => {
    if (selection.some((id) => !findNode(nodes, id))) setSelection((s) => s.filter((id) => findNode(nodes, id)))
  }, [selection, nodes])

  /** Design changes: on tablet and mobile they go into that device's overrides. */
  const patchNode = useCallback(
    (list: PageNode[], id: string, patch: Partial<NodeProps>) =>
      updateNode(list, id, (n) => {
        const base: Partial<PageNode> = {}
        const own: Partial<NodeProps> = {}
        for (const [k, v] of Object.entries(patch)) {
          if (device === 'desktop' || CONTENT_KEYS.has(k)) (base as Record<string, unknown>)[k] = v
          else (own as Record<string, unknown>)[k] = v
        }
        let next: PageNode = { ...n, ...base }
        if (Object.keys(own).length) {
          next = { ...next, over: { ...n.over, [device]: { ...n.over?.[device as 'tablet'], ...own } } }
        }
        return next
      }),
    [device],
  )
  const setProps = useCallback(
    (id: string, patch: Partial<NodeProps>, group?: string) => setNodes(patchNode(nodesRef.current, id, patch), group),
    [patchNode, setNodes],
  )
  /** Several elements in one change (one step of undo). */
  const setPropsMany = useCallback(
    (patches: [string, Partial<NodeProps>][], group?: string) => {
      if (!patches.length) return
      setNodes(
        patches.reduce((list, [id, patch]) => patchNode(list, id, patch), nodesRef.current),
        group,
      )
    },
    [patchNode, setNodes],
  )
  /** From the inspector: design goes to every selected element, content only to the one shown. */
  const setSelectionProps = (patch: Partial<NodeProps>, group?: string) => {
    const ids = selectionRef.current
    if (!selected) return
    const design = Object.fromEntries(Object.entries(patch).filter(([k]) => !CONTENT_KEYS.has(k) || k === 'textStyle'))
    setPropsMany(
      ids.map((id) => [id, id === selected ? patch : design] as [string, Partial<NodeProps>]),
      group && ids.length > 1 ? `${group}:multi` : group,
    )
  }

  const resetProps = (id: string, keys: (keyof NodeProps)[]) => {
    if (device === 'desktop') return
    setNodes(
      updateNode(nodesRef.current, id, (n) => {
        const own = { ...n.over?.[device] }
        for (const k of keys) delete own[k]
        const over = { ...n.over, [device]: own }
        if (!Object.keys(own).length) delete over[device]
        return { ...n, over }
      }),
    )
  }

  const remove = (id: string) => {
    const f = findNode(nodesRef.current, id)
    if (!f) return
    setNodes(removeNode(nodesRef.current, id))
    const sibling = f.siblings[f.index + 1] ?? f.siblings[f.index - 1]
    setSelected(sibling?.id ?? f.parent?.id ?? null)
  }
  const removeSelection = () => {
    const ids = selectionRef.current
    if (ids.length < 2) {
      if (ids[0]) remove(ids[0])
      return
    }
    const parent = findNode(nodesRef.current, ids[0])?.parent?.id ?? null
    setNodes(ids.reduce((list, id) => removeNode(list, id), nodesRef.current))
    setSelected(parent)
  }

  /** Siblings of the selection under one parent, in page order; null when they are spread around. */
  const siblingsOfSelection = () => {
    const found = selectionRef.current.map((id) => findNode(nodesRef.current, id))
    if (!found.length || found.some((f) => !f)) return null
    const parent = found[0]?.parent?.id ?? null
    if (found.some((f) => (f?.parent?.id ?? null) !== parent)) return null
    return found.sort((a, b) => (a?.index ?? 0) - (b?.index ?? 0)) as NonNullable<(typeof found)[number]>[]
  }

  /** Wraps the selected siblings in a new container, where the first of them was. */
  const group = () => {
    const list = siblingsOfSelection()
    const first = list?.[0]
    if (!list || !first) {
      toast('Per raggruppare, seleziona elementi dello stesso contenitore', 'error')
      return
    }
    if (first.depth === 0) {
      toast('Le sezioni non si raggruppano: seleziona elementi al loro interno', 'error')
      return
    }
    const parentLayout = first.parent ? (resolveNode(first.parent, device).layout ?? 'col') : 'col'
    const frame: PageNode = {
      id: newId(),
      type: 'frame',
      name: 'Gruppo',
      layout: parentLayout === 'row' ? 'row' : 'col',
      gap: 16,
      width: 'fill',
      children: list.map((f) => f.node),
    }
    const without = list.reduce((acc, f) => removeNode(acc, f.node.id), nodesRef.current)
    setNodes(insertNode(without, first.parent?.id ?? null, first.index, frame))
    setSelected(frame.id)
  }

  /** Puts a container's elements in its place. */
  const ungroup = () => {
    const f = findNode(nodesRef.current, selected)
    if (f?.node.type !== 'frame' || f.depth === 0 || !f.node.children?.length || f.node.component) return
    const kids = f.node.children
    let list = removeNode(nodesRef.current, f.node.id)
    kids.forEach((k, i) => {
      list = insertNode(list, f.parent?.id ?? null, f.index + i, k)
    })
    setNodes(list)
    setSelection(kids.map((k) => k.id))
  }

  /** Lines up the selection: free elements by position, the others through their container. */
  const align = (how: AlignHow) => {
    const result = alignPatches(how, selectionRef.current, nodesRef.current, device)
    if ('error' in result) toast(result.error, 'error')
    else setPropsMany(result.patches)
  }

  const insertAfterSelection = (node: PageNode) => {
    const list = nodesRef.current
    const f = findNode(list, selected)
    let parentId: string | null
    let index: number
    if (!f) {
      // Nothing selected: into the last section, or a new one.
      const last = list[list.length - 1]
      if (!last) {
        const section: PageNode = {
          id: newId(),
          type: 'frame',
          name: 'Sezione',
          layout: 'col',
          gap: 24,
          size: 'm',
          children: [node],
        }
        setNodes([section])
        setSelected(node.id)
        return
      }
      parentId = last.id
      index = last.children?.length ?? 0
    } else if (f.node.type === 'frame') {
      parentId = f.node.id
      index = f.node.children?.length ?? 0
    } else {
      parentId = f.parent?.id ?? null
      index = f.index + 1
    }
    setNodes(insertNode(list, parentId, index, node))
    setSelected(node.id)
  }

  const addSection = (key: string) => {
    const section = buildSection(key, schema.site.name)
    const f = findNode(nodesRef.current, selected)
    const index = f ? nodesRef.current.indexOf(f.root) + 1 : nodesRef.current.length
    setNodes(insertNode(nodesRef.current, null, index, section))
    setSelected(section.id)
    revealOnCanvas(section.id)
    setTimeout(play, 60)
  }

  /** Brings a new section into view on the canvas, once drawn. */
  const revealOnCanvas = (id: string) =>
    setTimeout(
      () =>
        document
          .querySelector(`[data-mz-canvas] [data-mz-id="${CSS.escape(id)}"]`)
          ?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }),
      80,
    )

  const duplicate = (id: string) => {
    const f = findNode(nodesRef.current, id)
    if (!f) return
    // A copy of a component stays a copy: same component, variant and content.
    const copy = f.node.component ? showCopy({ ...refOf(f.node), id: newId() }) : cloneNode(f.node)
    setNodes(insertNode(nodesRef.current, f.parent?.id ?? null, f.index + 1, copy))
    setSelected(copy.id)
  }
  const duplicateSelection = () => {
    const ids = selectionRef.current
    if (ids.length < 2) {
      if (ids[0]) duplicate(ids[0])
      return
    }
    let list = nodesRef.current
    const copies: string[] = []
    for (const id of ids) {
      const f = findNode(list, id)
      if (!f) continue
      const copy = f.node.component ? showCopy({ ...refOf(f.node), id: newId() }) : cloneNode(f.node)
      list = insertNode(list, f.parent?.id ?? null, f.index + 1, copy)
      copies.push(copy.id)
    }
    setNodes(list)
    setSelection(copies)
  }

  // ---------- shared text styles ----------

  const textStyleList = theme.textStyles ?? []
  const textStyleActions = {
    /** Links the selected texts to a style (their own typography gives way), or unlinks them keeping the look. */
    apply: (styleId: string | null) => {
      let list = nodesRef.current
      for (const id of selectionRef.current) {
        list = updateNode(list, id, (n) => {
          if (n.type !== 'text' && n.type !== 'button') return n
          if (styleId) return { ...clearTypography(n), textStyle: styleId }
          const { textStyle: _, ...rest } = withTextStyle(n, theme)
          return rest
        })
      }
      setNodes(list)
    },
    create: (name: string) => {
      const n = findNode(nodesRef.current, selected)?.node
      if (!n) return
      const style: SharedTextStyle = { id: newId(), name, ...ownTypography(withTextStyle(n, theme)) }
      if (!style.props.style) style.props.style = n.type === 'button' ? 'button' : 'body'
      setTheme({ ...theme, textStyles: [...textStyleList, style] })
      setNodes(updateNode(nodesRef.current, n.id, (x) => ({ ...clearTypography(x), textStyle: style.id })))
      toast(`Stile “${name}” creato: ora lo puoi usare su ogni testo`)
    },
    /** The element's own changes become the style's, for every text that uses it. */
    update: () => {
      const n = findNode(nodesRef.current, selected)?.node
      const style = textStyleList.find((s) => s.id === n?.textStyle)
      if (!n || !style) return
      const own = ownTypography(n)
      const over: SharedTextStyle['over'] = {}
      for (const bp of ['tablet', 'mobile'] as const) {
        const merged = { ...style.over?.[bp], ...own.over?.[bp] }
        if (Object.keys(merged).length) over[bp] = merged
      }
      setTheme({
        ...theme,
        textStyles: textStyleList.map((s) =>
          s.id === style.id ? { ...s, props: { ...s.props, ...own.props }, over } : s,
        ),
      })
      setNodes(updateNode(nodesRef.current, n.id, (x) => ({ ...clearTypography(x), textStyle: style.id })))
    },
    /** Drops the element's own changes: back to the style. */
    reset: () => {
      const n = findNode(nodesRef.current, selected)?.node
      if (n?.textStyle)
        setNodes(updateNode(nodesRef.current, n.id, (x) => ({ ...clearTypography(x), textStyle: n.textStyle })))
    },
  }

  const move = (id: string, dir: -1 | 1) => {
    const f = findNode(nodesRef.current, id)
    if (!f) return
    const to = f.index + dir
    if (to < 0 || to >= f.siblings.length) return
    const without = removeNode(nodesRef.current, id)
    setNodes(insertNode(without, f.parent?.id ?? null, to, f.node))
  }

  // ---------- components ----------

  const storeComponents = (next: Record<string, Component>) => {
    componentsRef.current = next
    queryClient.setQueryData(['components'], { components: next })
    clearTimeout(componentsTimer.current)
    componentsTimer.current = setTimeout(() => {
      api.saveComponents(next).catch((e: Error) => toast(e.message, 'error'))
    }, 300)
  }
  /** A copy as stored: reference, variant and own content. */
  const refOf = (n: PageNode) => collapseComponents([n], componentsRef.current).nodes[0] as PageNode
  const showCopy = (ref: PageNode) => expandComponents([ref], componentsRef.current)[0] as PageNode
  const replaceNode = (id: string, node: PageNode) => setNodes(updateNode(nodesRef.current, id, () => node))

  const componentActions = {
    make: (id: string) => {
      const f = findNode(nodesRef.current, id)
      if (!f) return
      const { component, ref } = makeComponent(f.node, f.node.name || 'Componente')
      storeComponents({ ...componentsRef.current, [component.id]: { ...component, section: f.depth === 0 } })
      replaceNode(id, showCopy(ref))
      toast('Componente creato: lo trovi nella libreria')
    },
    setVariant: (id: string, variantId: string) => {
      const n = findNode(nodesRef.current, id)?.node
      if (n) replaceNode(id, showCopy({ ...refOf(n), componentVariant: variantId }))
    },
    addVariant: (id: string, name: string) => {
      const n = findNode(nodesRef.current, id)?.node
      const def = n?.component ? componentsRef.current[n.component] : undefined
      if (!n || !def) return
      const current = def.variants.find((v) => v.id === n.componentVariant) ?? def.variants[0]
      if (!current) return
      const variant = { id: newId(), name, node: structuredClone(current.node) }
      storeComponents({ ...componentsRef.current, [def.id]: { ...def, variants: [...def.variants, variant] } })
      replaceNode(id, showCopy({ ...refOf(n), componentVariant: variant.id }))
    },
    renameVariant: (cid: string, vid: string, name: string) => {
      const def = componentsRef.current[cid]
      if (def)
        storeComponents({
          ...componentsRef.current,
          [cid]: { ...def, variants: def.variants.map((v) => (v.id === vid ? { ...v, name } : v)) },
        })
    },
    rename: (cid: string, name: string) => {
      const def = componentsRef.current[cid]
      if (def) storeComponents({ ...componentsRef.current, [cid]: { ...def, name } })
    },
    detach: (id: string) => {
      const n = findNode(nodesRef.current, id)?.node
      if (n) {
        const copy = detachComponent(n)
        replaceNode(id, copy)
        setSelected(copy.id)
      }
    },
    reset: (id: string) => {
      const n = findNode(nodesRef.current, id)?.node
      if (n) replaceNode(id, showCopy({ ...refOf(n), overrides: null }))
    },
    insert: (cid: string) => {
      const def = componentsRef.current[cid]
      if (!def?.variants[0]) return
      const copy = showCopy({ id: newId(), type: 'frame', component: cid, componentVariant: def.variants[0].id })
      if (def.section) {
        const f = findNode(nodesRef.current, selected)
        const index = f ? nodesRef.current.indexOf(f.root) + 1 : nodesRef.current.length
        setNodes(insertNode(nodesRef.current, null, index, copy))
        setSelected(copy.id)
      } else insertAfterSelection(copy)
    },
  }

  /** Puts a new node where it was dropped: before or after another, or inside a frame. */
  const placeAt = (node: PageNode, target: DropTarget) => {
    const list = nodesRef.current
    if (target.where === 'inside') {
      const parent = findNode(list, target.id)?.node
      setNodes(insertNode(list, target.id, parent?.children?.length ?? 0, node))
    } else {
      const t = findNode(list, target.id)
      if (!t) return
      setNodes(insertNode(list, t.parent?.id ?? null, t.index + (target.where === 'after' ? 1 : 0), node))
    }
    setSelected(node.id)
  }

  const moveTo = (id: string, target: DropTarget) => {
    const list = nodesRef.current
    const f = findNode(list, id)
    const t = findNode(list, target.id)
    if (!f || !t || id === target.id) return
    const without = removeNode(list, id)
    if (target.where === 'inside') {
      const parent = findNode(without, target.id)?.node
      setNodes(insertNode(without, target.id, parent?.children?.length ?? 0, f.node))
    } else {
      const again = findNode(without, target.id)
      if (!again) return
      setNodes(insertNode(without, again.parent?.id ?? null, again.index + (target.where === 'after' ? 1 : 0), f.node))
    }
    setSelected(id)
  }

  /** Several elements to one place, in page order, next to each other. */
  const moveManyTo = (ids: string[], target: DropTarget) => {
    const list = nodesRef.current
    if (ids.includes(target.id)) return
    const order: string[] = []
    walk(list, (n) => {
      if (ids.includes(n.id)) order.push(n.id)
    })
    const found = order.flatMap((id) => findNode(list, id) ?? [])
    // Elements inside another moving one go with it.
    const moving = found.filter((f) => !found.some((o) => o !== f && findNode(o.node.children ?? [], f.node.id)))
    if (moving.some((f) => f.depth === 0) && !moving.every((f) => f.depth === 0)) return
    let next = moving.reduce((acc, f) => removeNode(acc, f.node.id), list)
    const t = findNode(next, target.id)
    if (!t) return
    const parentId = target.where === 'inside' ? target.id : (t.parent?.id ?? null)
    const at = target.where === 'inside' ? (t.node.children?.length ?? 0) : t.index + (target.where === 'after' ? 1 : 0)
    moving.forEach((f, i) => {
      next = insertNode(next, parentId, at + i, f.node)
    })
    setNodes(next)
  }

  const play = useCallback(() => {
    setPlaying(Date.now())
    setTimeout(() => setPlaying(0), 2600)
  }, [])

  // Shortcuts while the focus is not in a field or a text being edited.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement
      if (
        t.closest?.(
          'input, textarea, select, [contenteditable="true"], [contenteditable="plaintext-only"], [role="dialog"]',
        )
      )
        return
      const mod = e.metaKey || e.ctrlKey
      const id = selected
      if (e.key === 'Escape' && previewing) {
        setPreviewing(false)
        return
      }
      if (previewing) return
      if (e.key === 'Escape') {
        if (editing) return
        setSelected(findNode(nodesRef.current, id)?.parent?.id ?? null)
        return
      }
      if (id && (e.key === 'Backspace' || e.key === 'Delete')) {
        e.preventDefault()
        removeSelection()
      } else if (id && mod && !e.altKey && e.key.toLowerCase() === 'd') {
        e.preventDefault()
        duplicateSelection()
      } else if (id && mod && e.key.toLowerCase() === 'g') {
        e.preventDefault()
        if (e.shiftKey) ungroup()
        else group()
      } else if (id && mod && !e.altKey && e.key.toLowerCase() === 'a') {
        // Everything next to the selected element, in the same container.
        e.preventDefault()
        const f = findNode(nodesRef.current, id)
        if (f) setSelection([...f.siblings.map((n) => n.id).filter((x) => x !== id), id])
      } else if (id && e.altKey && mod && /^Key[WASDHV]$/.test(e.code)) {
        // By physical key: with ⌥ held, macOS types other letters (⌥S is ß).
        e.preventDefault()
        const how = (
          { KeyA: 'left', KeyD: 'right', KeyW: 'top', KeyS: 'bottom', KeyH: 'hcenter', KeyV: 'vcenter' } as const
        )[e.code as 'KeyA']
        if (how) align(how)
      } else if (id && mod && e.key.toLowerCase() === 'c') {
        clipboard.current = findNode(nodesRef.current, id)?.node ?? null
        if (clipboard.current) toast('Copiato')
      } else if (mod && e.key.toLowerCase() === 'v' && clipboard.current) {
        e.preventDefault()
        const copy = cloneNode(clipboard.current)
        if (copy.section || findNode(nodesRef.current, clipboard.current.id)?.depth === 0) {
          const f = findNode(nodesRef.current, id)
          const index = f ? nodesRef.current.indexOf(f.root) + 1 : nodesRef.current.length
          setNodes(insertNode(nodesRef.current, null, index, copy))
          setSelected(copy.id)
        } else insertAfterSelection(copy)
      } else if (id && e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
        e.preventDefault()
        move(id, e.key === 'ArrowUp' ? -1 : 1)
      } else if (id && e.key === 'Tab' && !mod && !e.altKey) {
        // Next or previous element in the same container, as in Figma.
        e.preventDefault()
        const f = findNode(nodesRef.current, id)
        if (f?.siblings.length) {
          const n = f.siblings.length
          const next = f.siblings[(f.index + (e.shiftKey ? n - 1 : 1)) % n]
          if (next) setSelected(next.id)
        }
      } else if (id && e.key === 'Enter') {
        const n = findNode(nodesRef.current, id)?.node
        if (n?.type === 'text' || n?.type === 'button') {
          e.preventDefault()
          setEditing(id)
        } else if (n?.children?.[0]) {
          // Into a container: its first element.
          e.preventDefault()
          setSelected(n.children[0].id)
        }
      } else if (!mod && !e.altKey && e.shiftKey && e.key.toLowerCase() === 'r') {
        e.preventDefault()
        setRulers(!rulers)
      } else if (
        id &&
        !mod &&
        !e.altKey &&
        e.key.length === 1 &&
        /\S/.test(e.key) &&
        selectionRef.current.length === 1 &&
        ['text', 'button'].includes(findNode(nodesRef.current, id)?.node.type ?? '')
      ) {
        // A selected text takes what is typed, instead of the letters adding elements by accident.
        e.preventDefault()
        typeAhead.current += e.key
        setEditing(id)
      } else if (!mod && !e.altKey && mode === 'design') {
        const kind = ({ f: 'frame', t: 'text', i: 'image', b: 'button', v: 'video', c: 'embed', g: 'scene' } as const)[
          e.key.toLowerCase()
        ]
        if (kind) {
          e.preventDefault()
          insertAfterSelection(newElement(kind))
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const commitText = (id: string, value: { runs?: Run[]; text?: string }) => {
    if (value.runs) {
      const { text, runs } = simplify(value.runs)
      setProps(id, { text, runs })
    } else if (value.text !== undefined) setProps(id, { text: value.text })
  }

  /** The fields an element inside a bound list can show, or null outside lists. */
  const boundFieldsFor = (id: string) => {
    let name: string | null = null
    const climb = (list: PageNode[], trail: PageNode[]): boolean => {
      for (const n of list) {
        if (n.id === id) {
          const owner = [...trail].reverse().find((a) => a.bind?.collection)
          name = owner?.bind?.collection ?? null
          return true
        }
        if (n.children && climb(n.children, [...trail, n])) return true
      }
      return false
    }
    climb(nodesRef.current, [])
    const def = schema.collections.find((c) => c.name === name)
    if (!def) return null
    return [
      { value: 'title', label: 'Titolo' },
      { value: 'url', label: 'Indirizzo della pagina' },
      ...def.fields
        .filter((f) => ['text', 'number', 'date', 'select', 'slug', 'media', 'color'].includes(f.kind))
        .filter((f) => f.name !== def.titleField)
        .map((f) => ({ value: f.name, label: f.label ?? f.name })),
    ]
  }

  /** Fields a bound list can sort and filter by. */
  const collectionFields = (name: string) => {
    const def = schema.collections.find((c) => c.name === name)
    if (!def) return []
    return [
      { value: 'title', label: 'Titolo' },
      ...def.fields
        .filter((f) => ['text', 'number', 'date', 'select', 'slug', 'boolean', 'array'].includes(f.kind))
        .filter((f) => f.name !== def.titleField)
        .map((f) => ({ value: f.name, label: f.label ?? f.name })),
    ]
  }

  const otherFields = collection.fields.filter((f) => f.name !== pageField.name)
  const selectedNode = info?.node ?? null

  return (
    <div className="flex min-h-0 flex-1">
      {/* left: layers, library, styles */}
      <aside className="flex w-[264px] shrink-0 flex-col border-r border-line bg-panel">
        <div className="flex h-11 shrink-0 items-center gap-1 border-b border-line px-2">
          {(
            [
              ['layers', 'Livelli', <LayersIcon key="l" />],
              ['add', 'Aggiungi', <Plus key="a" />],
              ['styles', 'Stili', <Palette key="s" />],
            ] as const
          ).map(([value, label, icon]) => (
            <button
              key={value}
              type="button"
              onClick={() => setTab(value)}
              className={cx(
                'flex h-7 flex-1 items-center justify-center gap-1.5 rounded-md text-[12px] font-medium transition-colors [&_svg]:size-3.5',
                tab === value ? 'bg-seg text-fg' : 'text-fg2 hover:text-fg',
              )}
            >
              {icon}
              {label}
            </button>
          ))}
        </div>
        {tab === 'layers' && (
          <Layers
            nodes={nodes}
            selected={selected}
            selection={selection}
            onSelect={(id, add) => (add && id ? toggleSelected(id) : setSelected(id))}
            onRename={(id, name) => setProps(id, { name: name || undefined })}
            onToggleHidden={(id) => {
              const n = findNode(nodesRef.current, id)?.node
              if (n) setProps(id, { hidden: !resolveNode(n, device).hidden })
            }}
            onMove={moveTo}
            hiddenOf={(n) => !!resolveNode(n, device).hidden}
          />
        )}
        {tab === 'add' && (
          <Library
            theme={theme}
            brand={schema.site.name}
            onAddElement={(kind) => insertAfterSelection(newElement(kind))}
            onAddSection={addSection}
            globals={globals}
            components={components}
            onAddComponent={componentActions.insert}
            onRemoveComponent={(cid) => {
              const def = componentsRef.current[cid]
              if (def) storeComponents({ ...componentsRef.current, [cid]: { ...def, archived: true } })
            }}
            onAddGlobal={(gid) => {
              const f = findNode(nodesRef.current, selected)
              const index = f ? nodesRef.current.indexOf(f.root) + 1 : nodesRef.current.length
              const ref: PageNode = { ...(globals[gid] as PageNode), id: newId(), global: gid }
              setNodes(insertNode(nodesRef.current, null, index, ref))
              setSelected(ref.id)
              revealOnCanvas(ref.id)
            }}
          />
        )}
        {tab === 'styles' && <ThemePanel theme={theme} onChange={setTheme} canEdit={user.role === 'admin'} />}
      </aside>

      {/* center: toolbar and canvas */}
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex h-11 shrink-0 items-center gap-2 border-b border-line bg-panel px-3">
          {mode === 'design' && (
            <div className="flex items-center gap-0.5">
              {(
                [
                  ['frame', 'Contenitore · F', <Rows3 key="f" />],
                  ['text', 'Testo · T', <Type key="t" />],
                  ['image', 'Immagine · I', <ImageIcon key="i" />],
                  ['button', 'Pulsante · B', <MousePointerClick key="b" />],
                  ['video', 'Video · V', <Video key="v" />],
                  ['embed', 'Codice · C', <Code key="c" />],
                  ['scene', 'Scena WebGL · G', <Sparkles key="g" />],
                ] as const
              ).map(([kind, label, icon]) => (
                <IconButton
                  key={kind}
                  label={`Aggiungi ${label}`}
                  onClick={() => insertAfterSelection(newElement(kind))}
                >
                  {icon}
                </IconButton>
              ))}
            </div>
          )}
          {mode === 'content' && (
            <span className="text-[12px] text-fg2">Clicca un testo per scriverci, un’immagine per cambiarla.</span>
          )}
          <div className="flex-1" />
          <Segmented
            size="sm"
            value={device}
            onChange={(d) => {
              setDevice(d)
              setZoom('fit')
            }}
            options={[
              { value: 'desktop', label: <Monitor />, title: 'Desktop · 1280 px' },
              { value: 'tablet', label: <Tablet />, title: 'Tablet · 768 px' },
              { value: 'mobile', label: <Smartphone />, title: 'Mobile · 390 px' },
            ]}
          />
          <div className="flex-1" />
          <div className="flex items-center gap-0.5">
            <IconButton
              label="Riduci lo zoom"
              onClick={() => setZoom(Math.max(0.25, Math.round(((zoom === 'fit' ? fitZoom : zoom) - 0.1) * 10) / 10))}
            >
              <Minus />
            </IconButton>
            <button
              type="button"
              title="Adatta alla finestra"
              onClick={() => setZoom('fit')}
              className="h-7 min-w-12 rounded-md px-1.5 font-mono text-[11.5px] text-fg2 hover:bg-hover hover:text-fg"
            >
              {Math.round((zoom === 'fit' ? fitZoom : zoom) * 100)}%
            </button>
            <IconButton
              label="Aumenta lo zoom"
              onClick={() => setZoom(Math.min(1.5, Math.round(((zoom === 'fit' ? fitZoom : zoom) + 0.1) * 10) / 10))}
            >
              <Plus />
            </IconButton>
            <IconButton label="Adatta alla finestra" active={zoom === 'fit'} onClick={() => setZoom('fit')}>
              <Maximize />
            </IconButton>
            <IconButton label="Righelli · ⇧R" active={rulers} onClick={() => setRulers(!rulers)}>
              <Ruler />
            </IconButton>
            <div className="mx-1 h-5 w-px bg-line" />
            <IconButton label="Riproduci le animazioni" onClick={play}>
              <Play />
            </IconButton>
            <button
              type="button"
              onClick={() => setPreviewing(!previewing)}
              title="Prova scroll, mouse e clic come sul sito · Esc per uscire"
              className={cx(
                'ml-1 flex h-7 items-center gap-1.5 rounded-md px-2.5 text-[12px] font-medium transition-colors [&_svg]:size-3.5',
                previewing ? 'bg-accent text-white' : 'text-fg2 hover:bg-hover hover:text-fg',
              )}
            >
              <Eye />
              {previewing ? 'Esci dall’anteprima' : 'Anteprima'}
            </button>
          </div>
        </div>
        {nodes.length === 0 ? (
          <div className="flex min-h-0 flex-1 items-center justify-center bg-canvas bg-[radial-gradient(var(--dot)_1px,transparent_1px)] [background-size:18px_18px] p-8">
            <div className="w-full max-w-md rounded-2xl border border-line bg-panel p-6 text-center shadow-pop">
              <div className="mx-auto flex size-10 items-center justify-center rounded-xl bg-accent/10 text-accent">
                <LayersIcon className="size-5" />
              </div>
              <h2 className="mt-4 text-[17px] font-semibold tracking-[-0.01em]">Da dove vuoi partire?</h2>
              <p className="mt-1 text-[13px] text-fg2">
                Una pagina già composta da modificare, oppure una pagina vuota da riempire con le sezioni della
                libreria.
              </p>
              <div className="mt-5 grid gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setNodes(STARTER.map((k) => buildSection(k, schema.site.name)))
                    setTimeout(play, 60)
                  }}
                  className="h-10 rounded-lg bg-accent text-[13px] font-medium text-white hover:brightness-110"
                >
                  Pagina pronta: menu, apertura, servizi, invito e piè di pagina
                </button>
                <button
                  type="button"
                  onClick={() => setTab('add')}
                  className="h-10 rounded-lg border border-line2 text-[13px] font-medium hover:bg-hover"
                >
                  Pagina vuota: scelgo io le sezioni
                </button>
              </div>
            </div>
          </div>
        ) : (
          <Canvas
            nodes={nodes}
            theme={theme}
            device={device}
            zoom={zoom}
            mode={mode}
            selected={selected}
            selection={selection}
            editing={editing}
            playing={playing}
            preview={previewing}
            data={boundData}
            onSelect={(id, add) => {
              if (add && id) toggleSelected(id)
              else setSelected(id)
              if (editing && id !== editing) setEditing(null)
            }}
            onEdit={setEditing}
            onCommitText={commitText}
            onPickImage={(id) => setPicking({ id, target: 'src' })}
            onFitZoom={setFitZoom}
            onResize={(id, patch) => setProps(id, patch)}
            onMove={moveTo}
            onMoveMany={moveManyTo}
            onPatch={(patches) => setPropsMany(patches)}
            onSelectMany={(ids) => {
              setSelection(ids)
              if (editing) setEditing(null)
            }}
            rulers={rulers}
            typeAhead={typeAhead}
            onDropNew={(item, target, sectionIndex) => {
              if (item.section) {
                if (item.section.startsWith('component:')) {
                  componentActions.insert(item.section.slice(10))
                  return
                }
                const gid = item.section.startsWith('global:') ? item.section.slice(7) : null
                const section: PageNode =
                  gid && globals[gid]
                    ? { ...(globals[gid] as PageNode), id: newId(), global: gid }
                    : buildSection(item.section, schema.site.name)
                setNodes(insertNode(nodesRef.current, null, sectionIndex, section))
                setSelected(section.id)
                setTimeout(play, 60)
              } else if (item.element) {
                const node = newElement(item.element as ElementKind)
                if (target) placeAt(node, target)
                else insertAfterSelection(node)
              }
            }}
          />
        )}
      </div>

      {/* right: element or page */}
      <aside className="w-[288px] shrink-0 overflow-y-auto border-l border-line bg-panel">
        {selectedNode && info ? (
          <Inspector
            key={selectedNode.id}
            node={selectedNode}
            view={withTextStyle(selectedNode, theme)}
            count={selection.length}
            onAlign={align}
            onGroup={group}
            onUngroup={ungroup}
            textStyles={{ list: textStyleList, canEdit: user.role === 'admin', ...textStyleActions }}
            collectionFields={collectionFields}
            depth={info.depth}
            device={device}
            onProps={setSelectionProps}
            onContent={(patch, group) => setProps(selectedNode.id, patch, group)}
            onReset={(keys) => resetProps(selectedNode.id, keys)}
            onPickImage={(target) => setPicking({ id: selectedNode.id, target })}
            onPlay={play}
            onPreview={() => setPreviewing(true)}
            onDuplicate={duplicateSelection}
            onDelete={removeSelection}
            onMove={(dir) => move(selectedNode.id, dir)}
            onSelectParent={info.parent ? () => setSelected(info.parent?.id ?? null) : null}
            palette={palette(theme)}
            parentLayout={info.parent ? (resolveNode(info.parent, device).layout ?? 'col') : null}
            canCode={user.role === 'admin'}
            components={components}
            componentActions={componentActions}
            onMakeGlobal={() => setProps(selectedNode.id, { global: newId() } as Partial<NodeProps>)}
            onUnlinkGlobal={() =>
              setNodes(
                updateNode(nodesRef.current, selectedNode.id, (n) => {
                  const { global: _, ...rest } = n
                  return rest
                }),
              )
            }
            collections={schema.collections.filter((c) => !c.singleton).map((c) => ({ value: c.name, label: c.label }))}
            boundFields={boundFieldsFor(selectedNode.id)}
          />
        ) : (
          <div>
            <div className="border-b border-line px-3.5 py-3">
              <div className="text-[13px] font-semibold">Pagina</div>
              <p className="mt-0.5 text-[11.5px] text-fg3">
                {nodes.length === 1 ? '1 sezione' : `${nodes.length} sezioni`} · seleziona un elemento sulla tela per
                modificarlo.
              </p>
            </div>
            <div className="px-3.5 py-4">
              <FieldsForm fields={otherFields} value={data} onChange={onChange} path={[]} />
            </div>
          </div>
        )}
      </aside>

      <MediaPicker
        open={!!picking}
        onClose={() => setPicking(null)}
        onPick={(asset) => {
          if (!picking) return
          if (picking.target === 'bgImage') setProps(picking.id, { bgImage: { src: asset.url, alt: asset.alt } })
          else if (picking.target === 'poster') setProps(picking.id, { poster: asset.url })
          else if (picking.target === 'sceneImage') {
            const current = findNode(nodesRef.current, picking.id)?.node
            const scene = current?.scene ?? { preset: 'distort' as const }
            if (asset.url.endsWith('.glb'))
              setProps(picking.id, { scene: { ...scene, preset: 'model', model: asset.url } })
            else setProps(picking.id, { scene: { ...scene, image: asset.url } })
          } else {
            const current = findNode(nodesRef.current, picking.id)?.node
            setProps(picking.id, { src: asset.url, alt: current?.alt || asset.alt })
          }
        }}
      />
    </div>
  )
}
