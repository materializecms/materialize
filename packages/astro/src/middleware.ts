import { htmlToMarkdown } from '@materializecms/core/seo'
import type { MiddlewareHandler } from 'astro'
import { getSiteSeo } from './content.ts'

const BADGE =
  '<div role="note" style="position:fixed;left:16px;bottom:16px;z-index:2147483647;display:flex;align-items:center;gap:8px;' +
  'padding:7px 12px;border-radius:999px;background:rgba(20,20,22,.88);color:#fff;font:500 13px/1.2 system-ui,sans-serif;' +
  'box-shadow:0 4px 18px rgba(0,0,0,.25);backdrop-filter:blur(6px);pointer-events:none">' +
  '<span style="width:7px;height:7px;border-radius:50%;background:#f5b83d"></span>Anteprima · non ancora pubblicata</div>'

/**
 * Shared preview links say what they are: a small badge, out of the way, on every page. In dev,
 * /page.md is the page converted on request (the build writes these files next to the HTML).
 */
export const onRequest: MiddlewareHandler = async (context, next) => {
  if (context.url.pathname.endsWith('.md') && (await getSiteSeo()).llms !== false) {
    const path = context.url.pathname.slice(0, -3)
    const page = await next(path === '/index' ? '/' : path)
    if (page.status !== 200) return page
    return new Response(htmlToMarkdown(await page.text(), context.site), {
      headers: { 'content-type': 'text/markdown; charset=utf-8' },
    })
  }
  const response = await next()
  if (!context.url.pathname.startsWith('/_materialize/share/')) return response
  if (response.status !== 200 || !response.headers.get('content-type')?.includes('text/html')) return response
  const html = await response.text()
  const at = html.lastIndexOf('</body>')
  const body = at === -1 ? html + BADGE : html.slice(0, at) + BADGE + html.slice(at)
  const headers = new Headers(response.headers)
  headers.delete('content-length')
  return new Response(body, { status: response.status, headers })
}
