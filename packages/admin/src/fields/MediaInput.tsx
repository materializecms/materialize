import type { Media } from '@materialize/core'
import { ImageOff, ImagePlus, Trash2 } from 'lucide-react'
import { type PointerEvent, useRef, useState } from 'react'
import { cx, IconButton, Input } from '../components/ui.tsx'

/**
 * Image by URL with alt text and a focal point (click the preview to set it).
 * Uploads arrive with the media library; until then any public image URL works.
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
  // Dimensions are read only for an image the editor just chose: opening a document must not change it.
  const chosen = useRef<string | null>(null)
  const v = value ?? { src: '', alt: '' }
  const focal = v.focal ?? { x: 50, y: 50 }

  const pick = (e: PointerEvent<HTMLDivElement>) => {
    if (!focalPoint || !v.src) return
    const r = e.currentTarget.getBoundingClientRect()
    const x = Math.round(((e.clientX - r.left) / r.width) * 100)
    const y = Math.round(((e.clientY - r.top) / r.height) * 100)
    onChange({ ...v, focal: { x: Math.min(100, Math.max(0, x)), y: Math.min(100, Math.max(0, y)) } })
  }

  return (
    <div className={cx('overflow-hidden rounded-md border bg-input', invalid ? 'border-danger' : 'border-line2')}>
      {v.src && !broken ? (
        <div
          role="presentation"
          className={cx('relative aspect-[16/9] bg-panel2', focalPoint && 'cursor-crosshair')}
          onPointerDown={pick}
          title={focalPoint ? 'Clicca per scegliere il punto focale' : undefined}
        >
          <img
            src={v.src}
            alt={v.alt}
            className="size-full object-cover"
            style={{ objectPosition: `${focal.x}% ${focal.y}%` }}
            draggable={false}
            onError={() => setBroken(true)}
            onLoad={(e) => {
              const { naturalWidth: width, naturalHeight: height } = e.currentTarget
              if (chosen.current !== v.src) return
              chosen.current = null
              if (width && (v.width !== width || v.height !== height)) onChange({ ...v, width, height })
            }}
          />
          {focalPoint && (
            <span
              className="pointer-events-none absolute size-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,.35),0_2px_6px_rgba(0,0,0,.35)]"
              style={{ left: `${focal.x}%`, top: `${focal.y}%` }}
            />
          )}
          <IconButton
            label="Rimuovi immagine"
            className="absolute top-2 right-2 bg-black/50 text-white backdrop-blur hover:bg-black/70 hover:text-white"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => onChange(undefined)}
          >
            <Trash2 />
          </IconButton>
        </div>
      ) : (
        <div className="flex aspect-[16/6] flex-col items-center justify-center gap-1 bg-panel2 text-fg3">
          {broken ? <ImageOff className="size-5" /> : <ImagePlus className="size-5" />}
          <span className="text-[12px]">
            {broken ? 'Immagine non raggiungibile' : 'Incolla l’indirizzo di un’immagine'}
          </span>
        </div>
      )}
      <div className="grid gap-1.5 border-t border-line p-2">
        <Input
          placeholder="https://…/foto.jpg"
          className="font-mono text-[12px]"
          value={v.src}
          onChange={(e) => {
            setBroken(false)
            const src = e.target.value.trim()
            chosen.current = src
            onChange(src ? { src, alt: v.alt } : undefined, 'src')
          }}
        />
        <Input
          placeholder="Testo alternativo: descrivi l’immagine"
          value={v.alt}
          disabled={!v.src}
          onChange={(e) => onChange({ ...v, alt: e.target.value }, 'alt')}
        />
      </div>
    </div>
  )
}
