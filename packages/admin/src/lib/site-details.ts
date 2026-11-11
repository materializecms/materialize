import type { SiteDetails } from '@materializecms/core/page'
import { siteDetails } from '@materializecms/core/seo'
import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { useSession } from '../app/context.ts'
import { api } from './api.ts'

/** The site's details (Impostazioni → Sito), as the canvas shows them in texts and buttons. */
export function useSiteDetails(): SiteDetails {
  const { schema } = useSession()
  const seo = useQuery({ queryKey: ['seo'], queryFn: api.seo, staleTime: 60_000 }).data?.seo
  return useMemo(() => siteDetails(seo ?? {}, schema.site.name), [seo, schema.site.name])
}
