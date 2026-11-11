import { sitemapCss } from '@materializecms/core/seo'
import type { APIRoute } from 'astro'
import { getLocales } from '../content.ts'

/** How sitemap.xml looks when someone opens it in a browser, in the site's main language. */
export const GET: APIRoute = async () =>
  new Response(sitemapCss((await getLocales()).default), { headers: { 'Content-Type': 'text/css; charset=utf-8' } })
