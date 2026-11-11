import type { PageNode } from '@materializecms/core/page'
import type { MediaInfo, QualityCheck } from '@materializecms/core/quality'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft,
  Check,
  CircleAlert,
  Copy,
  CopyPlus,
  ExternalLink,
  EyeOff,
  FileText,
  History as HistoryIcon,
  LayoutTemplate,
  Link2,
  Monitor,
  Moon,
  MoreHorizontal,
  PanelRight,
  Redo2,
  Rocket,
  Save,
  Sparkles,
  Sun,
  Trash2,
  Undo2,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { useAiReady } from '../components/AiMenu.tsx'
import {
  Button,
  cx,
  Dialog,
  EmptyState,
  IconButton,
  MenuItem,
  MenuSeparator,
  Popover,
  Segmented,
  Spinner,
  StatusBadge,
  ThemeSwitch,
  toast,
} from '../components/ui.tsx'
import { DesignMode } from '../design/DesignMode.tsx'
import { FieldsForm } from '../fields/FieldInput.tsx'
import { FormContext } from '../fields/form-context.ts'
import {
  ApiError,
  api,
  type CollectionDescription,
  type Data,
  type Revision,
  type StoredDocument,
  type ValidationIssue,
} from '../lib/api.ts'
import { clean, emptyValue } from '../lib/doc.ts'
import { fullDate, relativeTime } from '../lib/format.ts'
import { useHistory } from '../lib/history.ts'
import { t, tn } from '../lib/i18n.ts'
import { usePref, useTheme } from '../lib/prefs.ts'
import { navigate, setNavigationGuard } from '../lib/router.ts'
import { PageEditor } from '../page/PageEditor.tsx'
import { qualityOf } from '../page/quality.ts'
import { Review } from '../page/Review.tsx'
import { Logo } from './Auth.tsx'
import { useSession } from './context.ts'
import { LanguageMenu } from './LanguageMenu.tsx'
import { ReleaseChip, ReleaseDialog } from './ReleaseDialog.tsx'
import { ScheduleMenu } from './ScheduleMenu.tsx'
import { ShareDialog } from './ShareDialog.tsx'
import { localeName } from './Sidebar.tsx'
import { TurnGate, useTurn } from './TurnGate.tsx'

/**
 * Documents created by the editor still open: their screen keeps the key it had while new, so the
 * first save changes the address without remounting the editor (selection and undo survive).
 */
export const openedAsNew = new Set<string>()

/** Whether a media query matches, kept in step with the window. */
function useMedia(query: string): boolean {
  return useSyncExternalStore(
    (fn) => {
      const m = matchMedia(query)
      m.addEventListener('change', fn)
      return () => m.removeEventListener('change', fn)
    },
    () => matchMedia(query).matches,
  )
}

/** The work surface below the top bar: a rounded card on the shell, like the rest of the panel. */
const SURFACE = 'mx-2.5 mb-2.5 overflow-hidden rounded-[22px] bg-panel'

export function DocumentScreen({
  collection,
  id,
  embedded,
}: {
  collection: CollectionDescription
  id: string | null
  /** Inside another screen (a single document in Impostazioni): no title of its own in the header. */
  embedded?: boolean
}) {
  const doc = useQuery({
    queryKey: ['doc', id],
    queryFn: () => api.get(id as string),
    enabled: !!id,
    staleTime: Infinity,
  })
  // One person (and one tab) edits at a time; the others see who, and may take over.
  const { turn, take } = useTurn(id)
  const [generation, setGeneration] = useState(0)
  const locked = !!turn && !turn.mine
  // A document opens in its own language: lists, menus and footers on the canvas follow it.
  const { locale, setLocale, schema } = useSession()
  const docLocale = doc.data?.locale
  useEffect(() => {
    if (docLocale && docLocale !== locale && schema.locales.available.includes(docLocale)) setLocale(docLocale)
  }, [docLocale, locale, setLocale, schema.locales.available])
  if (id && doc.isPending) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Spinner />
      </div>
    )
  }
  if (id && doc.error) {
    return (
      <EmptyState icon={<FileText />} title={t('Documento non trovato')}>
        <button
          type="button"
          className="text-accent hover:underline"
          onClick={() => navigate({ name: 'collection', collection: collection.name })}
        >
          {t('Torna a {name}', { name: collection.label })}
        </button>
      </EmptyState>
    )
  }
  return (
    <div className="relative flex min-h-0 min-w-0 flex-1 flex-col">
      {/* Behind the notice, nothing can be clicked or typed into. */}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col" inert={locked}>
        <Editor
          key={generation}
          collection={collection}
          initial={doc.data ?? null}
          embedded={embedded}
          locked={locked}
        />
      </div>
      {locked && turn && (
        <TurnGate
          turn={turn}
          previewUrl={doc.data?.status !== 'draft' ? (doc.data?.url ?? null) : null}
          onBack={() =>
            embedded ? navigate({ name: 'home' }) : navigate({ name: 'collection', collection: collection.name })
          }
          onTake={async () => {
            await take()
            // What the other person saved, before editing on top of it.
            await doc.refetch()
            setGeneration((g) => g + 1)
          }}
        />
      )}
    </div>
  )
}

function initialData(collection: CollectionDescription): Data {
  const data: Data = {}
  for (const f of collection.fields) {
    const v = emptyValue(f)
    if (v !== undefined) data[f.name] = v
  }
  return data
}

type Mode = 'content' | 'design'

function Editor({
  collection,
  initial,
  embedded,
  locked,
}: {
  collection: CollectionDescription
  initial: StoredDocument | null
  embedded?: boolean
  /** Someone else holds the turn: nothing is saved from here. */
  locked?: boolean
}) {
  const lockedRef = useRef(locked)
  lockedRef.current = locked
  const { locale, user, schema } = useSession()
  const queryClient = useQueryClient()
  const fields = collection.fields
  const history = useHistory<Data>(initial?.data ?? initialData(collection))
  const [doc, setDoc] = useState(initial)
  const docId = useRef<string | null>(null)
  docId.current = doc?.id ?? null
  // Leaving the editor: next time this document opens with its own key.
  useEffect(
    () => () => {
      if (docId.current) openedAsNew.delete(docId.current)
    },
    [],
  )
  // Compared with the current data to detect changes; a new document starts from its empty defaults.
  const [saved, setSaved] = useState(() => JSON.stringify(clean(fields, initial?.data ?? initialData(collection))))
  const [saving, setSaving] = useState(false)
  const [issues, setIssues] = useState<ValidationIssue[]>(initial?.issues ?? [])
  // Problems are listed quietly while editing and highlighted once someone tries to publish.
  const [showErrors, setShowErrors] = useState(false)
  const [focusRequest, setFocusRequest] = useState<{ path: string; n: number } | null>(null)
  const [publishing, setPublishing] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [sharing, setSharing] = useState(false)
  const [releasing, setReleasing] = useState(false)
  const [reviewing, setReviewing] = useState(false)
  const aiReady = useAiReady()
  const [confirmUnpublish, setConfirmUnpublish] = useState(false)
  /** Serious accessibility or performance problems found when publishing a canvas page. */
  const [problems, setProblems] = useState<QualityCheck[] | null>(null)
  const [panel, setPanel] = usePref<'on' | 'off'>('mz-doc-panel', 'on')
  const blocksField = fields.find((f) => f.kind === 'blocks')
  const pageField = fields.find((f) => f.kind === 'page')
  const [modePref, setMode] = usePref<Mode>('mz-mode', 'design')
  // Editors may be limited to contents (Persone): the page opens in content mode, without the switch.
  const contentOnly =
    useQuery({ queryKey: ['editorial'], queryFn: api.editorial, staleTime: 60_000 }).data?.editorial
      .editorsContentOnly === true && user.role !== 'admin'
  // A new page is empty: there is nothing to write yet, so it opens in design.
  const [fresh, setFresh] = useState(!initial && !!pageField)
  // Phones and small tablets: the canvas does not fit, so a page opens in Contenuto (the saved choice stays).
  const narrow = useMedia('(max-width: 767.98px)')
  const phone = useMedia('(max-width: 639.98px)')
  const canvasTooSmall = !!pageField && narrow
  const mode: Mode =
    (blocksField || pageField) && !contentOnly && !canvasTooSmall ? (fresh ? 'design' : modePref) : 'content'
  const [theme, setTheme] = useTheme()
  const [historyDialog, setHistoryDialog] = useState(false)
  const chooseMode = (m: Mode) => {
    setFresh(false)
    setMode(m)
  }

  const cleaned = useMemo(() => clean(fields, history.value), [fields, history.value])
  const current = JSON.stringify(cleaned)
  const dirty = current !== saved
  const latest = useRef({ value: history.value, current, cleaned, doc, saving })
  latest.current = { value: history.value, current, cleaned, doc, saving }

  const titleDef = fields.find((f) => f.name === collection.titleField && f.kind === 'text')
  const titleValue = history.value[collection.titleField]
  const title = typeof titleValue === 'string' && titleValue.trim() ? titleValue : t('Senza titolo')

  const applyServer = useCallback(
    (res: StoredDocument, sent: string) => {
      setDoc(res)
      setSaved(sent)
      setIssues(res.issues ?? [])
      if (!res.issues?.length) setShowErrors(false)
      queryClient.setQueryData(['doc', res.id], res)
      queryClient.invalidateQueries({ queryKey: ['list', collection.name] })
      queryClient.invalidateQueries({ queryKey: ['revisions', res.id] })
      // The server fills an empty slug from the title: keep it, so the address stays stable from now on.
      const slugField = collection.slugField
      if (slugField && !latest.current.value[slugField] && res.data[slugField]) {
        const next = { ...latest.current.value, [slugField]: res.data[slugField] }
        history.replace(next)
        setSaved(JSON.stringify(clean(fields, next)))
      }
    },
    [collection, fields, history, queryClient],
  )

  const handleError = useCallback(
    (error: unknown) => {
      if (error instanceof ApiError && error.code === 'slug_taken' && collection.slugField) {
        setIssues([{ path: collection.slugField, message: error.message }])
        setShowErrors(true)
      } else if (error instanceof ApiError && error.issues.length) {
        setIssues(error.issues)
        setShowErrors(true)
      } else {
        toast((error as Error).message, 'error')
      }
    },
    [collection.slugField],
  )

  /** Saves the draft, complete or not. Returns the saved document, or null if the save failed. */
  const save = useCallback(async (): Promise<StoredDocument | null> => {
    const { cleaned: data, current: sent, doc: existing } = latest.current
    if (latest.current.saving || lockedRef.current) return null
    setSaving(true)
    try {
      if (!existing) {
        const created = await api.create(collection.name, data, locale)
        applyServer(created, sent)
        // Already known: the address changes but the editor stays as it is (selection, undo).
        queryClient.setQueryData(['doc', created.id], created)
        openedAsNew.add(created.id)
        setNavigationGuard(null)
        // A single document (site settings) is edited inside Impostazioni: no address of its own.
        if (!collection.singleton)
          navigate({ name: 'document', collection: collection.name, id: created.id }, { replace: true })
        else void queryClient.invalidateQueries({ queryKey: ['list', collection.name] })
        return created
      }
      const res = await api.save(existing.id, data)
      applyServer(res, sent)
      return res
    } catch (error) {
      handleError(error)
      return null
    } finally {
      setSaving(false)
    }
  }, [collection.name, collection.singleton, locale, applyServer, handleError, queryClient])

  // Autosave drafts of existing documents shortly after the last change.
  useEffect(() => {
    if (!doc || !dirty || saving) return
    const timer = setTimeout(save, 900)
    return () => clearTimeout(timer)
  }, [doc, dirty, saving, save])

  /**
   * Publishes; a canvas page with serious accessibility or performance problems asks first, once
   * (`anyway` skips the question). Warnings never stop it.
   */
  const publish = async (anyway?: boolean) => {
    if (pageField && anyway !== true) {
      const nodes = history.value[pageField.name]
      if (Array.isArray(nodes)) {
        const media = queryClient.getQueryData<{ items: { url: string; size: number; mime: string }[] }>(['media-info'])
        const info: Record<string, MediaInfo> = Object.fromEntries(
          (media?.items ?? []).map((m) => [m.url, { size: m.size, mime: m.mime }]),
        )
        const { accessibility, performance } = qualityOf(nodes as PageNode[], { media: info })
        const serious = [...accessibility, ...performance].filter((c) => c.level === 'error')
        if (serious.length) {
          setProblems(serious)
          return
        }
      }
    }
    setProblems(null)
    setPublishing(true)
    try {
      let target = doc
      if (!target || dirty) target = await save()
      if (!target) return
      if (target.issues?.length) {
        showIssues(target.issues[0]?.path)
        return
      }
      const res = await api.publish(target.id)
      applyServer(res, latest.current.current)
      queryClient.invalidateQueries({ queryKey: ['overview'] })
      // The site's name in the sidebar comes from the settings singleton.
      if (collection.singleton) queryClient.invalidateQueries({ queryKey: ['schema'] })
      toast(doc?.publishedAt ? t('Modifiche pubblicate') : t('Pubblicato'))
    } catch (error) {
      handleError(error)
    } finally {
      setPublishing(false)
    }
  }

  /** The draft saved and complete, as a schedule needs it; null after pointing at what to fix. */
  const ensureSaved = async () => {
    let target = doc
    if (!target || dirty) target = await save()
    if (!target) return null
    if (target.issues?.length) {
      showIssues(target.issues[0]?.path)
      return null
    }
    return target
  }

  const unpublish = async () => {
    if (!doc) return
    try {
      applyServer(await api.unpublish(doc.id), latest.current.current)
      queryClient.invalidateQueries({ queryKey: ['overview'] })
      toast(t('Tolto dal sito: ora è una bozza'))
    } catch (error) {
      handleError(error)
    }
  }

  /** A new draft with the same contents: the title says it is a copy, the address follows the title. */
  const duplicate = async () => {
    if (!doc) return
    try {
      const data: Data = { ...latest.current.value }
      if (titleDef) data[titleDef.name] = `${title} (copia)`
      if (collection.slugField) data[collection.slugField] = ''
      const created = await api.create(collection.name, data, doc.locale)
      queryClient.invalidateQueries({ queryKey: ['list', collection.name] })
      toast(t('Copia creata come bozza'))
      navigate({ name: 'document', collection: collection.name, id: created.id })
    } catch (error) {
      handleError(error)
    }
  }

  const remove = async () => {
    if (!doc) return
    try {
      await api.remove(doc.id)
      setNavigationGuard(null)
      queryClient.invalidateQueries({ queryKey: ['list', collection.name] })
      toast(t('Eliminato'))
      navigate({ name: 'collection', collection: collection.name })
    } catch (error) {
      handleError(error)
    }
  }

  // Cronologia for pages on the canvas: the list beside the editor, and the version being looked at.
  const [historyOpen, setHistoryOpen] = useState(false)
  const [previewing, setPreviewing] = useState<{ revision: Revision; label: string } | null>(null)

  const restore = async (revision: string) => {
    if (!doc) return
    try {
      const res = await api.restore(doc.id, revision)
      history.set(res.data)
      applyServer(res, JSON.stringify(clean(fields, res.data)))
      setPreviewing(null)
      toast(t('Versione ripristinata nella bozza: ⌘Z la annulla'))
    } catch (error) {
      handleError(error)
    }
  }

  // Leaving with unsaved work: save valid drafts on the way out, ask otherwise.
  useEffect(() => {
    setNavigationGuard(() => {
      const { doc: d, current: c } = latest.current
      if (c === saved) return true
      if (d) {
        void save()
        return true
      }
      return confirm(t('Ci sono modifiche non salvate. Uscire comunque?'))
    })
    const onUnload = (e: BeforeUnloadEvent) => {
      if (latest.current.current !== saved || latest.current.saving) e.preventDefault()
    }
    window.addEventListener('beforeunload', onUnload)
    return () => {
      setNavigationGuard(null)
      window.removeEventListener('beforeunload', onUnload)
    }
  }, [saved, save])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey)) return
      const key = e.key.toLowerCase()
      if (key === 's') {
        e.preventDefault()
        void save()
      } else if (key === 'z' || key === 'y') {
        // The rich text editor keeps its own undo history.
        if ((e.target as HTMLElement).closest?.('.ProseMirror')) return
        e.preventDefault()
        if (key === 'y' || e.shiftKey) history.redo()
        else history.undo()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [save, history])

  const set = useCallback((next: Data, group?: string) => history.set(next, group), [history])

  const visibleIssues = useMemo(() => (showErrors ? issues : []), [showErrors, issues])
  const formState = useMemo(
    () => ({
      issues: visibleIssues,
      docTitle: title,
      docUrl: doc?.url ?? null,
      siteUrl: schema.site.url,
      // Documents in another language than the site's main one live under it: /en/articoli/…
      urlPrefix:
        collection.urlPrefix && (doc?.locale ?? locale) !== schema.locales.default
          ? `/${doc?.locale ?? locale}${collection.urlPrefix}`
          : collection.urlPrefix,
      docText: () => wordsOf(latest.current.value).join('\n').slice(0, 20_000),
    }),
    [
      visibleIssues,
      title,
      doc?.url,
      doc?.locale,
      locale,
      schema.site.url,
      schema.locales.default,
      collection.urlPrefix,
    ],
  )

  const status = doc?.status ?? 'draft'
  const upToDate = !!doc && status === 'published' && !dirty

  /** Highlights problems and brings the first one into view: the field in Contenuto, the block in Design. */
  function showIssues(path = issues[0]?.path) {
    setShowErrors(true)
    if (path === undefined) return
    if (mode === 'design') {
      setFocusRequest((f) => ({ path, n: (f?.n ?? 0) + 1 }))
      return
    }
    requestAnimationFrame(() => {
      let el: Element | null = null
      for (let p = path; p && !el; p = p.split('.').slice(0, -1).join('.'))
        el = document.querySelector(`[data-path="${p}"]`)
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    })
  }

  return (
    <FormContext.Provider value={formState}>
      <div className="flex min-h-0 flex-1 flex-col">
        <header
          className={cx(
            'relative flex h-[52px] shrink-0 items-center gap-1 px-2 sm:gap-2 sm:px-3',
            collection.singleton ? 'border-b border-line bg-panel' : 'bg-shell',
          )}
        >
          {/* A singleton has no list to go back to: inside Impostazioni its sections stay in view. */}
          {!collection.singleton ? (
            <button
              type="button"
              title={t('Torna a {name}', { name: collection.label })}
              aria-label={t('Torna a {name}', { name: collection.label })}
              onClick={() => navigate({ name: 'collection', collection: collection.name })}
              className="group relative flex size-8 shrink-0 items-center justify-center rounded-full hover:bg-hover"
            >
              {/* On a phone there is no hover: the arrow shows from the start. */}
              <Logo className="size-6 transition-opacity group-hover:opacity-0 max-sm:hidden" />
              <ArrowLeft className="absolute size-4 opacity-0 transition-opacity group-hover:opacity-100 max-sm:opacity-100" />
            </button>
          ) : (
            !embedded && (
              <IconButton
                label={t('Torna alle impostazioni')}
                className="size-8 sm:hidden"
                onClick={() => navigate({ name: 'settings' })}
              >
                <ArrowLeft />
              </IconButton>
            )
          )}
          {/* On a phone the buttons would squeeze the title to nothing: it keeps room for a few words. */}
          <div
            className={cx(
              'flex min-w-[4.5rem] shrink items-center gap-1.5 text-[14px] sm:min-w-[6rem]',
              embedded && 'hidden',
            )}
          >
            {!collection.singleton && (
              <>
                <span className="hidden shrink-0 font-semibold xl:inline">{schema.site.name}</span>
                <span className="hidden text-fg3 xl:inline">/</span>
                <button
                  type="button"
                  className="shrink-0 text-fg2 hover:text-fg max-sm:hidden"
                  onClick={() => navigate({ name: 'collection', collection: collection.name })}
                >
                  {collection.label}
                </button>
                <span className="text-fg3 max-sm:hidden">/</span>
              </>
            )}
            <span className="truncate font-medium">{collection.singleton ? collection.label : title}</span>
          </div>
          {doc && (
            <LanguageMenu
              doc={doc}
              collection={collection.name}
              onSynced={(res) => {
                history.set(res.data)
                applyServer(res, JSON.stringify(clean(fields, res.data)))
              }}
            />
          )}
          {doc && (
            <span className="max-sm:hidden">
              <StatusBadge status={dirty && status === 'published' ? 'changed' : status} short />
            </span>
          )}
          <SaveState
            saving={saving}
            dirty={dirty}
            isNew={!doc}
            issues={issues.length}
            strong={showErrors}
            onIssues={() => showIssues()}
          />

          {(blocksField || pageField) && !contentOnly && !canvasTooSmall && (
            <div
              data-tour="mode"
              className="lg:absolute lg:left-1/2 lg:-translate-x-1/2 max-lg:ml-auto max-lg:shrink-0"
            >
              <Segmented
                value={mode}
                onChange={chooseMode}
                options={[
                  {
                    value: 'content',
                    label: (
                      <>
                        <FileText /> <span className="max-sm:hidden">{t('Contenuto')}</span>
                      </>
                    ),
                    title: pageField ? t('Scrivi testi e cambia immagini sulla pagina') : t('Modifica i campi'),
                  },
                  {
                    value: 'design',
                    label: (
                      <>
                        <LayoutTemplate /> <span className="max-sm:hidden">Design</span>
                      </>
                    ),
                    title: t('Componi la pagina sulla tela'),
                  },
                ]}
              />
            </div>
          )}

          <div className="ml-auto flex shrink-0 items-center gap-1">
            {/* Undo, redo and the theme: in the bar on larger screens, in the menu on a phone. A
                single document (Impostazioni) keeps undo and redo in the menu and the theme in the panel. */}
            {!collection.singleton && (
              <div className="mz-pill max-sm:hidden">
                <IconButton label={t('Annulla (⌘Z)')} disabled={!history.canUndo} onClick={history.undo}>
                  <Undo2 />
                </IconButton>
                <IconButton label={t('Ripristina (⇧⌘Z)')} disabled={!history.canRedo} onClick={history.redo}>
                  <Redo2 />
                </IconButton>
                <ThemeSwitch compact />
              </div>
            )}
            {pageField && doc && (
              <IconButton
                label={t('Cronologia')}
                data-tour="history"
                active={historyOpen}
                className="max-md:hidden"
                onClick={() => {
                  setHistoryOpen(!historyOpen)
                  setPreviewing(null)
                }}
              >
                <HistoryIcon />
              </IconButton>
            )}
            {/* The panel beside the form: larger screens only, and not for a single document. */}
            {mode === 'content' && !pageField && !collection.singleton && (
              <IconButton
                label={t('Pannello documento')}
                active={panel === 'on'}
                className="max-md:hidden"
                onClick={() => setPanel(panel === 'on' ? 'off' : 'on')}
              >
                <PanelRight />
              </IconButton>
            )}
            <Popover
              align="end"
              width={268}
              trigger={({ toggle, ref }) => (
                <IconButton ref={ref} label={t('Altre azioni')} onClick={toggle}>
                  <MoreHorizontal />
                </IconButton>
              )}
            >
              {(close) => (
                <div className="p-1">
                  {(narrow || collection.singleton) && (
                    <>
                      {!doc && phone && (
                        <MenuItem
                          icon={<Save />}
                          disabled={saving}
                          onClick={() => {
                            close()
                            void save()
                          }}
                        >
                          {t('Salva bozza')}
                        </MenuItem>
                      )}
                      {(phone || collection.singleton) && (
                        <>
                          <MenuItem icon={<Undo2 />} disabled={!history.canUndo} onClick={history.undo}>
                            {t('Annulla')}
                          </MenuItem>
                          <MenuItem icon={<Redo2 />} disabled={!history.canRedo} onClick={history.redo}>
                            {t('Ripristina')}
                          </MenuItem>
                        </>
                      )}
                      {phone && !collection.singleton && (
                        <MenuItem
                          icon={theme === 'dark' ? <Moon /> : theme === 'light' ? <Sun /> : <Monitor />}
                          onClick={() => setTheme(theme === 'light' ? 'dark' : theme === 'dark' ? 'system' : 'light')}
                        >
                          <span className="block">{t('Tema')}</span>
                          <span className="block text-[12px] font-normal text-fg3">
                            {theme === 'light'
                              ? t('Tema chiaro')
                              : theme === 'dark'
                                ? t('Tema scuro')
                                : t('Tema come il sistema')}
                          </span>
                        </MenuItem>
                      )}
                      {/* The info panel's history, where the panel is not shown. */}
                      {doc && (collection.singleton || narrow) && (
                        <MenuItem
                          icon={<HistoryIcon />}
                          onClick={() => {
                            close()
                            setHistoryDialog(true)
                          }}
                        >
                          {t('Cronologia')}
                        </MenuItem>
                      )}
                      <MenuSeparator />
                    </>
                  )}
                  <MenuItem
                    icon={<EyeOff />}
                    disabled={!doc?.publishedAt}
                    onClick={() => {
                      close()
                      setConfirmUnpublish(true)
                    }}
                  >
                    <span className="block">{t('Togli dal sito')}</span>
                    <span className="block text-[12px] font-normal text-fg3">
                      {doc?.publishedAt ? t('Torna bozza, non più visibile online') : t('Non è pubblicato')}
                    </span>
                  </MenuItem>
                  {aiReady && !pageField && (
                    <MenuItem
                      icon={<Sparkles />}
                      disabled={!doc}
                      onClick={() => {
                        close()
                        setReviewing(true)
                      }}
                    >
                      <span className="block">{t('Revisione AI')}</span>
                      <span className="block text-[12px] font-normal text-fg3">
                        {t('Refusi, voce, incoerenze, link')}
                      </span>
                    </MenuItem>
                  )}
                  {!collection.singleton && (
                    <MenuItem
                      icon={<Rocket />}
                      onClick={() => {
                        close()
                        setReleasing(true)
                      }}
                    >
                      <span className="block">{doc?.release ? t('Rilascio') : t('Aggiungi a un rilascio')}</span>
                      <span className="block text-[12px] font-normal text-fg3">
                        {doc?.release
                          ? t('In «{name}»', { name: doc.release.name })
                          : t('Esce insieme ad altre pagine')}
                      </span>
                    </MenuItem>
                  )}
                  {schema.preview && (
                    <MenuItem
                      icon={<Link2 />}
                      disabled={!doc?.url}
                      onClick={() => {
                        close()
                        setSharing(true)
                      }}
                    >
                      <span className="block">{t('Condividi anteprima')}</span>
                      <span className="block text-[12px] font-normal text-fg3">
                        {doc?.url ? t('Un link per chi non ha un account') : t('Non ha una pagina sul sito')}
                      </span>
                    </MenuItem>
                  )}
                  <MenuItem
                    icon={<Copy />}
                    disabled={!doc}
                    onClick={() => {
                      close()
                      if (doc) void navigator.clipboard?.writeText(doc.id).then(() => toast(t('ID copiato')))
                    }}
                  >
                    {t('Copia ID')}
                  </MenuItem>
                  {!collection.singleton && (
                    <MenuItem
                      icon={<CopyPlus />}
                      disabled={!doc}
                      onClick={() => {
                        close()
                        void duplicate()
                      }}
                    >
                      {t('Duplica')}
                    </MenuItem>
                  )}
                  {user.role === 'admin' && (
                    <>
                      <MenuSeparator />
                      <MenuItem
                        icon={<Trash2 />}
                        danger
                        disabled={!doc}
                        onClick={() => {
                          close()
                          setConfirmDelete(true)
                        }}
                      >
                        {t('Elimina')}
                      </MenuItem>
                    </>
                  )}
                </div>
              )}
            </Popover>
            {doc?.url && (
              <IconButton
                label={doc.publishedAt ? t('Apri nel browser') : t('Pubblica la pagina per aprirla nel browser')}
                disabled={!doc.publishedAt}
                className="size-8"
                onClick={() => {
                  // On this computer the site is served next to the panel; online, at its own address.
                  const local = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname)
                  const base = local ? location.origin : schema.site.url || location.origin
                  const url = new URL(doc.url as string, base).toString()
                  window.open(url, '_blank', 'noopener')
                }}
              >
                <ExternalLink />
              </IconButton>
            )}
            {doc?.release && <ReleaseChip release={doc.release} onClick={() => setReleasing(true)} />}
            {!collection.singleton && (
              <ScheduleMenu
                doc={doc}
                ensureSaved={ensureSaved}
                onChange={(res) => {
                  applyServer(res, latest.current.current)
                  queryClient.invalidateQueries({ queryKey: ['list', collection.name] })
                }}
                onError={handleError}
              />
            )}
            {!doc ? (
              <>
                {/* On a phone "Salva bozza" is in the menu: Pubblica keeps its room. */}
                <Button onClick={() => void save()} loading={saving} className="ml-1 max-sm:hidden">
                  {t('Salva bozza')}
                </Button>
                <Button variant="primary" onClick={() => void publish()} loading={publishing}>
                  {t('Pubblica')}
                </Button>
              </>
            ) : upToDate ? (
              // Nothing to publish: a calm state, readable in both themes, not a faded button.
              <span
                role="status"
                data-tour="publish"
                title={t('Il sito mostra già questa versione')}
                className="ml-1 inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border border-line2 px-3 text-[14px] font-medium text-fg2 select-none"
              >
                <Check className="size-4 text-ok" />
                {t('Pubblicato')}
              </span>
            ) : (
              <Button
                variant="primary"
                data-tour="publish"
                className="ml-1 sm:min-w-24"
                onClick={() => void publish()}
                loading={publishing}
                aria-label={status === 'draft' ? t('Pubblica') : t('Pubblica modifiche')}
              >
                {status === 'draft' ? (
                  t('Pubblica')
                ) : (
                  <>
                    <span className="max-sm:hidden">{t('Pubblica modifiche')}</span>
                    <span className="sm:hidden">{t('Pubblica')}</span>
                  </>
                )}
              </Button>
            )}
          </div>
        </header>

        {pageField ? (
          <div className="flex min-h-0 flex-1 gap-2 px-2.5 pb-2.5">
            <PageEditor
              collection={collection}
              pageField={pageField}
              data={history.value}
              onChange={set}
              mode={mode}
              docId={doc?.id}
              onContentMode={() => chooseMode('content')}
              preview={
                previewing
                  ? {
                      label: previewing.label,
                      data: previewing.revision.data,
                      onRestore: () => void restore(previewing.revision.id),
                      onClose: () => setPreviewing(null),
                    }
                  : undefined
              }
            />
            {historyOpen && doc && (
              <aside className="w-[280px] shrink-0 overflow-y-auto rounded-[22px] bg-panel px-4 py-3.5">
                <div className="mb-1 flex items-center justify-between">
                  <h2 className="flex items-center gap-1.5 text-[13px] font-medium text-fg3">
                    <HistoryIcon className="size-3.5" /> {t('Cronologia')}
                  </h2>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setHistoryOpen(false)
                      setPreviewing(null)
                    }}
                  >
                    {t('Chiudi')}
                  </Button>
                </div>
                <p className="mb-3 text-[13px] leading-relaxed text-fg3">
                  {t('Clicca una versione per vederla su tutti i dispositivi, prima di ripristinarla.')}
                </p>
                <RevisionList
                  docId={doc.id}
                  onRestore={restore}
                  selected={previewing?.revision.id}
                  onPick={(revision, label) => setPreviewing({ revision, label })}
                />
              </aside>
            )}
          </div>
        ) : mode === 'design' && blocksField ? (
          <div className={cx('flex min-h-0 flex-1', !collection.singleton && SURFACE)}>
            <DesignMode
              collection={collection}
              blocksField={blocksField}
              data={history.value}
              onChange={set}
              issues={visibleIssues}
              focusRequest={focusRequest}
            />
          </div>
        ) : (
          <div className={cx('flex min-h-0 flex-1', !collection.singleton && SURFACE)}>
            <div className="min-w-0 flex-1 overflow-y-auto">
              <div className="mx-auto max-w-[720px] px-4 pt-6 pb-32 sm:px-8 sm:pt-10">
                {titleDef && (
                  <TitleInput
                    value={typeof titleValue === 'string' ? titleValue : ''}
                    placeholder={titleDef.label}
                    error={visibleIssues.find((i) => i.path === titleDef.name)?.message}
                    onChange={(v) => set({ ...history.value, [titleDef.name]: v }, 'title')}
                  />
                )}
                <FieldsForm
                  fields={fields}
                  value={history.value}
                  onChange={set}
                  path={[]}
                  skip={titleDef ? [titleDef.name] : []}
                />
              </div>
            </div>
            {panel === 'on' && doc && !collection.singleton && (
              <InfoPanel doc={doc} dirty={dirty} onRestore={restore} />
            )}
          </div>
        )}
      </div>

      <Dialog
        open={!!problems}
        onClose={() => setProblems(null)}
        title={tn(problems?.length ?? 0, 'Prima di pubblicare: un problema', 'Prima di pubblicare: {n} problemi')}
        width={460}
        footer={
          <>
            <Button
              onClick={() => {
                setProblems(null)
                window.dispatchEvent(new Event('mz:open-checks'))
              }}
              data-autofocus
            >
              {t('Vedi i controlli')}
            </Button>
            <Button variant="primary" onClick={() => void publish(true)}>
              {t('Pubblica lo stesso')}
            </Button>
          </>
        }
      >
        <p className="text-[14px] leading-relaxed">
          {t('Alcune persone potrebbero non riuscire a usare bene la pagina, o la pagina si apre lentamente:')}
        </p>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-[13.5px]">
          {problems?.slice(0, 5).map((p) => (
            <li key={p.id}>{p.label}</li>
          ))}
          {(problems?.length ?? 0) > 5 && <li>{t('e altri {n}', { n: (problems?.length ?? 0) - 5 })}</li>}
        </ul>
      </Dialog>

      {/* Where the history beside the editor is not shown (a phone, a single document). */}
      <Dialog
        open={historyDialog && !!doc}
        onClose={() => setHistoryDialog(false)}
        title={t('Cronologia')}
        width={420}
        footer={<Button onClick={() => setHistoryDialog(false)}>{t('Chiudi')}</Button>}
      >
        <div className="max-h-[60vh] overflow-y-auto">
          {doc && (
            <RevisionList
              docId={doc.id}
              onRestore={(rev) => {
                setHistoryDialog(false)
                void restore(rev)
              }}
            />
          )}
        </div>
      </Dialog>

      <Dialog
        open={confirmUnpublish}
        onClose={() => setConfirmUnpublish(false)}
        title={t('Togliere “{title}” dal sito?', { title })}
        footer={
          <>
            <Button onClick={() => setConfirmUnpublish(false)} data-autofocus>
              {t('Annulla')}
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                setConfirmUnpublish(false)
                void unpublish()
              }}
            >
              {t('Togli dal sito')}
            </Button>
          </>
        }
      >
        {t('Non sarà più visibile online e tornerà una bozza. Il contenuto resta qui: puoi ripubblicarlo quando vuoi.')}
      </Dialog>

      <Dialog
        open={reviewing}
        onClose={() => setReviewing(false)}
        title={t('Revisione AI')}
        width={520}
        footer={<Button onClick={() => setReviewing(false)}>{t('Fatto')}</Button>}
      >
        <div className="max-h-[60vh] overflow-y-auto">
          <Review docId={doc?.id} data={history.value} onApply={(next) => set(next, 'ai:review')} />
        </div>
      </Dialog>

      {doc && !collection.singleton && (
        <ReleaseDialog
          doc={doc}
          open={releasing}
          onClose={() => setReleasing(false)}
          ensureSaved={async () => (!doc || dirty ? await save() : doc)}
          onChange={(release) => setDoc((d) => (d ? { ...d, release } : d))}
          onError={handleError}
        />
      )}

      {doc && (
        <ShareDialog
          doc={doc}
          open={sharing}
          onClose={() => setSharing(false)}
          // A draft still incomplete can be shown too: that is often why it is shared.
          ensureSaved={async () => (!doc || dirty ? await save() : doc)}
          onError={handleError}
        />
      )}

      <Dialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title={t('Eliminare “{title}”?', { title })}
        footer={
          <>
            <Button onClick={() => setConfirmDelete(false)} data-autofocus>
              {t('Annulla')}
            </Button>
            <Button variant="danger" onClick={remove}>
              {t('Elimina')}
            </Button>
          </>
        }
      >
        {t('Il documento e la sua cronologia verranno eliminati. Se è pubblicato, sparirà dal sito.')}
      </Dialog>
    </FormContext.Provider>
  )
}

/** Every piece of text in a document (fields, page texts, rich text), in reading order. */
function wordsOf(value: unknown, out: string[] = [], key = ''): string[] {
  if (typeof value === 'string') {
    // Addresses, ids and settings are not words.
    if (
      value.trim() &&
      !/^(src|href|id|url|slug|icon|svg|html|style|type|layout|color|bg|anim|.*Id)$/.test(key) &&
      !/^[#/]|^https?:/.test(value)
    )
      out.push(value.trim())
  } else if (Array.isArray(value)) for (const v of value) wordsOf(v, out, key)
  else if (value && typeof value === 'object')
    for (const [k, v] of Object.entries(value)) if (k !== 'seo' && k !== 'over') wordsOf(v, out, k)
  return out
}

function SaveState({
  saving,
  dirty,
  isNew,
  issues,
  strong,
  onIssues,
}: {
  saving: boolean
  dirty: boolean
  isNew: boolean
  issues: number
  strong: boolean
  onIssues: () => void
}) {
  const text = saving
    ? t('Salvataggio…')
    : isNew
      ? t('Non ancora salvato')
      : dirty
        ? t('Modifiche in corso')
        : t('Salvato')
  return (
    <span
      className={cx(
        'ml-1 inline-flex items-center gap-2 text-[13px] whitespace-nowrap text-fg3',
        !issues && 'max-md:hidden',
      )}
    >
      <span className="max-md:hidden">{text}</span>
      {issues > 0 && (
        <button
          type="button"
          onClick={onIssues}
          title={t('Vanno completati prima di pubblicare')}
          className={cx(
            'inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium',
            strong ? 'bg-danger/12 text-danger' : 'bg-warn/12 text-warn',
          )}
        >
          <CircleAlert className="size-3.5" />
          <span className="max-sm:hidden">{tn(issues, '1 campo da completare', '{n} campi da completare')}</span>
          <span className="sm:hidden">{issues}</span>
        </button>
      )}
    </span>
  )
}

function TitleInput({
  value,
  onChange,
  error,
  placeholder,
}: {
  value: string
  onChange: (v: string) => void
  error?: string
  placeholder: string
}) {
  return (
    <div className="mb-8" data-path="title">
      <textarea
        rows={1}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value.replace(/\n/g, ''))}
        ref={(el) => {
          if (!el) return
          el.style.height = 'auto'
          el.style.height = `${el.scrollHeight}px`
        }}
        className="block w-full resize-none bg-transparent text-[28px] leading-tight font-semibold tracking-tight placeholder:text-fg3/60 focus:outline-none"
      />
      {error && <p className="mt-1 text-[13px] text-danger">{error}</p>}
    </div>
  )
}

const kindLabel = () => ({ save: t('Salvataggio'), publish: t('Pubblicazione'), restore: t('Ripristino') })

/**
 * The saved versions of a document, newest first. "Ripristina" puts one back in the draft; with
 * `onPick`, a click on a version shows it first (pages on the canvas).
 */
function RevisionList({
  docId,
  onRestore,
  onPick,
  selected,
}: {
  docId: string
  onRestore: (id: string) => void
  onPick?: (revision: Revision, label: string) => void
  selected?: string
}) {
  const revisions = useQuery({ queryKey: ['revisions', docId], queryFn: () => api.revisions(docId) })
  if (revisions.isPending) return <Spinner />
  const items = revisions.data?.items ?? []
  if (!items.length) return <p className="text-[13px] text-fg3">{t('Nessuna versione salvata.')}</p>
  return (
    <ol className="relative space-y-0.5 border-l border-line pl-3">
      {items.map((r, i) => {
        const version = i === 0 ? t('l’ultima versione') : t('la versione del {date}', { date: fullDate(r.createdAt) })
        const label = r.authorName ? t('{version} di {name}', { version, name: r.authorName }) : version
        return (
          <li
            key={r.id}
            className={cx(
              'group relative -ml-3 flex items-center gap-2 rounded-md py-1 pr-1 pl-3 hover:bg-hover',
              selected === r.id && 'bg-accent/10',
            )}
          >
            <span
              className={cx(
                'absolute top-1/2 -left-[3.5px] size-[7px] -translate-y-1/2 rounded-full border-2 border-panel',
                r.kind === 'publish' ? 'bg-ok' : 'bg-line2',
              )}
            />
            <button
              type="button"
              disabled={!onPick}
              className="min-w-0 flex-1 text-left disabled:cursor-default"
              onClick={() => onPick?.(r, label)}
            >
              <span className="block text-[13px]">{kindLabel()[r.kind]}</span>
              {/* Who made it: the name, or "persona rimossa" when the account no longer exists. */}
              {r.authorId && (
                <span className="block truncate text-[12px] text-fg2">{r.authorName ?? t('Persona rimossa')}</span>
              )}
              <span className="block text-[12px] text-fg3" title={fullDate(r.createdAt)}>
                {/* Many saves on the same day: past the last few hours, the time tells them apart. */}
                {Date.now() - new Date(r.createdAt).getTime() < 6 * 60 * 60_000
                  ? relativeTime(r.createdAt)
                  : fullDate(r.createdAt)}
              </span>
            </button>
            {i > 0 && (
              <Button
                size="sm"
                variant="ghost"
                className={cx(
                  'group-hover:opacity-100 focus-visible:opacity-100 [@media(hover:none)]:opacity-100',
                  selected === r.id ? 'opacity-100' : 'opacity-0',
                )}
                onClick={() => onRestore(r.id)}
              >
                {t('Ripristina')}
              </Button>
            )}
          </li>
        )
      })}
    </ol>
  )
}

function InfoPanel({
  doc,
  dirty,
  onRestore,
}: {
  doc: StoredDocument
  dirty: boolean
  onRestore: (id: string) => void
}) {
  const { schema } = useSession()
  const status = dirty && doc.status === 'published' ? 'changed' : doc.status
  const row = 'flex items-start justify-between gap-3 py-1.5'
  const publicUrl = doc.url && schema.site.url ? new URL(doc.url, schema.site.url).toString() : null

  return (
    // On phones the form takes the whole width: details and history are for larger screens.
    <aside className="w-[280px] shrink-0 overflow-y-auto border-l border-line bg-panel max-md:hidden">
      <section className="border-b border-line px-4 py-3.5">
        <h2 className="mb-1.5 text-[13px] font-medium text-fg3">{t('Documento')}</h2>
        <div className={row}>
          <span className="text-fg2">{t('Stato')}</span>
          <StatusBadge status={status} short />
        </div>
        {doc.url && (
          <div className={row}>
            <span className="text-fg2">{t('Indirizzo')}</span>
            {publicUrl && doc.publishedAt ? (
              <a
                href={publicUrl}
                target="_blank"
                rel="noreferrer"
                className="truncate font-mono text-[13px] text-accent hover:underline"
              >
                {doc.url}
              </a>
            ) : (
              <span className="truncate font-mono text-[13px]">{doc.url}</span>
            )}
          </div>
        )}
        {schema.locales.available.length > 1 && (
          <div className={row}>
            <span className="text-fg2">{t('Lingua')}</span>
            <span>{localeName(doc.locale)}</span>
          </div>
        )}
        <div className={row}>
          <span className="text-fg2">{t('Creato')}</span>
          <span title={fullDate(doc.createdAt)}>{relativeTime(doc.createdAt)}</span>
        </div>
        {doc.publishedAt && (
          <div className={row}>
            <span className="text-fg2">{t('Pubblicato')}</span>
            <span title={fullDate(doc.publishedAt)}>{relativeTime(doc.publishedAt)}</span>
          </div>
        )}
      </section>
      <section className="px-4 py-3.5">
        <h2 className="mb-2 flex items-center gap-1.5 text-[13px] font-medium text-fg3">
          <HistoryIcon className="size-3.5" /> {t('Cronologia')}
        </h2>
        <RevisionList docId={doc.id} onRestore={onRestore} />
      </section>
    </aside>
  )
}
