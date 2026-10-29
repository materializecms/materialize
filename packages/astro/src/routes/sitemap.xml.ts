import { sitemapXml } from '@materializecms/core/seo'
import type { APIRoute } from 'astro'
import { getSitemapPages } from '../content.ts'

/** sitemap.xml, built with the site: every published page that search engines may index. */
export const GET: APIRoute = async ({ site }) => {
  if (!site) return new Response('Set `site` in astro.config to publish a sitemap', { status: 404 })
  return new Response(sitemapXml(await getSitemapPages(), site), {
    headers: { 'Content-Type': 'application/xml; charset=utf-8' },
  })
}
