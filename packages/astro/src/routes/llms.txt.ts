import { llmsTxt } from '@materializecms/core/seo'
import type { APIRoute } from 'astro'
import { getLlmsSections, getSiteSeo } from '../content.ts'
import { getRuntime } from '../runtime.ts'

/** llms.txt, built with the site: what it is and its pages, for AI search and assistants. */
export const GET: APIRoute = async ({ site }) => {
  if (!site) return new Response('Set `site` in astro.config to publish llms.txt', { status: 404 })
  const { config } = await getRuntime()
  const seo = await getSiteSeo()
  if (seo.llms === false) return new Response('Turned off in Impostazioni → SEO', { status: 404 })
  const b = seo.business ?? {}
  const place = [b.street, [b.postalCode, b.city].filter(Boolean).join(' '), b.country].filter(Boolean).join(', ')
  return new Response(
    llmsTxt({
      name: b.name || seo.siteName || config().site.name,
      description: seo.description,
      details: [
        place && `Indirizzo: ${place}`,
        b.phone && `Telefono: ${b.phone}`,
        b.email && `Email: ${b.email}`,
        b.hours && `Orari: ${b.hours}`,
      ].filter((d): d is string => !!d),
      siteUrl: site,
      sections: await getLlmsSections(),
    }),
    { headers: { 'Content-Type': 'text/plain; charset=utf-8' } },
  )
}
