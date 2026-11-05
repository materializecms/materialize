import { rssXml } from '@materializecms/core/seo'
import type { APIRoute } from 'astro'
import { getFeedItems, getSiteSeo, hasFeed } from '../content.ts'
import { getRuntime } from '../runtime.ts'

/** rss.xml, built with the site: the newest articles, for feed readers and AI search. */
export const GET: APIRoute = async ({ site }) => {
  if (!site) return new Response('Set `site` in astro.config to publish a feed', { status: 404 })
  if (!(await hasFeed())) return new Response('No feed: choose its collections in Impostazioni → SEO', { status: 404 })
  const { config } = await getRuntime()
  const seo = await getSiteSeo()
  return new Response(
    rssXml({
      title: seo.siteName || config().site.name,
      description: seo.description,
      siteUrl: site,
      language: config().locales.default,
      items: await getFeedItems(),
    }),
    { headers: { 'Content-Type': 'application/rss+xml; charset=utf-8' } },
  )
}
