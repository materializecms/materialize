import { Search, Upload as UploadIcon } from 'lucide-react'
import { useCallback, useState } from 'react'
import { Button, Dialog, Input } from '../components/ui.tsx'
import type { MediaAsset } from '../lib/api.ts'
import { DropZone, MediaGrid } from './MediaGrid.tsx'
import { useDebounced, useFilePicker } from './MediaLibrary.tsx'
import { useUploads } from './uploads.ts'

/** Chooses an image from the library, or uploads one on the spot. */
export function MediaPicker({
  open,
  onClose,
  onPick,
}: {
  open: boolean
  onClose: () => void
  onPick: (asset: MediaAsset) => void
}) {
  const [search, setSearch] = useState('')
  const debounced = useDebounced(search)
  const [selected, setSelected] = useState<MediaAsset | null>(null)
  // A file uploaded from here is what the editor wanted: select it.
  const { uploads, start, dismiss } = useUploads(useCallback((asset: MediaAsset) => setSelected(asset), []))
  const picker = useFilePicker(start)

  const pick = (asset: MediaAsset | null) => {
    if (!asset) return
    onPick(asset)
    onClose()
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      width={880}
      title={
        <div className="flex items-center gap-3">
          <span className="flex-1">Scegli un’immagine</span>
          <div className="relative w-56">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-fg3" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cerca"
              className="pl-8 text-[13px] font-normal"
              aria-label="Cerca"
            />
          </div>
          <Button size="md" icon={<UploadIcon className="size-4" />} onClick={picker.open}>
            Carica
          </Button>
          {picker.element}
        </div>
      }
      footer={
        <>
          <span className="mr-auto self-center truncate text-[12px] text-fg3">
            {selected ? selected.filename : 'Trascina qui le immagini per caricarle'}
          </span>
          <Button onClick={onClose}>Annulla</Button>
          <Button variant="primary" disabled={!selected} onClick={() => pick(selected)}>
            Usa questo file
          </Button>
        </>
      }
    >
      <DropZone onFiles={start} className="-mx-5 -mb-4 h-[56vh] overflow-y-auto border-t border-line">
        <MediaGrid
          search={debounced}
          uploads={uploads}
          selected={selected?.id}
          onSelect={setSelected}
          onOpen={pick}
          onDismiss={dismiss}
          onUploadClick={picker.open}
        />
      </DropZone>
    </Dialog>
  )
}
