import type { Media } from '@materialize/core'
import { ImageOff, Images, Link2, Loader2, Trash2, Upload } from 'lucide-react'
import { type PointerEvent, useRef, useState } from 'react'
import { Button, cx, IconButton, Input, toast } from '../components/ui.tsx'
import { api, type MediaAsset, thumb } from '../lib/api.ts'
import { DropZone } from '../media/MediaGrid.tsx'
import { MediaPicker } from '../media/MediaPicker.tsx'
import { ACCEPT } from '../media/uploads.ts'

const fromAsset = (asset: MediaAsset, alt?: string): Media => ({
  src: asset.url,
  alt: alt || asset.alt,
  ...(asset.width ? { width: asset.width } : {}),
  ...(asset.height ? { height: asset.height } : {}),
})

/**
 * An image from the media library (upload, pick or drop a file on the field), with alt text
 * and a focal point: click the preview to choose what must stay visible whatever the crop.
 */
export function MediaInput({
  value,
  onChange,
  focalPoint,
  invalid,
}: {
  value: Media | undefined
  onChange: (value: Media | undefined, group?: string) => void
  focalPoint: boolean
  invalid?: boolean
}) {
  const [broken, setBroken] = useState(false)
  const [picking, setPicking] = useState(false)
  const [progress, setProgress] = useState<number | null>(null)
  const [byUrl, setByUrl] = useState(false)
  const file = useRef<HTMLInputElement>(null)
  // Dimensions are read only for an image the editor just chose: opening a document must not change it.
  const chosen = useRef<string | null>(null)
  const v = value ?? { src: '', alt: '' }
  const focal = v.focal ?? { x: 50, y: 50 }
  const external = !!v.src && !v.src.startsWith('/media/')

  const upload = async (files: File[]) => {
    const image = files.find((f) => f.type.startsWith('image/'))
    if (!image) return
    setProgress(0)
    try {
      const asset = await api.upload(image, setProgress)
      setBroken(false)
      onChange(fromAsset(asset, v.alt))
    } catch (error) {
      toast((error as Error).message, 'error')
    } finally {
      setProgress(null)
    }
  }

  const pick = (e: PointerEvent<HTMLDivElement>) => {
    if (!focalPoint || !v.src) return
    const r = e.currentTarget.getBoundingClientRect()
    const x = Math.round(((e.clientX - r.left) / r.width) * 100)
    const y = Math.round(((e.clientY - r.top) / r.height) * 100)
    onChange({ ...v, focal: { x: Math.min(100, Math.max(0, x)), y: Math.min(100, Math.max(0, y)) } })
  }

  return (
    <DropZone
      onFiles={upload}
      className={cx('overflow-hidden rounded-md border bg-input', invalid ? 'border-danger' : 'border-line2')}
    >
      {v.src && !broken ? (
        <div
          role="presentation"
          className={cx('relative aspect-[16/9] bg-panel2', focalPoint && 'cursor-crosshair')}
          onPointerDown={pick}
          title={focalPoint ? 'Clicca per scegliere il punto focale' : undefined}
        >
          <img
            src={thumb(v.src)}
            alt={v.alt}
            className="size-full object-cover"
            style={{ objectPosition: `${focal.x}% ${focal.y}%` }}
            draggable={false}
            onError={() => setBroken(true)}
            onLoad={(e) => {
              if (chosen.current !== v.src) return
              chosen.current = null
              const { naturalWidth: width, naturalHeight: height } = e.currentTarget
              if (width && (v.width !== width || v.height !== height)) onChange({ ...v, width, height })
            }}
          />
          {focalPoint && (
            <span
              className="pointer-events-none absolute size-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,.35),0_2px_6px_rgba(0,0,0,.35)]"
              style={{ left: `${focal.x}%`, top: `${focal.y}%` }}
            />
          )}
          <div
            className="absolute top-2 right-2 flex gap-1"
            role="presentation"
            onPointerDown={(e) => e.stopPropagation()}
          >
            <IconButton
              label="Cambia immagine"
              className="bg-black/50 text-white backdrop-blur hover:bg-black/70 hover:text-white"
              onClick={() => setPicking(true)}
            >
              <Images />
            </IconButton>
            <IconButton
              label="Rimuovi immagine"
              className="bg-black/50 text-white backdrop-blur hover:bg-black/70 hover:text-white"
              onClick={() => onChange(undefined)}
            >
              <Trash2 />
            </IconButton>
          </div>
        </div>
      ) : (
        <div className="flex aspect-[16/7] flex-col items-center justify-center gap-3 bg-panel2 px-4 text-center">
          {progress !== null ? (
            <div className="w-40">
              <Loader2 className="mx-auto mb-2 size-5 animate-spin text-fg3" />
              <div className="h-1 overflow-hidden rounded-full bg-line2">
                <div className="h-full bg-accent transition-[width]" style={{ width: `${progress * 100}%` }} />
              </div>
            </div>
          ) : (
            <>
              {broken && (
                <span className="flex items-center gap-1.5 text-[12px] text-warn">
                  <ImageOff className="size-4" /> Immagine non raggiungibile
                </span>
              )}
              <div className="flex gap-2">
                <Button size="sm" icon={<Upload className="size-3.5" />} onClick={() => file.current?.click()}>
                  Carica
                </Button>
                <Button size="sm" icon={<Images className="size-3.5" />} onClick={() => setPicking(true)}>
                  Libreria
                </Button>
              </div>
              <span className="text-[11.5px] text-fg3">oppure trascina qui un’immagine</span>
            </>
          )}
        </div>
      )}
      <div className="grid gap-1.5 border-t border-line p-2">
        {(byUrl || external) && (
          <Input
            placeholder="https://…/foto.jpg"
            className="font-mono text-[12px]"
            value={v.src}
            autoFocus={byUrl && !v.src}
            onChange={(e) => {
              setBroken(false)
              const src = e.target.value.trim()
              chosen.current = src
              onChange(src ? { src, alt: v.alt } : undefined, 'src')
            }}
          />
        )}
        <div className="flex items-center gap-1.5">
          <Input
            placeholder="Testo alternativo: descrivi l’immagine"
            value={v.alt}
            disabled={!v.src}
            onChange={(e) => onChange({ ...v, alt: e.target.value }, 'alt')}
          />
          {!byUrl && !external && (
            <IconButton label="Usa un indirizzo web" className="size-8" onClick={() => setByUrl(true)}>
              <Link2 />
            </IconButton>
          )}
        </div>
      </div>
      <input
        ref={file}
        type="file"
        accept={ACCEPT}
        hidden
        onChange={(e) => {
          void upload([...(e.target.files ?? [])])
          e.target.value = ''
        }}
      />
      {picking && (
        <MediaPicker
          open
          onClose={() => setPicking(false)}
          onPick={(asset) => {
            setBroken(false)
            onChange(fromAsset(asset, v.alt))
          }}
        />
      )}
    </DropZone>
  )
}
