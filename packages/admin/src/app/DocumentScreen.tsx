import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft,
  Check,
  CircleAlert,
  Copy,
  EyeOff,
  FileText,
  History as HistoryIcon,
  LayoutTemplate,
  MoreHorizontal,
  PanelRight,
  Redo2,
  Trash2,
  Undo2,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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
  type StoredDocument,
  type ValidationIssue,
} from '../lib/api.ts'
import { clean, emptyValue } from '../lib/doc.ts'
import { fullDate, relativeTime } from '../lib/format.ts'
import { useHistory } from '../lib/history.ts'
import { usePref } from '../lib/prefs.ts'
import { navigate, setNavigationGuard } from '../lib/router.ts'
import { useSession } from './context.ts'
import { localeName } from './Sidebar.tsx'

export function DocumentScreen({ collection, id }: { collection: CollectionDescription; id: string | null }) {
  const doc = useQuery({
    queryKey: ['doc', id],
    queryFn: () => api.get(id as string),
    enabled: !!id,
    staleTime: Infinity,
  })
  if (id && doc.isPending) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Spinner />
      </div>
    )
  }
  if (id && doc.error) {
    return (
      <EmptyState icon={<FileText />} title="Documento non trovato">
        <button
          type="button"
          className="text-accent hover:underline"
          onClick={() => navigate({ name: 'collection', collection: collection.name })}
        >
          Torna a {collection.label}
        </button>
      </EmptyState>
    )
  }
  return <Editor collection={collection} initial={doc.data ?? null} />
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

function Editor({ collection, initial }: { collection: CollectionDescription; initial: StoredDocument | null }) {
  const { locale, user, schema } = useSession()
  const queryClient = useQueryClient()
  const fields = collection.fields
  const history = useHistory<Data>(initial?.data ?? initialData(collection))
  const [doc, setDoc] = useState(initial)
  // Compared with the current data to detect changes; a new document starts from its empty defaults.
  const [saved, setSaved] = useState(() => JSON.stringify(clean(fields, initial?.data ?? initialData(collection))))
  const [saving, setSaving] = useState(false)
  const [issues, setIssues] = useState<ValidationIssue[]>(initial?.issues ?? [])
  // Problems are listed quietly while editing and highlighted once someone tries to publish.
  const [showErrors, setShowErrors] = useState(false)
  const [focusRequest, setFocusRequest] = useState<{ path: string; n: number } | null>(null)
  const [publishing, setPublishing] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [panel, setPanel] = usePref<'on' | 'off'>('mz-doc-panel', 'on')
  const blocksField = fields.find((f) => f.kind === 'blocks')
  const [modePref, setMode] = usePref<Mode>('mz-mode', 'design')
  const mode: Mode = blocksField ? modePref : 'content'

  const cleaned = useMemo(() => clean(fields, history.value), [fields, history.value])
  const current = JSON.stringify(cleaned)
  const dirty = current !== saved
  const latest = useRef({ value: history.value, current, cleaned, doc, saving })
  latest.current = { value: history.value, current, cleaned, doc, saving }

  const titleDef = fields.find((f) => f.name === collection.titleField && f.kind === 'text')
  const titleValue = history.value[collection.titleField]
  const title = typeof titleValue === 'string' && titleValue.trim() ? titleValue : 'Senza titolo'

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
    if (latest.current.saving) return null
    setSaving(true)
    try {
      if (!existing) {
        const created = await api.create(collection.name, data, locale)
        applyServer(created, sent)
        setNavigationGuard(null)
        navigate({ name: 'document', collection: collection.name, id: created.id }, { replace: true })
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
  }, [collection.name, locale, applyServer, handleError])

  // Autosave drafts of existing documents shortly after the last change.
  useEffect(() => {
    if (!doc || !dirty || saving) return
    const t = setTimeout(save, 900)
    return () => clearTimeout(t)
  }, [doc, dirty, saving, save])

  const publish = async () => {
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
      toast(doc?.publishedAt ? 'Modifiche pubblicate' : 'Pubblicato')
    } catch (error) {
      handleError(error)
    } finally {
      setPublishing(false)
    }
  }

  const unpublish = async () => {
    if (!doc) return
    try {
      applyServer(await api.unpublish(doc.id), latest.current.current)
      toast('Ritirato dal sito')
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
      toast('Eliminato')
      navigate({ name: 'collection', collection: collection.name })
    } catch (error) {
      handleError(error)
    }
  }

  const restore = async (revision: string) => {
    if (!doc) return
    try {
      const res = await api.restore(doc.id, revision)
      history.set(res.data)
      applyServer(res, JSON.stringify(clean(fields, res.data)))
      toast('Versione ripristinata nella bozza')
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
      return confirm('Ci sono modifiche non salvate. Uscire comunque?')
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
    () => ({ issues: visibleIssues, docTitle: title, docUrl: doc?.url ?? null, siteUrl: schema.site.url }),
    [visibleIssues, title, doc?.url, schema.site.url],
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
            'relative flex h-12 shrink-0 items-center gap-2 border-b border-line bg-panel pr-3',
            collection.singleton ? 'pl-5' : 'pl-2',
          )}
        >
          {/* A singleton has no list to go back to: it stays in the sidebar like any section. */}
          {!collection.singleton && (
            <IconButton
              label={`Torna a ${collection.label}`}
              onClick={() => navigate({ name: 'collection', collection: collection.name })}
            >
              <ArrowLeft />
            </IconButton>
          )}
          <div className="flex min-w-0 items-center gap-1.5 text-[13px]">
            {!collection.singleton && (
              <>
                <button
                  type="button"
                  className="shrink-0 text-fg2 hover:text-fg"
                  onClick={() => navigate({ name: 'collection', collection: collection.name })}
                >
                  {collection.label}
                </button>
                <span className="text-fg3">/</span>
              </>
            )}
            <span className="truncate font-medium">{collection.singleton ? collection.label : title}</span>
          </div>
          {doc && <StatusBadge status={dirty && status === 'published' ? 'changed' : status} short />}
          <SaveState
            saving={saving}
            dirty={dirty}
            isNew={!doc}
            issues={issues.length}
            strong={showErrors}
            onIssues={() => showIssues()}
          />

          {blocksField && (
            <div className="absolute left-1/2 -translate-x-1/2">
              <Segmented
                value={mode}
                onChange={setMode}
                options={[
                  {
                    value: 'content',
                    label: (
                      <>
                        <FileText /> Contenuto
                      </>
                    ),
                    title: 'Modifica i campi',
                  },
                  {
                    value: 'design',
                    label: (
                      <>
                        <LayoutTemplate /> Design
                      </>
                    ),
                    title: 'Componi la pagina sulla tela',
                  },
                ]}
              />
            </div>
          )}

          <div className="ml-auto flex items-center gap-1">
            <IconButton label="Annulla (⌘Z)" disabled={!history.canUndo} onClick={history.undo}>
              <Undo2 />
            </IconButton>
            <IconButton label="Ripristina (⇧⌘Z)" disabled={!history.canRedo} onClick={history.redo}>
              <Redo2 />
            </IconButton>
            {mode === 'content' && (
              <IconButton
                label="Pannello documento"
                active={panel === 'on'}
                onClick={() => setPanel(panel === 'on' ? 'off' : 'on')}
              >
                <PanelRight />
              </IconButton>
            )}
            <Popover
              align="end"
              width={220}
              trigger={({ toggle, ref }) => (
                <IconButton ref={ref} label="Altre azioni" onClick={toggle}>
                  <MoreHorizontal />
                </IconButton>
              )}
            >
              {(close) => (
                <div className="p-1">
                  <MenuItem
                    icon={<EyeOff />}
                    disabled={!doc?.publishedAt}
                    onClick={() => {
                      close()
                      void unpublish()
                    }}
                  >
                    Ritira dal sito
                  </MenuItem>
                  <MenuItem
                    icon={<Copy />}
                    disabled={!doc}
                    onClick={() => {
                      close()
                      if (doc) void navigator.clipboard?.writeText(doc.id).then(() => toast('ID copiato'))
                    }}
                  >
                    Copia ID
                  </MenuItem>
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
                        Elimina
                      </MenuItem>
                    </>
                  )}
                </div>
              )}
            </Popover>
            {!doc ? (
              <>
                <Button onClick={() => void save()} loading={saving} className="ml-1">
                  Salva bozza
                </Button>
                <Button variant="primary" onClick={publish} loading={publishing}>
                  Pubblica
                </Button>
              </>
            ) : (
              <Button
                variant="primary"
                className="ml-1 min-w-24"
                onClick={publish}
                loading={publishing}
                disabled={upToDate}
                icon={upToDate ? <Check className="size-4" /> : undefined}
              >
                {upToDate ? 'Pubblicato' : status === 'draft' ? 'Pubblica' : 'Pubblica modifiche'}
              </Button>
            )}
          </div>
        </header>

        {mode === 'design' && blocksField ? (
          <DesignMode
            collection={collection}
            blocksField={blocksField}
            data={history.value}
            onChange={set}
            issues={visibleIssues}
            focusRequest={focusRequest}
          />
        ) : (
          <div className="flex min-h-0 flex-1">
            <div className="min-w-0 flex-1 overflow-y-auto">
              <div className="mx-auto max-w-[720px] px-8 pt-10 pb-32">
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
            {panel === 'on' && doc && <InfoPanel doc={doc} dirty={dirty} onRestore={restore} />}
          </div>
        )}
      </div>

      <Dialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title={`Eliminare “${title}”?`}
        footer={
          <>
            <Button onClick={() => setConfirmDelete(false)} data-autofocus>
              Annulla
            </Button>
            <Button variant="danger" onClick={remove}>
              Elimina
            </Button>
          </>
        }
      >
        Il documento e la sua cronologia verranno eliminati. Se è pubblicato, sparirà dal sito.
      </Dialog>
    </FormContext.Provider>
  )
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
  const text = saving ? 'Salvataggio…' : isNew ? 'Non ancora salvato' : dirty ? 'Modifiche in corso' : 'Salvato'
  return (
    <span className="ml-1 inline-flex items-center gap-2 text-[12px] whitespace-nowrap text-fg3">
      {text}
      {issues > 0 && (
        <button
          type="button"
          onClick={onIssues}
          title="Vanno completati prima di pubblicare"
          className={cx(
            'inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium',
            strong ? 'bg-danger/12 text-danger' : 'bg-warn/12 text-warn',
          )}
        >
          <CircleAlert className="size-3.5" />
          {issues === 1 ? '1 campo da completare' : `${issues} campi da completare`}
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
      {error && <p className="mt-1 text-[12px] text-danger">{error}</p>}
    </div>
  )
}

const kindLabel = { save: 'Salvataggio', publish: 'Pubblicazione', restore: 'Ripristino' }

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
  const revisions = useQuery({ queryKey: ['revisions', doc.id], queryFn: () => api.revisions(doc.id) })
  const status = dirty && doc.status === 'published' ? 'changed' : doc.status
  const row = 'flex items-start justify-between gap-3 py-1.5'
  const publicUrl = doc.url && schema.site.url ? new URL(doc.url, schema.site.url).toString() : null

  return (
    <aside className="w-[280px] shrink-0 overflow-y-auto border-l border-line bg-panel">
      <section className="border-b border-line px-4 py-3.5">
        <h2 className="mb-1.5 text-[12px] font-medium text-fg3">Documento</h2>
        <div className={row}>
          <span className="text-fg2">Stato</span>
          <StatusBadge status={status} short />
        </div>
        {doc.url && (
          <div className={row}>
            <span className="text-fg2">Indirizzo</span>
            {publicUrl && doc.publishedAt ? (
              <a
                href={publicUrl}
                target="_blank"
                rel="noreferrer"
                className="truncate font-mono text-[12px] text-accent hover:underline"
              >
                {doc.url}
              </a>
            ) : (
              <span className="truncate font-mono text-[12px]">{doc.url}</span>
            )}
          </div>
        )}
        {schema.locales.available.length > 1 && (
          <div className={row}>
            <span className="text-fg2">Lingua</span>
            <span>{localeName(doc.locale)}</span>
          </div>
        )}
        <div className={row}>
          <span className="text-fg2">Creato</span>
          <span title={fullDate(doc.createdAt)}>{relativeTime(doc.createdAt)}</span>
        </div>
        {doc.publishedAt && (
          <div className={row}>
            <span className="text-fg2">Pubblicato</span>
            <span title={fullDate(doc.publishedAt)}>{relativeTime(doc.publishedAt)}</span>
          </div>
        )}
      </section>
      <section className="px-4 py-3.5">
        <h2 className="mb-2 flex items-center gap-1.5 text-[12px] font-medium text-fg3">
          <HistoryIcon className="size-3.5" /> Cronologia
        </h2>
        {revisions.isPending ? (
          <Spinner />
        ) : (
          <ol className="relative space-y-0.5 border-l border-line pl-3">
            {revisions.data?.items.map((r, i) => (
              <li
                key={r.id}
                className="group relative -ml-3 flex items-center gap-2 rounded-md py-1 pr-1 pl-3 hover:bg-hover"
              >
                <span
                  className={cx(
                    'absolute top-1/2 -left-[3.5px] size-[7px] -translate-y-1/2 rounded-full border-2 border-panel',
                    r.kind === 'publish' ? 'bg-ok' : 'bg-line2',
                  )}
                />
                <span className="min-w-0 flex-1">
                  <span className="block text-[12.5px]">{kindLabel[r.kind]}</span>
                  <span className="block text-[11.5px] text-fg3" title={fullDate(r.createdAt)}>
                    {relativeTime(r.createdAt)}
                  </span>
                </span>
                {i > 0 && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="opacity-0 group-hover:opacity-100"
                    onClick={() => onRestore(r.id)}
                  >
                    Ripristina
                  </Button>
                )}
              </li>
            ))}
          </ol>
        )}
      </section>
    </aside>
  )
}
