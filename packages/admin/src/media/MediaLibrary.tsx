import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Check,
  Copy,
  Download,
  Images,
  Maximize2,
  MoreHorizontal,
  PanelRight,
  Search,
  Trash2,
  Upload as UploadIcon,
  X,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useSession } from '../app/context.ts'
import { SelectBox } from '../app/ListActions.tsx'
import { AiButton } from '../components/AiMenu.tsx'
import {
  Button,
  cx,
  Dialog,
  IconButton,
  Input,
  MenuItem,
  MenuSeparator,
  Popover,
  ScreenHeader,
  Spinner,
  Textarea,
  toast,
} from '../components/ui.tsx'
import { api, type MediaAsset, thumb } from '../lib/api.ts'
import { fullDate, relativeTime } from '../lib/format.ts'
import { t, tn } from '../lib/i18n.ts'
import { DropZone, MediaGrid } from './MediaGrid.tsx'
import { ACCEPT, formatSize, useUploads } from './uploads.ts'

export function useDebounced(value: string, ms = 200) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value.trim()), ms)
    return () => clearTimeout(timer)
  }, [value, ms])
  return debounced
}

/** Hidden file input behind an "upload" button. */
export function useFilePicker(onFiles: (files: File[]) => void) {
  const input = useRef<HTMLInputElement>(null)
  const element = (
    <input
      ref={input}
      type="file"
      accept={ACCEPT}
      multiple
      hidden
      onChange={(e) => {
        onFiles([...(e.target.files ?? [])])
        e.target.value = ''
      }}
    />
  )
  return { element, open: () => input.current?.click() }
}

const copyUrl = (asset: MediaAsset) =>
  navigator.clipboard
    ?.writeText(new URL(asset.url, location.origin).toString())
    .then(() => toast(t('Indirizzo copiato')))

export function MediaLibrary() {
  const { user } = useSession()
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const debounced = useDebounced(search)
  const [selected, setSelected] = useState<MediaAsset | null>(null)
  const { uploads, start, dismiss } = useUploads()
  const picker = useFilePicker(start)
  // Several files at once: tick them (⇧ for a range), then delete them together.
  const [checked, setChecked] = useState<Map<string, MediaAsset>>(new Map())
  const [deleting, setDeleting] = useState<MediaAsset[] | null>(null)
  const [busy, setBusy] = useState(false)
  const anchor = useRef<string | null>(null)
  const admin = user.role === 'admin'

  const check = (asset: MediaAsset, e: React.MouseEvent, all: MediaAsset[]) => {
    const next = new Map(checked)
    const from = anchor.current ? all.findIndex((a) => a.id === anchor.current) : -1
    const to = all.findIndex((a) => a.id === asset.id)
    if (e.shiftKey && from >= 0) {
      const on = !checked.has(asset.id)
      for (const a of all.slice(Math.min(from, to), Math.max(from, to) + 1))
        if (on) next.set(a.id, a)
        else next.delete(a.id)
    } else if (next.has(asset.id)) next.delete(asset.id)
    else next.set(asset.id, asset)
    anchor.current = asset.id
    setChecked(next)
  }

  const remove = async (assets: MediaAsset[]) => {
    setDeleting(null)
    setBusy(true)
    let failed = 0
    for (const a of assets)
      try {
        await api.removeMedia(a.id)
      } catch {
        failed++
      }
    setBusy(false)
    setChecked(new Map())
    if (selected && assets.some((a) => a.id === selected.id)) setSelected(null)
    void queryClient.invalidateQueries({ queryKey: ['media'] })
    const done = assets.length - failed
    if (done) toast(tn(done, 'File eliminato', '{n} file eliminati'))
    if (failed) toast(tn(failed, 'Un file non è stato eliminato', '{n} file non eliminati'), 'error')
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      if (target.closest?.('input, textarea, select, [contenteditable="true"], [role="dialog"]')) return
      if (e.key === 'Escape' && checked.size) setChecked(new Map())
      else if ((e.key === 'Backspace' || e.key === 'Delete') && checked.size && admin) {
        e.preventDefault()
        setDeleting([...checked.values()])
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const menu = (asset: MediaAsset) => (
    <Popover
      align="end"
      width={200}
      trigger={({ toggle, ref, open }) => (
        <button
          ref={ref}
          type="button"
          aria-label={t('Azioni per {name}', { name: asset.filename })}
          title={t('Azioni')}
          onClick={toggle}
          className={cx(
            'flex size-7 items-center justify-center rounded-full bg-panel/90 text-fg2 shadow-sm backdrop-blur transition-opacity hover:text-fg [&_svg]:size-4',
            open ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 focus-visible:opacity-100',
          )}
        >
          <MoreHorizontal />
        </button>
      )}
    >
      {(close) => (
        <div className="p-1">
          <MenuItem
            icon={<PanelRight />}
            onClick={() => {
              close()
              setSelected(asset)
            }}
          >
            {t('Dettagli e testo alternativo')}
          </MenuItem>
          <MenuItem
            icon={<Copy />}
            onClick={() => {
              close()
              void copyUrl(asset)
            }}
          >
            {t('Copia indirizzo')}
          </MenuItem>
          <MenuItem
            icon={<Download />}
            onClick={() => {
              close()
              const a = document.createElement('a')
              a.href = asset.url
              a.download = asset.filename
              a.click()
            }}
          >
            {t('Scarica')}
          </MenuItem>
          {admin && (
            <>
              <MenuSeparator />
              <MenuItem
                icon={<Trash2 />}
                danger
                onClick={() => {
                  close()
                  setDeleting([asset])
                }}
              >
                {t('Elimina…')}
              </MenuItem>
            </>
          )}
        </div>
      )}
    </Popover>
  )

  return (
    // The header spans the whole width, so opening the details never moves its buttons.
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      {checked.size > 0 ? (
        <header className="mt-6 flex h-12 shrink-0 items-center gap-2 px-4 sm:mt-8 sm:px-8">
          <SelectBox checked label={t('Deseleziona tutti')} onToggle={() => setChecked(new Map())} />
          <span className="ml-1 text-[14px] font-medium">
            {tn(checked.size, '1 file selezionato', '{n} file selezionati')}
          </span>
          <div className="flex-1" />
          {admin && (
            <Button
              variant="danger"
              size="sm"
              icon={<Trash2 className="size-3.5" />}
              loading={busy}
              onClick={() => setDeleting([...checked.values()])}
            >
              {t('Elimina')}
            </Button>
          )}
          <Button size="sm" icon={<X className="size-3.5" />} onClick={() => setChecked(new Map())}>
            {t('Annulla')}
          </Button>
        </header>
      ) : (
        <ScreenHeader
          icon={<Images />}
          color="#0ea5e9"
          title={t('Media')}
          subtitle={t('Immagini, video e modelli 3D del sito: trascinali qui per caricarli.')}
          actions={
            <Button variant="primary" icon={<UploadIcon className="size-4" />} onClick={picker.open}>
              {t('Carica')}
            </Button>
          }
        >
          <div className="mt-6 flex items-center">
            <div className="relative w-full sm:w-80">
              <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-fg3" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t('Cerca per nome o descrizione')}
                className="pl-8"
                aria-label={t('Cerca nei media')}
              />
            </div>
          </div>
        </ScreenHeader>
      )}
      {picker.element}
      <div className="flex min-h-0 flex-1">
        <DropZone onFiles={start} className="min-h-0 min-w-0 flex-1 overflow-y-auto">
          <MediaGrid
            className="px-4 pt-4 pb-8 sm:px-8"
            search={debounced}
            uploads={uploads}
            selected={selected?.id}
            onSelect={setSelected}
            onDismiss={dismiss}
            onUploadClick={picker.open}
            checked={new Set(checked.keys())}
            onCheck={check}
            menu={menu}
          />
        </DropZone>
        {selected && <MediaDetails key={selected.id} asset={selected} onClose={() => setSelected(null)} />}
      </div>
      <Dialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        title={
          deleting?.length === 1
            ? t('Eliminare “{name}”?', { name: deleting[0]?.filename })
            : t('Eliminare {n} file?', { n: deleting?.length })
        }
        footer={
          <>
            <Button onClick={() => setDeleting(null)} data-autofocus>
              {t('Annulla')}
            </Button>
            <Button variant="danger" onClick={() => deleting && void remove(deleting)}>
              {t('Elimina')}
            </Button>
          </>
        }
      >
        {t(
          'I file vengono eliminati definitivamente: dove sono usati, nelle pagine e nei contenuti, non si vedranno più.',
        )}
      </Dialog>
    </div>
  )
}

function MediaDetails({ asset, onClose }: { asset: MediaAsset; onClose: () => void }) {
  const { user } = useSession()
  const queryClient = useQueryClient()
  const detail = useQuery({ queryKey: ['media-item', asset.id], queryFn: () => api.mediaItem(asset.id) })
  const [alt, setAlt] = useState(asset.alt)
  const [saved, setSaved] = useState(false)
  const [confirm, setConfirm] = useState(false)
  const [viewing, setViewing] = useState(false)
  const usage = detail.data?.usage
  const image = asset.mime.startsWith('image/')

  const saveAlt = async (value = alt) => {
    if (value === (detail.data?.alt ?? asset.alt)) return
    try {
      await api.updateMedia(asset.id, { alt: value })
      queryClient.invalidateQueries({ queryKey: ['media'] })
      queryClient.invalidateQueries({ queryKey: ['media-item', asset.id] })
      setSaved(true)
      setTimeout(() => setSaved(false), 1500)
    } catch (error) {
      toast((error as Error).message, 'error')
    }
  }

  const remove = async () => {
    try {
      await api.removeMedia(asset.id)
      queryClient.invalidateQueries({ queryKey: ['media'] })
      toast(t('Immagine eliminata'))
      onClose()
    } catch (error) {
      toast((error as Error).message, 'error')
    }
  }

  const row = 'flex justify-between gap-3 py-1'

  return (
    // A card of its own beside the grid, lined up with its first row; on phones a sheet over the grid.
    <aside className="flex w-[340px] shrink-0 flex-col pt-4 pr-4 pb-4 sm:pr-8 max-md:fixed max-md:inset-x-2 max-md:bottom-2 max-md:z-30 max-md:max-h-[75dvh] max-md:w-auto max-md:p-0">
      <div className="min-h-0 overflow-y-auto rounded-2xl bg-panel2 max-md:shadow-pop">
        <div className="relative p-3">
          {image ? (
            <button
              type="button"
              onClick={() => setViewing(true)}
              title={t('Guarda in grande')}
              aria-label={t('Guarda in grande')}
              className="group relative block w-full cursor-zoom-in rounded-xl"
            >
              <img
                src={thumb(asset.url, 640)}
                alt={asset.alt}
                className="mx-auto max-h-72 rounded-xl object-contain max-md:max-h-40"
              />
              <span className="absolute bottom-2 left-2 flex items-center gap-1 rounded-full bg-black/60 px-2 py-1 text-[12px] font-medium text-white opacity-0 backdrop-blur transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100 [&_svg]:size-3.5">
                <Maximize2 />
                {t('Guarda in grande')}
              </span>
            </button>
          ) : (
            <img
              src={thumb(asset.url, 640)}
              alt={asset.alt}
              className="mx-auto max-h-72 rounded-xl object-contain max-md:max-h-40"
            />
          )}
          <IconButton
            label={t('Chiudi')}
            onClick={onClose}
            className="absolute top-2 right-2 bg-panel/90 shadow-sm backdrop-blur"
          >
            <X />
          </IconButton>
        </div>
        <div className="space-y-4 px-4 pt-1 pb-4">
          <div>
            <div className="truncate text-[14px] font-semibold" title={asset.filename}>
              {asset.filename}
            </div>
            <div className="mt-2 text-[13px]">
              {asset.width && (
                <div className={row}>
                  <span className="text-fg2">{t('Dimensioni in pixel')}</span>
                  <span className="tabular-nums">
                    {asset.width} × {asset.height}
                  </span>
                </div>
              )}
              <div className={row}>
                <span className="text-fg2">{t('Peso del file')}</span>
                <span>{formatSize(asset.size)}</span>
              </div>
              <div className={row}>
                <span className="text-fg2">{t('Caricata')}</span>
                <span title={fullDate(asset.createdAt)}>{relativeTime(asset.createdAt)}</span>
              </div>
              <div className={row}>
                <span className="text-fg2">{t('Usata in')}</span>
                <span>
                  {usage === undefined ? <Spinner className="size-3" /> : tn(usage, '1 documento', '{n} documenti')}
                </span>
              </div>
            </div>
          </div>
          <label className="block">
            <span className="mb-1.5 flex items-center gap-1.5 text-[13px] font-medium text-fg2">
              {t('Testo alternativo')}
              {saved && <Check className="size-3.5 text-ok" />}
              {asset.mime.startsWith('image/') && (
                <span className="ml-auto">
                  <AiButton
                    action="alt"
                    src={asset.url}
                    text={alt}
                    label={t('Descrivi con l’AI')}
                    onResult={(text) => {
                      setAlt(text)
                      void saveAlt(text)
                    }}
                  />
                </span>
              )}
            </span>
            <Textarea
              value={alt}
              onChange={(e) => setAlt(e.target.value)}
              onBlur={() => saveAlt()}
              placeholder={t('Descrivi l’immagine a chi non può vederla')}
            />
            <span className="mt-1 block text-[13px] text-fg3">
              {t('Proposto quando scegli l’immagine in un documento.')}
            </span>
          </label>
          <div className="flex gap-1.5">
            <Button size="sm" icon={<Copy className="size-3.5" />} onClick={() => void copyUrl(asset)}>
              {t('Copia indirizzo')}
            </Button>
            <div className="flex-1" />
            {user.role === 'admin' && (
              <IconButton label={t('Elimina')} onClick={() => setConfirm(true)} className="hover:text-danger">
                <Trash2 />
              </IconButton>
            )}
          </div>
        </div>
      </div>
      {viewing && <MediaViewer asset={asset} onClose={() => setViewing(false)} />}
      <Dialog
        open={confirm}
        onClose={() => setConfirm(false)}
        title={t('Eliminare l’immagine?')}
        footer={
          <>
            <Button onClick={() => setConfirm(false)} data-autofocus>
              {t('Annulla')}
            </Button>
            <Button variant="danger" onClick={remove}>
              {t('Elimina')}
            </Button>
          </>
        }
      >
        {usage
          ? t('È usata in {where}: lì l’immagine non si vedrà più. Il file verrà eliminato definitivamente.', {
              where: tn(usage, 'un documento', '{n} documenti'),
            })
          : t('Non è usata in nessun documento. Il file verrà eliminato definitivamente.')}
      </Dialog>
    </aside>
  )
}

/** The image at full size over the whole panel: Esc, a click outside or × closes it. */
function MediaViewer({ asset, onClose }: { asset: MediaAsset; onClose: () => void }) {
  const box = useRef<HTMLDivElement>(null)
  // Focus moves into the viewer, so Esc reaches it; closed, it goes back to the preview.
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null
    box.current?.focus()
    return () => opener?.focus()
  }, [])
  return createPortal(
    <div
      ref={box}
      role="dialog"
      aria-modal="true"
      aria-label={asset.filename}
      tabIndex={-1}
      onClick={(e) => e.target === e.currentTarget && onClose()}
      onKeyDown={(e) => {
        if (e.key !== 'Escape') return
        e.stopPropagation()
        onClose()
      }}
      className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-3 bg-black/85 p-4 outline-none backdrop-blur-sm sm:p-10"
    >
      <img src={asset.url} alt={asset.alt} className="min-h-0 max-w-full flex-1 rounded-lg object-contain" />
      <div className="flex max-w-full items-center gap-3 text-[13px] text-white/80">
        <span className="truncate font-medium text-white">{asset.filename}</span>
        {asset.width && (
          <span className="shrink-0 tabular-nums">
            {asset.width} × {asset.height}
          </span>
        )}
        <span className="shrink-0">{formatSize(asset.size)}</span>
      </div>
      <IconButton
        label={t('Chiudi')}
        onClick={onClose}
        className="absolute top-3 right-3 size-9 bg-white/10 text-white hover:bg-white/20 hover:text-white"
      >
        <X />
      </IconButton>
    </div>,
    document.body,
  )
}
