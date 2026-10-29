import { buildSection } from '@materializecms/core/library'
import {
  type Breakpoint,
  cloneNode,
  DEFAULT_THEME,
  findNode,
  insertNode,
  type NodeProps,
  newId,
  type PageNode,
  type Run,
  removeNode,
  resolveNode,
  type Theme,
  updateNode,
} from '@materializecms/core/page'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
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
  Smartphone,
  Tablet,
  Type,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSession } from '../app/context.ts'
import { cx, IconButton, Segmented, toast } from '../components/ui.tsx'
import { FieldsForm } from '../fields/FieldInput.tsx'
import { api, type CollectionDescription, type Data, type FieldDescription } from '../lib/api.ts'
import { usePref } from '../lib/prefs.ts'
import { MediaPicker } from '../media/MediaPicker.tsx'
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
  const { user, schema } = useSession()
  const queryClient = useQueryClient()
  const nodes = useMemo(
    () => (Array.isArray(data[pageField.name]) ? (data[pageField.name] as PageNode[]) : []),
    [data, pageField.name],
  )
  const [selected, setSelected] = useState<string | null>(null)
  const [editing, setEditing] = useState<string | null>(null)
  const [device, setDevice] = useState<Breakpoint>('desktop')
  const [zoom, setZoom] = useState<'fit' | number>('fit')
  const [fitZoom, setFitZoom] = useState(1)
  const [tab, setTab] = usePref<Tab>('mz-page-tab', 'layers')
  const [playing, setPlaying] = useState(0)
  const [picking, setPicking] = useState<{ id: string; target: 'src' | 'bgImage' } | null>(null)
  const clipboard = useRef<PageNode | null>(null)

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

  // The theme's fonts, for the canvas and the library previews.
  useEffect(() => {
    loadFont(theme.display)
    loadFont(theme.body)
  }, [theme.display, theme.body])

  const nodesRef = useRef(nodes)
  nodesRef.current = nodes
  const dataRef = useRef(data)
  dataRef.current = data
  const setNodes = useCallback(
    (next: PageNode[], group?: string) => onChange({ ...dataRef.current, [pageField.name]: next }, group),
    [onChange, pageField.name],
  )

  const info = findNode(nodes, selected)
  // A selection removed by undo or elsewhere.
  useEffect(() => {
    if (selected && !info) setSelected(null)
  }, [selected, info])

  /** Design changes: on tablet and mobile they go into that device's overrides. */
  const setProps = useCallback(
    (id: string, patch: Partial<NodeProps>, group?: string) => {
      setNodes(
        updateNode(nodesRef.current, id, (n) => {
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
        group,
      )
    },
    [device, setNodes],
  )

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
    setTimeout(play, 60)
  }

  const duplicate = (id: string) => {
    const f = findNode(nodesRef.current, id)
    if (!f) return
    const copy = cloneNode(f.node)
    setNodes(insertNode(nodesRef.current, f.parent?.id ?? null, f.index + 1, copy))
    setSelected(copy.id)
  }

  const move = (id: string, dir: -1 | 1) => {
    const f = findNode(nodesRef.current, id)
    if (!f) return
    const to = f.index + dir
    if (to < 0 || to >= f.siblings.length) return
    const without = removeNode(nodesRef.current, id)
    setNodes(insertNode(without, f.parent?.id ?? null, to, f.node))
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

  const play = useCallback(() => {
    setPlaying(Date.now())
    setTimeout(() => setPlaying(0), 2600)
  }, [])

  // Shortcuts while the focus is not in a field or a text being edited.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement
      if (
        t.closest(
          'input, textarea, select, [contenteditable="true"], [contenteditable="plaintext-only"], [role="dialog"]',
        )
      )
        return
      const mod = e.metaKey || e.ctrlKey
      const id = selected
      if (e.key === 'Escape') {
        if (editing) return
        setSelected(findNode(nodesRef.current, id)?.parent?.id ?? null)
        return
      }
      if (id && (e.key === 'Backspace' || e.key === 'Delete')) {
        e.preventDefault()
        remove(id)
      } else if (id && mod && e.key.toLowerCase() === 'd') {
        e.preventDefault()
        duplicate(id)
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
      } else if (id && e.key === 'Enter') {
        const n = findNode(nodesRef.current, id)?.node
        if (n?.type === 'text' || n?.type === 'button') {
          e.preventDefault()
          setEditing(id)
        }
      } else if (!mod && !e.altKey && mode === 'design') {
        const kind = ({ f: 'frame', t: 'text', i: 'image', b: 'button' } as const)[e.key.toLowerCase()]
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
            onSelect={setSelected}
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
            <div className="mx-1 h-5 w-px bg-line" />
            <IconButton label="Riproduci le animazioni" onClick={play}>
              <Play />
            </IconButton>
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
            editing={editing}
            playing={playing}
            onSelect={(id) => {
              setSelected(id)
              if (editing && id !== editing) setEditing(null)
            }}
            onEdit={setEditing}
            onCommitText={commitText}
            onPickImage={(id) => setPicking({ id, target: 'src' })}
            onFitZoom={setFitZoom}
            onResize={(id, patch) => setProps(id, patch)}
            onMove={moveTo}
            onDropNew={(item, target, sectionIndex) => {
              if (item.section) {
                const section = buildSection(item.section, schema.site.name)
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
            depth={info.depth}
            device={device}
            onProps={(patch, group) => setProps(selectedNode.id, patch, group)}
            onContent={(patch, group) => setProps(selectedNode.id, patch, group)}
            onReset={(keys) => resetProps(selectedNode.id, keys)}
            onPickImage={(target) => setPicking({ id: selectedNode.id, target })}
            onPlay={play}
            onDuplicate={() => duplicate(selectedNode.id)}
            onDelete={() => remove(selectedNode.id)}
            onMove={(dir) => move(selectedNode.id, dir)}
            onSelectParent={info.parent ? () => setSelected(info.parent?.id ?? null) : null}
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
          else {
            const current = findNode(nodesRef.current, picking.id)?.node
            setProps(picking.id, { src: asset.url, alt: current?.alt || asset.alt })
          }
        }}
      />
    </div>
  )
}
