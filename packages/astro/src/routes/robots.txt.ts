import { robotsTxt } from '@materializecms/core/seo'
import type { APIRoute } from 'astro'
import { getSiteSeo } from '../content.ts'

/** robots.txt, built with the site from Impostazioni → SEO. */
export const GET: APIRoute = async ({ site }) =>
  new Response(robotsTxt(await getSiteSeo(), site), { headers: { 'Content-Type': 'text/plain; charset=utf-8' } })
