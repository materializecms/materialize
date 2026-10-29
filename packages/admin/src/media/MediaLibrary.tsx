import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, Copy, Images, Search, Trash2, Upload as UploadIcon } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useSession } from '../app/context.ts'
import { Button, Dialog, IconButton, Input, Spinner, Textarea, toast } from '../components/ui.tsx'
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

export function MediaLibrary() {
  const [search, setSearch] = useState('')
  const debounced = useDebounced(search)
  const [selected, setSelected] = useState<MediaAsset | null>(null)
  const { uploads, start, dismiss } = useUploads()
  const picker = useFilePicker(start)

  return (
    <div className="flex min-h-0 flex-1">
      <div className="flex min-w-0 flex-1 flex-col">
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
          {picker.element}
        </header>
        <DropZone onFiles={start} className="min-h-0 flex-1 overflow-y-auto">
          <MediaGrid
            search={debounced}
            uploads={uploads}
            selected={selected?.id}
            onSelect={setSelected}
            onDismiss={dismiss}
            onUploadClick={picker.open}
          />
        </DropZone>
      </div>
      {selected && <MediaDetails key={selected.id} asset={selected} onClose={() => setSelected(null)} />}
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

  const saveAlt = async () => {
    if (alt === (detail.data?.alt ?? asset.alt)) return
    try {
      await api.updateMedia(asset.id, { alt })
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

  const absolute = new URL(asset.url, location.origin).toString()
  const row = 'flex justify-between gap-3 py-1'

  return (
    <aside className="w-[300px] shrink-0 overflow-y-auto border-l border-line bg-panel">
      <div className="bg-panel2 p-4">
        <img src={thumb(asset.url, 640)} alt={asset.alt} className="mx-auto max-h-64 rounded-md object-contain" />
      </div>
      <div className="space-y-4 p-4">
        <div>
          <div className="truncate text-[13px] font-semibold" title={asset.filename}>
            {asset.filename}
          </div>
          <div className="mt-2 text-[12.5px]">
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
          <span className="mb-1.5 flex items-center gap-1.5 text-[12px] font-medium text-fg2">
            Testo alternativo
            {saved && <Check className="size-3.5 text-ok" />}
          </span>
          <Textarea
            value={alt}
            onChange={(e) => setAlt(e.target.value)}
            onBlur={saveAlt}
            placeholder="Descrivi l’immagine a chi non può vederla"
          />
          <span className="mt-1 block text-[12px] text-fg3">Proposto quando scegli l’immagine in un documento.</span>
        </label>
        <div className="flex gap-1.5">
          <Button
            size="sm"
            icon={<Copy className="size-3.5" />}
            onClick={() => navigator.clipboard?.writeText(absolute).then(() => toast('Indirizzo copiato'))}
          >
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
