import { useInfiniteQuery } from '@tanstack/react-query'
import { CircleAlert, ImageUp, X } from 'lucide-react'
import { type DragEvent, type ReactNode, useState } from 'react'
import { Button, cx, EmptyState, Spinner } from '../components/ui.tsx'
import { api, type MediaAsset, thumb } from '../lib/api.ts'
import type { Upload } from './uploads.ts'

const PAGE = 60

export function useMediaList(search: string) {
  return useInfiniteQuery({
    queryKey: ['media', search],
    queryFn: ({ pageParam }) => api.media({ search, limit: PAGE, offset: pageParam }),
    initialPageParam: 0,
    getNextPageParam: (last, pages) => {
      const loaded = pages.reduce((n, p) => n + p.items.length, 0)
      return loaded < last.total ? loaded : undefined
    },
  })
}

/** Accepts files dropped anywhere inside it, with a clear highlight while dragging. */
export function DropZone({
  onFiles,
  children,
  className,
}: {
  onFiles: (files: File[]) => void
  children: ReactNode
  className?: string
}) {
  const [over, setOver] = useState(false)
  const hasFiles = (e: DragEvent) => e.dataTransfer.types.includes('Files')
  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: drop target; the upload button is the keyboard path
    <div
      className={cx('relative', className)}
      onDragOver={(e) => {
        if (!hasFiles(e)) return
        // The innermost zone wins: a picker opened from an image field must not upload twice.
        e.preventDefault()
        e.stopPropagation()
        setOver(true)
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) setOver(false)
      }}
      onDrop={(e) => {
        if (!hasFiles(e)) return
        e.preventDefault()
        e.stopPropagation()
        setOver(false)
        onFiles([...e.dataTransfer.files])
      }}
    >
      {children}
      {over && (
        <div className="pointer-events-none absolute inset-2 z-20 flex items-center justify-center rounded-xl border-2 border-dashed border-accent bg-accent/8 backdrop-blur-[1px]">
          <span className="flex items-center gap-2 rounded-full bg-panel px-4 py-2 text-[13px] font-medium text-accent shadow-pop">
            <ImageUp className="size-4" /> Rilascia per caricare
          </span>
        </div>
      )}
    </div>
  )
}

export function MediaGrid({
  search,
  uploads,
  selected,
  onSelect,
  onOpen,
  onDismiss,
  onUploadClick,
}: {
  search: string
  uploads: Upload[]
  selected?: string | null
  onSelect: (asset: MediaAsset) => void
  /** Double click: pick right away. */
  onOpen?: (asset: MediaAsset) => void
  onDismiss: (id: string) => void
  onUploadClick: () => void
}) {
  const list = useMediaList(search)
  const items = list.data?.pages.flatMap((p) => p.items) ?? []

  if (list.isPending) {
    return (
      <div className="flex justify-center py-20">
        <Spinner />
      </div>
    )
  }
  if (!items.length && !uploads.length) {
    return search ? (
      <EmptyState icon={<ImageUp />} title="Nessun risultato">
        Nessuna immagine corrisponde a “{search}”.
      </EmptyState>
    ) : (
      <EmptyState icon={<ImageUp />} title="La libreria è vuota">
        Trascina qui le immagini oppure sceglile dal computer.
        <div className="mt-3">
          <Button variant="primary" size="sm" onClick={onUploadClick}>
            Scegli dal computer
          </Button>
        </div>
      </EmptyState>
    )
  }

  return (
    <div className="p-4">
      <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-3">
        {uploads.map((u) => (
          <figure key={u.id} className="relative overflow-hidden rounded-lg border border-line bg-panel2">
            <img src={u.preview} alt="" className="aspect-square w-full object-cover opacity-50" />
            <figcaption className="absolute inset-x-2 bottom-2">
              {u.error ? (
                <span className="flex items-start gap-1 rounded-md bg-panel/95 p-1.5 text-[11px] leading-snug text-danger">
                  <CircleAlert className="mt-px size-3.5 shrink-0" />
                  <span className="flex-1">{u.error}</span>
                  <button type="button" aria-label="Chiudi" onClick={() => onDismiss(u.id)}>
                    <X className="size-3.5" />
                  </button>
                </span>
              ) : (
                <span className="block h-1 overflow-hidden rounded-full bg-black/20">
                  <span
                    className="block h-full bg-accent transition-[width]"
                    style={{ width: `${u.progress * 100}%` }}
                  />
                </span>
              )}
            </figcaption>
          </figure>
        ))}
        {items.map((asset) => (
          <button
            key={asset.id}
            type="button"
            onClick={() => onSelect(asset)}
            onDoubleClick={() => onOpen?.(asset)}
            className={cx(
              'group overflow-hidden rounded-lg border bg-panel2 text-left transition-shadow',
              selected === asset.id ? 'border-accent ring-3 ring-accent/25' : 'border-line hover:border-line2',
            )}
          >
            <img
              src={thumb(asset.url, 320)}
              alt={asset.alt}
              loading="lazy"
              className="aspect-square w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
            />
            <span className="block truncate border-t border-line bg-panel px-2 py-1.5 text-[11.5px] text-fg2">
              {asset.filename}
            </span>
          </button>
        ))}
      </div>
      {list.hasNextPage && (
        <div className="flex justify-center pt-4">
          <Button size="sm" onClick={() => list.fetchNextPage()} loading={list.isFetchingNextPage}>
            Mostra altre
          </Button>
        </div>
      )}
    </div>
  )
}
