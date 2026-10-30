import { useQueryClient } from '@tanstack/react-query'
import { Check, CopyPlus, ExternalLink, EyeOff, Link2, MoreHorizontal, PencilLine, Send, Trash2, X } from 'lucide-react'
import { useState } from 'react'
import { Button, cx, Dialog, MenuItem, MenuSeparator, Popover, toast } from '../components/ui.tsx'
import { ApiError, api, type CollectionDescription, type Data, type DocumentSummary } from '../lib/api.ts'
import { navigate } from '../lib/router.ts'
import { useSession } from './context.ts'

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

/**
 * What can be done to documents from their list, one or many at a time: publish, take off the
 * site, duplicate, delete. Every action reports what happened, including what could not be done.
 */
export function useListActions(collection: CollectionDescription) {
  const queryClient = useQueryClient()
  const { locale } = useSession()
  const [busy, setBusy] = useState(false)
  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ['list', collection.name] })
    void queryClient.invalidateQueries({ queryKey: ['overview'] })
  }

  /** Runs one request per document; the failures are counted, not thrown. */
  const each = async (ids: string[], run: (id: string) => Promise<unknown>) => {
    setBusy(true)
    let failed = 0
    let incomplete = 0
    for (const id of ids)
      try {
        await run(id)
      } catch (error) {
        failed++
        if (error instanceof ApiError && error.status === 422) incomplete++
      }
    setBusy(false)
    refresh()
    return { done: ids.length - failed, failed, incomplete }
  }

  return {
    busy,
    publish: async (ids: string[]) => {
      const r = await each(ids, (id) => api.publish(id))
      if (r.done) toast(r.done === 1 ? 'Pubblicato' : `${r.done} pubblicati`)
      if (r.incomplete)
        toast(
          r.incomplete === 1
            ? 'Un documento ha campi da completare: aprilo per vedere cosa manca'
            : `${r.incomplete} documenti hanno campi da completare: aprili per vedere cosa manca`,
          'error',
        )
      else if (r.failed) toast(`${plural(r.failed, 'non pubblicato', 'non pubblicati')}`, 'error')
    },
    unpublish: async (ids: string[]) => {
      const r = await each(ids, (id) => api.unpublish(id))
      if (r.done)
        toast(r.done === 1 ? 'Tolto dal sito: resta come bozza' : `${r.done} tolti dal sito: restano come bozze`)
      if (r.failed) toast(`${plural(r.failed, 'non ritirato', 'non ritirati')}`, 'error')
    },
    duplicate: async (ids: string[]) => {
      let last = ''
      const r = await each(ids, async (id) => {
        const doc = await api.get(id)
        const data: Data = { ...doc.data }
        const title = data[collection.titleField]
        if (typeof title === 'string') data[collection.titleField] = `${title} (copia)`
        if (collection.slugField) data[collection.slugField] = ''
        last = (await api.create(collection.name, data, doc.locale ?? locale)).id
      })
      if (r.done === 1 && ids.length === 1) {
        toast('Copia creata come bozza')
        navigate({ name: 'document', collection: collection.name, id: last })
      } else if (r.done) toast(`${plural(r.done, 'copia creata', 'copie create')} come bozze`)
      if (r.failed) toast(`${plural(r.failed, 'copia non riuscita', 'copie non riuscite')}`, 'error')
    },
    remove: async (ids: string[]) => {
      const r = await each(ids, (id) => api.remove(id))
      if (r.done) toast(r.done === 1 ? 'Eliminato' : `${r.done} eliminati`)
      if (r.failed) toast(`${plural(r.failed, 'non eliminato', 'non eliminati')}`, 'error')
    },
  }
}

export type ListActions = ReturnType<typeof useListActions>

/** Asks before deleting: what disappears from the site, and that it cannot be undone. */
export function ConfirmDelete({
  docs,
  onCancel,
  onConfirm,
}: {
  docs: DocumentSummary[] | null
  onCancel: () => void
  onConfirm: () => void
}) {
  const live = docs?.filter((d) => d.status !== 'draft').length ?? 0
  const one = docs?.length === 1
  return (
    <Dialog
      open={!!docs}
      onClose={onCancel}
      title={one ? `Eliminare “${docs?.[0]?.title}”?` : `Eliminare ${docs?.length} documenti?`}
      footer={
        <>
          <Button onClick={onCancel} data-autofocus>
            Annulla
          </Button>
          <Button variant="danger" onClick={onConfirm}>
            Elimina
          </Button>
        </>
      }
    >
      {live
        ? `${one ? 'È pubblicato: sparirà' : `${live === docs?.length ? 'Sono' : `${live} sono`} pubblicati: spariranno`} dal sito. `
        : ''}
      Bozze e cronologia vengono eliminate definitivamente; le eventuali traduzioni restano.
    </Dialog>
  )
}

/** The ⋯ menu of one document in a list. */
export function RowMenu({
  collection,
  doc,
  actions,
  onDelete,
  className,
}: {
  collection: CollectionDescription
  doc: DocumentSummary
  actions: ListActions
  onDelete: (doc: DocumentSummary) => void
  className?: string
}) {
  const { user } = useSession()
  const live = doc.status !== 'draft' && doc.url
  return (
    <Popover
      align="end"
      width={210}
      trigger={({ toggle, ref, open }) => (
        <button
          ref={ref}
          type="button"
          aria-label={`Azioni per ${doc.title}`}
          title="Azioni"
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            toggle()
          }}
          className={cx(
            'flex size-7 shrink-0 items-center justify-center rounded-md text-fg2 transition-[opacity,background] hover:bg-hover hover:text-fg [&_svg]:size-4',
            open ? 'bg-hover opacity-100' : 'opacity-0 group-hover:opacity-100 focus-visible:opacity-100',
            className,
          )}
        >
          <MoreHorizontal />
        </button>
      )}
    >
      {(close) => {
        const run = (fn: () => void) => () => {
          close()
          fn()
        }
        return (
          <div className="p-1">
            <MenuItem
              icon={<PencilLine />}
              onClick={run(() => navigate({ name: 'document', collection: collection.name, id: doc.id }))}
            >
              Apri
            </MenuItem>
            {live && (
              <MenuItem icon={<ExternalLink />} onClick={run(() => window.open(doc.url as string, '_blank'))}>
                Apri sul sito
              </MenuItem>
            )}
            {live && (
              <MenuItem
                icon={<Link2 />}
                onClick={run(() =>
                  navigator.clipboard
                    ?.writeText(new URL(doc.url as string, location.origin).toString())
                    .then(() => toast('Indirizzo copiato')),
                )}
              >
                Copia indirizzo
              </MenuItem>
            )}
            <MenuItem icon={<CopyPlus />} onClick={run(() => void actions.duplicate([doc.id]))}>
              Duplica
            </MenuItem>
            <MenuSeparator />
            {doc.status !== 'published' && (
              <MenuItem icon={<Send />} onClick={run(() => void actions.publish([doc.id]))}>
                {doc.status === 'changed' ? 'Pubblica le modifiche' : 'Pubblica'}
              </MenuItem>
            )}
            {doc.status !== 'draft' && (
              <MenuItem icon={<EyeOff />} onClick={run(() => void actions.unpublish([doc.id]))}>
                Togli dal sito
              </MenuItem>
            )}
            {user.role === 'admin' && (
              <>
                <MenuSeparator />
                <MenuItem icon={<Trash2 />} danger onClick={run(() => onDelete(doc))}>
                  Elimina…
                </MenuItem>
              </>
            )}
          </div>
        )
      }}
    </Popover>
  )
}

/** A square checkbox for selecting rows and tiles. */
export function SelectBox({
  checked,
  partial,
  label,
  onToggle,
  className,
}: {
  checked: boolean
  partial?: boolean
  label: string
  onToggle: (e: React.MouseEvent) => void
  className?: string
}) {
  return (
    // biome-ignore lint/a11y/useSemanticElements: a styled box that also reads ⇧ for range selection
    <button
      type="button"
      role="checkbox"
      aria-checked={partial ? 'mixed' : checked}
      aria-label={label}
      title={label}
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        onToggle(e)
      }}
      className={cx(
        'flex size-[18px] shrink-0 items-center justify-center rounded-[5px] border transition-[opacity,background,border-color] [&_svg]:size-3',
        checked || partial
          ? 'border-accent bg-accent text-white'
          : 'border-line2 bg-panel text-transparent hover:border-fg3',
        className,
      )}
    >
      {partial && !checked ? <span className="h-0.5 w-2 rounded-full bg-white" /> : <Check strokeWidth={3} />}
    </button>
  )
}

/** Shown in place of the filters while documents are selected: what to do with all of them. */
export function BulkBar({
  count,
  total,
  docs,
  actions,
  onSelectAll,
  onClear,
  onDelete,
}: {
  count: number
  total: number
  docs: DocumentSummary[]
  actions: ListActions
  onSelectAll: () => void
  onClear: () => void
  onDelete: () => void
}) {
  const { user } = useSession()
  const ids = docs.map((d) => d.id)
  const toPublish = docs.filter((d) => d.status !== 'published').map((d) => d.id)
  const live = docs.filter((d) => d.status !== 'draft').map((d) => d.id)
  const btn =
    'inline-flex h-7 items-center gap-1.5 rounded-md px-2.5 text-[13px] font-medium text-fg2 transition-colors hover:bg-hover hover:text-fg disabled:pointer-events-none disabled:opacity-40 [&_svg]:size-3.5'
  return (
    <div className="flex min-h-7 flex-1 flex-wrap items-center gap-1">
      <SelectBox
        checked={count === total}
        partial={count > 0 && count < total}
        label={count === total ? 'Deseleziona tutti' : 'Seleziona tutti'}
        onToggle={() => (count === total ? onClear() : onSelectAll())}
        className="mr-1.5"
      />
      <span className="mr-2 text-[13px] font-medium">{count === 1 ? '1 selezionato' : `${count} selezionati`}</span>
      <button
        type="button"
        className={btn}
        disabled={actions.busy || !toPublish.length}
        onClick={() => void actions.publish(toPublish).then(onClear)}
      >
        <Send /> Pubblica{toPublish.length && toPublish.length < count ? ` (${toPublish.length})` : ''}
      </button>
      <button
        type="button"
        className={btn}
        disabled={actions.busy || !live.length}
        onClick={() => void actions.unpublish(live).then(onClear)}
      >
        <EyeOff /> Togli dal sito{live.length && live.length < count ? ` (${live.length})` : ''}
      </button>
      <button
        type="button"
        className={btn}
        disabled={actions.busy}
        onClick={() => void actions.duplicate(ids).then(onClear)}
      >
        <CopyPlus /> Duplica
      </button>
      {user.role === 'admin' && (
        <button type="button" className={cx(btn, 'hover:text-danger')} disabled={actions.busy} onClick={onDelete}>
          <Trash2 /> Elimina
        </button>
      )}
      <div className="flex-1" />
      <button type="button" className={btn} onClick={onClear} title="Annulla la selezione (Esc)">
        <X /> Annulla
      </button>
    </div>
  )
}
