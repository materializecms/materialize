/**
 * The panel runs under a strict security policy, which frames written with srcdoc would inherit:
 * custom code and the site preview load an empty page from the server instead (it has no policy
 * of its own), then get their HTML from here.
 */
export const EMBED_FRAME = '/admin/frame.html'

/**
 * Custom code previews: once the empty page has loaded, the code goes into a sandboxed frame
 * inside it (scripts run, but cannot reach the panel).
 */
export function fillEmbedFrames(): void {
  document.addEventListener(
    'load',
    (e) => {
      const frame = e.target
      if (!(frame instanceof HTMLIFrameElement) || frame.dataset.mzEmbed === undefined) return
      const doc = frame.contentDocument
      if (!doc?.documentElement.hasAttribute('data-mz-blank')) return
      const inner = doc.createElement('iframe')
      inner.setAttribute('sandbox', 'allow-scripts')
      inner.title = frame.title
      inner.srcdoc = frame.dataset.mzEmbed
      inner.style.cssText = 'border:0;width:100%;height:100%;display:block'
      doc.body.replaceChildren(inner)
    },
    true,
  )
}

/** Writes a whole page into a same-origin frame (the site preview). */
export function writeFrame(doc: Document, html: string): void {
  doc.open()
  doc.write(html)
  doc.close()
}
