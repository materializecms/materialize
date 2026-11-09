import { type Breakpoint, librarySrcset, renderPage } from '@materializecms/core/page'
import { EMBED_FRAME } from '../lib/frames.ts'
import { t } from '../lib/i18n.ts'

type RenderInput = Parameters<typeof renderPage>
export type ExportFormat = 'pdf' | 'png'

export const DEVICE_LABEL: Record<Breakpoint, string> = { desktop: 'Desktop', tablet: 'Tablet', mobile: 'Mobile' }

export interface Shot {
  device: Breakpoint
  width: number
  /** The page at that width, drawn at `scale` pixels per CSS pixel. */
  canvas: HTMLCanvasElement
  scale: number
}

// Safari refuses canvases above about 16.7 million pixels; a long page at 2× gets there quickly.
const MAX_PIXELS = 16_000_000

/**
 * Draws the page at one width, off screen, the way the "all devices" view shows it: no motion,
 * custom code kept in its frame, every image loaded (none waits to scroll into view).
 */
async function capture(
  nodes: RenderInput[0],
  theme: RenderInput[1],
  options: RenderInput[2],
  width: number,
): Promise<{ canvas: HTMLCanvasElement; scale: number }> {
  const { html, css } = renderPage(nodes, theme, {
    ...options,
    editor: true,
    animations: 'none',
    srcset: librarySrcset,
    frame: EMBED_FRAME,
  })
  const host = document.createElement('div')
  host.setAttribute('aria-hidden', 'true')
  // Off screen but laid out: the copy measures what the browser really draws.
  host.style.cssText = `position:fixed;left:-${width + 1000}px;top:0;width:${width}px;pointer-events:none`
  host.innerHTML = `<style>${css}</style>${html.replaceAll('loading="lazy"', 'loading="eager"')}`
  document.body.append(host)
  try {
    await document.fonts.ready
    await Promise.all([...host.querySelectorAll('img')].map((img) => img.decode().catch(() => undefined)))
    const page = (host.querySelector('.mz-page') as HTMLElement | null) ?? host
    const height = Math.ceil(page.scrollHeight)
    const scale = Math.max(0.5, Math.min(2, Math.sqrt(MAX_PIXELS / (width * height))))
    const { domToCanvas } = await import('modern-screenshot')
    const canvas = await domToCanvas(page, {
      width,
      height,
      scale,
      backgroundColor: getComputedStyle(page).backgroundColor,
    })
    return { canvas, scale }
  } finally {
    host.remove()
  }
}

/** Every chosen device, one after the other (each one needs the whole page laid out). */
export async function captureDevices(
  nodes: RenderInput[0],
  theme: RenderInput[1],
  options: RenderInput[2],
  devices: { device: Breakpoint; width: number }[],
  onStep: (device: Breakpoint) => void,
): Promise<Shot[]> {
  const shots: Shot[] = []
  for (const { device, width } of devices) {
    onStep(device)
    const { canvas, scale } = await capture(nodes, theme, options, width)
    shots.push({ device, width, canvas, scale })
  }
  return shots
}

export function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

export function pngOf(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error(t('Immagine troppo grande')))), 'image/png'),
  )
}

/** "Chi siamo" → "chi-siamo", for file names. */
export function fileSlug(text: string): string {
  return (
    text
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'pagina'
  )
}

// ---------- PDF ----------

/** Text for a PDF string in Helvetica (WinAnsi): accented Italian letters are Latin-1. */
function pdfText(text: string): string {
  const safe = text.replace(/[–—]/g, '-').replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/…/g, '...')
  return [...safe]
    .map((ch) => {
      const code = ch.charCodeAt(0)
      if (ch === '(' || ch === ')' || ch === '\\') return `\\${ch}`
      if (code >= 32 && code < 127) return ch
      if (code >= 160 && code < 256) return `\\${code.toString(8).padStart(3, '0')}`
      return '?'
    })
    .join('')
}

async function jpegBytes(canvas: HTMLCanvasElement): Promise<Uint8Array> {
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error(t('Immagine troppo grande')))), 'image/jpeg', 0.9),
  )
  return new Uint8Array(await blob.arrayBuffer())
}

const CAPTION = 30 // points above each image, for the heading
const PT = 0.75 // a CSS pixel is 0.75 points (96 → 72 per inch)
const MAX_PT = 14_400 // the largest page most PDF readers open (200 inches)

/**
 * One PDF, one page per device, each as long as the web page: nothing cut between sheets. The
 * images go in as JPEG (the format PDF reads as it is); the heading is in Helvetica, which every
 * reader has, so no font is embedded.
 */
export async function pdfOf(shots: Shot[], title: string, caption: (shot: Shot) => string): Promise<Blob> {
  const enc = new TextEncoder()
  const parts: Uint8Array[] = []
  const offsets: number[] = []
  let length = 0
  const push = (chunk: string | Uint8Array) => {
    const bytes = typeof chunk === 'string' ? enc.encode(chunk) : chunk
    parts.push(bytes)
    length += bytes.length
  }
  // Objects: 1 catalog, 2 pages, 3 font, 4 info, then per page: page, image, contents.
  const object = (id: number, body: string | Uint8Array[], dict?: string) => {
    offsets[id] = length
    if (typeof body === 'string') return push(`${id} 0 obj\n${body}\nendobj\n`)
    push(`${id} 0 obj\n${dict}\nstream\n`)
    for (const b of body) push(b)
    push('\nendstream\nendobj\n')
  }
  const pageIds = shots.map((_, i) => 5 + i * 3)

  push('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n')
  object(1, '<< /Type /Catalog /Pages 2 0 R >>')
  object(2, `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${shots.length} >>`)
  object(3, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>')
  object(4, `<< /Title (${pdfText(title)}) /Producer (Materialize) >>`)

  for (const [i, shot] of shots.entries()) {
    const [pageId, imageId, contentId] = [pageIds[i] as number, (pageIds[i] as number) + 1, (pageIds[i] as number) + 2]
    const cssHeight = shot.canvas.height / shot.scale
    // Very long pages shrink to fit the largest page size; the image keeps all its pixels.
    const fit = Math.min(1, (MAX_PT - CAPTION) / (cssHeight * PT))
    const w = shot.width * PT * fit
    const h = cssHeight * PT * fit
    const pageH = h + CAPTION
    const jpeg = await jpegBytes(shot.canvas)
    const text = `BT /F1 9 Tf 0.45 0.45 0.48 rg 12 ${(pageH - 19).toFixed(2)} Td (${pdfText(caption(shot))}) Tj ET`
    const draw = `q 0.97 0.97 0.97 rg 0 ${h.toFixed(2)} ${w.toFixed(2)} ${CAPTION} re f Q ${text} q ${w.toFixed(2)} 0 0 ${h.toFixed(2)} 0 0 cm /Im0 Do Q`
    object(
      pageId,
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${w.toFixed(2)} ${pageH.toFixed(2)}] /Resources << /Font << /F1 3 0 R >> /XObject << /Im0 ${imageId} 0 R >> >> /Contents ${contentId} 0 R >>`,
    )
    object(
      imageId,
      [jpeg],
      `<< /Type /XObject /Subtype /Image /Width ${shot.canvas.width} /Height ${shot.canvas.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>`,
    )
    object(contentId, [enc.encode(draw)], `<< /Length ${enc.encode(draw).length} >>`)
  }

  const size = 5 + shots.length * 3
  const xref = length
  push(`xref\n0 ${size}\n0000000000 65535 f \n`)
  for (let id = 1; id < size; id++) push(`${String(offsets[id]).padStart(10, '0')} 00000 n \n`)
  push(`trailer\n<< /Size ${size} /Root 1 0 R /Info 4 0 R >>\nstartxref\n${xref}\n%%EOF\n`)
  return new Blob(parts as BlobPart[], { type: 'application/pdf' })
}
