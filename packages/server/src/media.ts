import { randomBytes } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { mkdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { Readable } from 'node:stream'
import { slugify } from '@materializecms/core'
import type { MediaAsset } from '@materializecms/db'
import sharp, { type Metadata } from 'sharp'

/** Formats people can upload, by what the file really is (not by its name). */
const FORMATS = { jpeg: 'jpg', png: 'png', webp: 'webp', gif: 'gif', heif: 'avif' } as const
type SourceFormat = keyof typeof FORMATS

export const MAX_UPLOAD = 25 * 1024 * 1024
/** Widths served to the site; requests snap to the nearest one so the cache stays small. */
export const WIDTHS = [320, 640, 960, 1280, 1600, 1920, 2560]
export const OUTPUTS = { avif: 'image/avif', webp: 'image/webp', jpg: 'image/jpeg', png: 'image/png' } as const
export type Output = keyof typeof OUTPUTS

const KEY = /^[a-z0-9]+(?:-[a-z0-9]+)*\.(jpg|png|webp|gif|avif|glb)$/
const TYPES: Record<string, string> = {
  jpg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
  avif: 'image/avif',
  glb: 'model/gltf-binary',
}

/** A binary glTF 2 file: "glTF", version 2, then its declared length. */
const isGlb = (b: Buffer) => b.length > 20 && b.toString('latin1', 0, 4) === 'glTF' && b.readUInt32LE(4) === 2

export class MediaError extends Error {}

export const isMediaKey = (key: string) => KEY.test(key)
export const mediaUrl = (asset: Pick<MediaAsset, 'key'>) => `/media/${asset.key}`

/** Files on disk: originals in `dir`, resized versions in `dir/.cache/<key>/`. */
export function createMediaFiles(dir: string) {
  const root = resolve(dir)
  const pending = new Map<string, Promise<string>>()

  return {
    /**
     * Checks and stores an upload. Photos are turned upright and lose their metadata
     * (camera details, GPS position), so publishing a picture never publishes where it was taken.
     */
    async save(name: string, input: Buffer) {
      // 3D models for WebGL scenes, kept as they are.
      if (isGlb(input)) {
        const base = slugify(name.replace(/\.[^.]+$/, ''), 48) || 'modello'
        const key = `${base}-${randomBytes(4).toString('hex')}.glb`
        await mkdir(root, { recursive: true })
        await writeFile(join(root, key), input)
        return { key, mime: TYPES.glb as string, size: input.length, width: null, height: null }
      }
      let meta: Metadata
      try {
        meta = await sharp(input, { animated: true }).metadata()
      } catch {
        throw new MediaError('Il file non è un’immagine leggibile né un modello 3D (.glb)')
      }
      const format = meta.format as SourceFormat
      if (!(format in FORMATS)) throw new MediaError('Formato non supportato: usa JPG, PNG, WebP, AVIF o GIF')
      const ext = FORMATS[format]
      let output = input
      let width = meta.width
      let height = meta.autoOrient?.height ?? meta.height
      if (format === 'jpeg' || format === 'png' || format === 'webp') {
        const { data, info } = await sharp(input)
          .rotate()
          .toFormat(format, format === 'png' ? { compressionLevel: 9 } : { quality: 90 })
          .toBuffer({ resolveWithObject: true })
        output = data
        width = info.width
        height = info.height
      }
      const base = slugify(name.replace(/\.[^.]+$/, ''), 48) || 'immagine'
      const key = `${base}-${randomBytes(4).toString('hex')}.${ext}`
      await mkdir(root, { recursive: true })
      await writeFile(join(root, key), output)
      return { key, mime: TYPES[ext] as string, size: output.length, width: width ?? null, height: height ?? null }
    },

    async remove(key: string) {
      if (!isMediaKey(key)) return
      await rm(join(root, key), { force: true })
      await rm(join(root, '.cache', key), { recursive: true, force: true })
    },

    /** The original file, or a resized copy made on first request and kept for next time. */
    async open(key: string, variant?: { width: number; format: Output }) {
      if (!isMediaKey(key)) return null
      const original = join(root, key)
      if (!(await stat(original).catch(() => null))?.isFile()) return null
      if (!variant || key.endsWith('.gif') || key.endsWith('.glb')) {
        return { path: original, type: TYPES[key.split('.').pop() as string] as string }
      }
      const width = WIDTHS.find((w) => w >= variant.width) ?? (WIDTHS[WIDTHS.length - 1] as number)
      const path = join(root, '.cache', key, `${width}.${variant.format}`)
      if (!(await stat(path).catch(() => null))) {
        let job = pending.get(path)
        if (!job) {
          job = render(original, path, width, variant.format).finally(() => pending.delete(path))
          pending.set(path, job)
        }
        await job
      }
      return { path, type: OUTPUTS[variant.format] }
    },
  }
}

async function render(source: string, target: string, width: number, format: Output): Promise<string> {
  await mkdir(join(target, '..'), { recursive: true })
  const image = sharp(await readFile(source))
    .rotate()
    .resize({ width, withoutEnlargement: true })
  const encoded =
    format === 'avif'
      ? image.avif({ quality: 55, effort: 4 })
      : format === 'webp'
        ? image.webp({ quality: 78 })
        : format === 'png'
          ? image.png({ compressionLevel: 9 })
          : image.jpeg({ quality: 80, mozjpeg: true })
  // Written aside and renamed, so a half-written file is never served.
  const tmp = `${target}.${randomBytes(4).toString('hex')}.tmp`
  await writeFile(tmp, await encoded.toBuffer())
  await rename(tmp, target)
  return target
}

export function fileBody(path: string): ReadableStream {
  return Readable.toWeb(createReadStream(path)) as ReadableStream
}

export type MediaFiles = ReturnType<typeof createMediaFiles>
