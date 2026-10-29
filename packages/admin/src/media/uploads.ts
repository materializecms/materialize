import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useState } from 'react'
import { toast } from '../components/ui.tsx'
import { api, type MediaAsset } from '../lib/api.ts'

export interface Upload {
  id: string
  name: string
  progress: number
  /** Local preview while the file travels. */
  preview: string
  error?: string
}

export const ACCEPT = 'image/jpeg,image/png,image/webp,image/avif,image/gif,.glb,model/gltf-binary'

/** Uploads files three at a time, with progress, and refreshes the library when they land. */
export function useUploads(onDone?: (asset: MediaAsset) => void) {
  const queryClient = useQueryClient()
  const [uploads, setUploads] = useState<Upload[]>([])

  const start = useCallback(
    async (files: File[]) => {
      const images = files.filter((f) => f.type.startsWith('image/'))
      if (images.length < files.length) toast('Alcuni file non sono immagini e sono stati ignorati', 'error')
      const items = images.map((file) => ({
        file,
        upload: { id: crypto.randomUUID(), name: file.name, progress: 0, preview: URL.createObjectURL(file) },
      }))
      setUploads((u) => [...items.map((i) => i.upload), ...u])
      const patch = (id: string, change: Partial<Upload>) =>
        setUploads((u) => u.map((x) => (x.id === id ? { ...x, ...change } : x)))

      let next = 0
      const worker = async () => {
        while (next < items.length) {
          const item = items[next++]
          if (!item) break
          try {
            const asset = await api.upload(item.file, (p) => patch(item.upload.id, { progress: p }))
            onDone?.(asset)
            setUploads((u) => u.filter((x) => x.id !== item.upload.id))
            URL.revokeObjectURL(item.upload.preview)
          } catch (error) {
            patch(item.upload.id, { error: (error as Error).message })
          }
        }
      }
      await Promise.all([worker(), worker(), worker()])
      queryClient.invalidateQueries({ queryKey: ['media'] })
    },
    [onDone, queryClient],
  )

  const dismiss = (id: string) => setUploads((u) => u.filter((x) => x.id !== id))

  return { uploads, start, dismiss }
}

export function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  return `${(bytes / 1024 / 1024).toFixed(1).replace('.', ',')} MB`
}
