import type { PageNode } from '@materializecms/core/page'
import { pageChecks, type SeoCheck, type SiteSeo } from '@materializecms/core/seo'
import { useQuery } from '@tanstack/react-query'
import { CircleAlert, CircleCheck, TriangleAlert } from 'lucide-react'
import { useMemo } from 'react'
import { useSession } from '../app/context.ts'
import { cx } from '../components/ui.tsx'
import { FieldsForm } from '../fields/FieldInput.tsx'
import { useForm } from '../fields/form-context.ts'
import { api, type Data, type FieldDescription } from '../lib/api.ts'

const ICON = {
  error: <CircleAlert className="size-3.5 text-danger" />,
  warning: <TriangleAlert className="size-3.5 text-warn" />,
  ok: <CircleCheck className="size-3.5 text-ok" />,
}

/** The checks of a page for search engines, worst first, with the page's SEO fields to fix them. */
export function SeoPanel({
  nodes,
  data,
  seoField,
  onChange,
  onSelect,
}: {
  nodes: PageNode[]
  data: Data
  seoField?: FieldDescription
  onChange: (next: Data, group?: string) => void
  /** Selects the element a check points to. */
  onSelect: (id: string) => void
}) {
  const { docTitle, docUrl } = useForm()
  const { schema } = useSession()
  const saved = useQuery({ queryKey: ['seo'], queryFn: api.seo, staleTime: 60_000 }).data?.seo
  // The site's name from the schema when Impostazioni → SEO has none, as on the published site.
  const site = useMemo<SiteSeo>(
    () => ({ ...saved, siteName: saved?.siteName || schema.site.name }),
    [saved, schema.site.name],
  )
  const urls = useQuery({ queryKey: ['urls'], queryFn: api.urls, staleTime: 30_000 }).data?.urls
  const seo = seoField ? (data[seoField.name] as Data | undefined) : undefined
  const checks = useMemo(
    () =>
      pageChecks({
        title: docTitle,
        url: docUrl,
        seo,
        site,
        nodes,
        // The page itself counts as existing even before it is published.
        knownUrls: urls ? [...urls, ...(docUrl ? [docUrl] : [])] : undefined,
      }),
    [docTitle, docUrl, seo, site, nodes, urls],
  )
  const errors = checks.filter((c) => c.level === 'error').length
  const warnings = checks.filter((c) => c.level === 'warning').length

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="border-b border-line px-3.5 py-3">
        <div className="text-[12.5px] font-semibold">
          {errors ? `${errors} da sistemare` : warnings ? 'Quasi a posto' : 'Tutto a posto'}
        </div>
        <div className="text-[11.5px] text-fg3">
          {[errors && `${errors} errori`, warnings && `${warnings} consigli`].filter(Boolean).join(' · ') ||
            'La pagina è pronta per i motori di ricerca.'}
        </div>
      </div>
      <ul className="space-y-0.5 p-1.5">
        {checks.map((c: SeoCheck) => (
          <li key={c.id}>
            <button
              type="button"
              disabled={!c.nodeId}
              onClick={() => c.nodeId && onSelect(c.nodeId)}
              className={cx(
                'flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left',
                c.nodeId && 'hover:bg-hover',
              )}
            >
              <span className="mt-0.5 shrink-0">{ICON[c.level]}</span>
              <span className="min-w-0">
                <span className={cx('block text-[12px] leading-snug', c.level === 'ok' && 'text-fg2')}>{c.label}</span>
                {c.detail && c.level !== 'ok' && (
                  <span className="block text-[11px] leading-snug text-fg3">{c.detail}</span>
                )}
              </span>
            </button>
          </li>
        ))}
      </ul>
      {seoField && (
        <div className="border-t border-line px-3.5 py-4">
          <FieldsForm fields={[seoField]} value={data} onChange={onChange} path={[]} />
        </div>
      )}
    </div>
  )
}
