import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Check,
  Copy,
  Download,
  Images,
  MoreHorizontal,
  PanelRight,
  Search,
  Trash2,
  Upload as UploadIcon,
  X,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
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
  Spinner,
  Textarea,
  toast,
} from '../components/ui.tsx'
import { api, type MediaAsset, thumb } from '../lib/api.ts'
import { fullDate, relativeTime } from '../lib/format.ts'
import { DropZone, MediaGrid } from './MediaGrid.tsx'
import { ACCEPT, formatSize, useUploads } from './uploads.ts'

export function useDebounced(value: string, ms = 200) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value.trim()), ms)
    return () => clearTimeout(t)
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
  navigator.clipboard?.writeText(new URL(asset.url, location.origin).toString()).then(() => toast('Indirizzo copiato'))

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
    if (done) toast(done === 1 ? 'File eliminato' : `${done} file eliminati`)
    if (failed) toast(failed === 1 ? 'Un file non è stato eliminato' : `${failed} file non eliminati`, 'error')
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement
      if (t.closest?.('input, textarea, select, [contenteditable="true"], [role="dialog"]')) return
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
          aria-label={`Azioni per ${asset.filename}`}
          title="Azioni"
          onClick={toggle}
          className={cx(
            'flex size-7 items-center justify-center rounded-md bg-panel/90 text-fg2 shadow-sm backdrop-blur transition-opacity hover:text-fg [&_svg]:size-4',
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
            Dettagli e testo alternativo
          </MenuItem>
          <MenuItem
            icon={<Copy />}
            onClick={() => {
              close()
              void copyUrl(asset)
            }}
          >
            Copia indirizzo
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
            Scarica
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
                Elimina…
              </MenuItem>
            </>
          )}
        </div>
      )}
    </Popover>
  )

  return (
    <div className="flex min-h-0 flex-1">
      <div className="flex min-w-0 flex-1 flex-col">
        {checked.size > 0 ? (
          <header className="flex h-12 shrink-0 items-center gap-2 border-b border-line bg-panel px-5">
            <SelectBox checked label="Deseleziona tutti" onToggle={() => setChecked(new Map())} />
            <span className="ml-1 text-[14px] font-medium">
              {checked.size === 1 ? '1 file selezionato' : `${checked.size} file selezionati`}
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
                Elimina
              </Button>
            )}
            <Button size="sm" icon={<X className="size-3.5" />} onClick={() => setChecked(new Map())}>
              Annulla
            </Button>
          </header>
        ) : (
          <header className="flex h-12 shrink-0 items-center gap-3 border-b border-line bg-panel px-5">
            <Images className="size-4 text-fg3" />
            <h1 className="text-[14px] font-semibold">Media</h1>
            <div className="flex-1" />
            <div className="relative w-56">
              <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-fg3" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Cerca per nome o descrizione"
                className="pl-8"
                aria-label="Cerca"
              />
            </div>
            <Button variant="primary" icon={<UploadIcon className="size-4" />} onClick={picker.open}>
              Carica
            </Button>
          </header>
        )}
        {picker.element}
        <DropZone onFiles={start} className="min-h-0 flex-1 overflow-y-auto">
          <MediaGrid
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
      </div>
      {selected && <MediaDetails key={selected.id} asset={selected} onClose={() => setSelected(null)} />}
      <Dialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        title={deleting?.length === 1 ? `Eliminare “${deleting[0]?.filename}”?` : `Eliminare ${deleting?.length} file?`}
        footer={
          <>
            <Button onClick={() => setDeleting(null)} data-autofocus>
              Annulla
            </Button>
            <Button variant="danger" onClick={() => deleting && void remove(deleting)}>
              Elimina
            </Button>
          </>
        }
      >
        I file vengono eliminati definitivamente: dove sono usati, nelle pagine e nei contenuti, non si vedranno più.
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
  const usage = detail.data?.usage

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
      toast('Immagine eliminata')
      onClose()
    } catch (error) {
      toast((error as Error).message, 'error')
    }
  }

  const row = 'flex justify-between gap-3 py-1'

  return (
    <aside className="w-[300px] shrink-0 overflow-y-auto border-l border-line bg-panel">
      <div className="bg-panel2 p-4">
        <img src={thumb(asset.url, 640)} alt={asset.alt} className="mx-auto max-h-64 rounded-md object-contain" />
      </div>
      <div className="space-y-4 p-4">
        <div>
          <div className="truncate text-[14px] font-semibold" title={asset.filename}>
            {asset.filename}
          </div>
          <div className="mt-2 text-[13px]">
            {asset.width && (
              <div className={row}>
                <span className="text-fg2">Dimensioni</span>
                <span className="tabular-nums">
                  {asset.width} × {asset.height}
                </span>
              </div>
            )}
            <div className={row}>
              <span className="text-fg2">Peso</span>
              <span>{formatSize(asset.size)}</span>
            </div>
            <div className={row}>
              <span className="text-fg2">Caricata</span>
              <span title={fullDate(asset.createdAt)}>{relativeTime(asset.createdAt)}</span>
            </div>
            <div className={row}>
              <span className="text-fg2">Usata in</span>
              <span>
                {usage === undefined ? (
                  <Spinner className="size-3" />
                ) : usage === 1 ? (
                  '1 documento'
                ) : (
                  `${usage} documenti`
                )}
              </span>
            </div>
          </div>
        </div>
        <label className="block">
          <span className="mb-1.5 flex items-center gap-1.5 text-[13px] font-medium text-fg2">
            Testo alternativo
            {saved && <Check className="size-3.5 text-ok" />}
            {asset.mime.startsWith('image/') && (
              <span className="ml-auto">
                <AiButton
                  action="alt"
                  src={asset.url}
                  label="Descrivi con l’AI"
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
            placeholder="Descrivi l’immagine a chi non può vederla"
          />
          <span className="mt-1 block text-[13px] text-fg3">Proposto quando scegli l’immagine in un documento.</span>
        </label>
        <div className="flex gap-1.5">
          <Button size="sm" icon={<Copy className="size-3.5" />} onClick={() => void copyUrl(asset)}>
            Copia indirizzo
          </Button>
          <div className="flex-1" />
          {user.role === 'admin' && (
            <IconButton label="Elimina" onClick={() => setConfirm(true)} className="hover:text-danger">
              <Trash2 />
            </IconButton>
          )}
        </div>
      </div>
      <Dialog
        open={confirm}
        onClose={() => setConfirm(false)}
        title="Eliminare l’immagine?"
        footer={
          <>
            <Button onClick={() => setConfirm(false)} data-autofocus>
              Annulla
            </Button>
            <Button variant="danger" onClick={remove}>
              Elimina
            </Button>
          </>
        }
      >
        {usage
          ? `È usata in ${usage === 1 ? 'un documento' : `${usage} documenti`}: lì l’immagine non si vedrà più. Il file verrà eliminato definitivamente.`
          : 'Non è usata in nessun documento. Il file verrà eliminato definitivamente.'}
      </Dialog>
    </aside>
  )
}
