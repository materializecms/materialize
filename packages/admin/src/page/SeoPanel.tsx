import type { PageNode, Theme } from '@materializecms/core/page'
import type { MediaInfo } from '@materializecms/core/quality'
import { pageChecks, type SeoCheck, type SiteSeo } from '@materializecms/core/seo'
import { useQuery } from '@tanstack/react-query'
import { CircleAlert, CircleCheck, TriangleAlert } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useSession } from '../app/context.ts'
import { Button, cx } from '../components/ui.tsx'
import { FieldsForm } from '../fields/FieldInput.tsx'
import { useForm } from '../fields/form-context.ts'
import { api, type Data, type FieldDescription } from '../lib/api.ts'
import { t, tn } from '../lib/i18n.ts'
import { qualityOf } from './quality.ts'
import { Review } from './Review.tsx'

const ICON = {
  error: <CircleAlert className="size-3.5 text-danger" />,
  warning: <TriangleAlert className="size-3.5 text-warn" />,
  ok: <CircleCheck className="size-3.5 text-ok" />,
}

/** The library's files by address, with size and type: what the performance checks weigh. */
export function useMediaInfo(): Record<string, MediaInfo> {
  const media = useQuery({ queryKey: ['media-info'], queryFn: () => api.media({ limit: 100 }), staleTime: 60_000 })
  return useMemo(
    () => Object.fromEntries((media.data?.items ?? []).map((m) => [m.url, { size: m.size, mime: m.mime }])),
    [media.data],
  )
}

/**
 * The checks of a page, worst first: search engines, accessibility (with the contrast of the
 * texts measured on the canvas) and performance, and the fields that fix the SEO ones (title,
 * description, image). In Design those fields are already in the page panel on the right: then
 * `onEditFields` is given and leads there, so they are never shown twice.
 */
export function SeoPanel({
  docId,
  nodes,
  data,
  theme,
  seoField,
  onChange,
  onSelect,
  onEditFields,
}: {
  /** The document, for the AI review. */
  docId?: string
  nodes: PageNode[]
  data: Data
  theme?: Theme
  seoField?: FieldDescription
  onChange: (next: Data, group?: string) => void
  /** Selects the element a check points to. */
  onSelect: (id: string) => void
  onEditFields?: () => void
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
  const media = useMediaInfo()
  // Measured once the canvas has drawn the change.
  const [quality, setQuality] = useState(() => qualityOf(nodes, { media, theme }))
  useEffect(() => {
    const timer = setTimeout(() => setQuality(qualityOf(nodes, { media, theme })), 400)
    return () => clearTimeout(timer)
  }, [nodes, media, theme])
  const groups = [
    { title: t('Motori di ricerca'), checks },
    { title: t('Accessibilità'), checks: quality.accessibility },
    { title: t('Prestazioni'), checks: quality.performance },
  ]
  const all = groups.flatMap((g) => g.checks)
  const errors = all.filter((c) => c.level === 'error').length
  const warnings = all.filter((c) => c.level === 'warning').length

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="border-b border-line px-3.5 py-3">
        <div className="text-[13px] font-semibold">
          {errors ? t('{n} da sistemare', { n: errors }) : warnings ? t('Quasi a posto') : t('Tutto a posto')}
        </div>
        <div className="text-[12px] text-fg3">
          {[errors && tn(errors, '1 errore', '{n} errori'), warnings && tn(warnings, '1 consiglio', '{n} consigli')]
            .filter(Boolean)
            .join(' · ') || t('La pagina è pronta: motori di ricerca, accessibilità e prestazioni.')}
        </div>
      </div>
      <section className="border-b border-line px-3.5 pt-3 pb-3.5">
        <h3 className="pb-2 text-[11.5px] font-semibold tracking-wide text-fg3 uppercase">{t('Revisione AI')}</h3>
        <Review docId={docId} data={data} onApply={(next) => onChange(next, 'ai:review')} onSelect={onSelect} />
      </section>
      {groups.map((g) => (
        <section key={g.title} className="border-b border-line last:border-b-0">
          <h3 className="px-3.5 pt-3 pb-1 text-[11.5px] font-semibold tracking-wide text-fg3 uppercase">{g.title}</h3>
          <CheckList checks={g.checks} onSelect={onSelect} />
        </section>
      ))}
      {seoField && !onEditFields && (
        <div className="border-t border-line px-3.5 py-4">
          <FieldsForm fields={[seoField]} value={data} onChange={onChange} path={[]} />
        </div>
      )}
      {seoField && onEditFields && (
        <div className="border-t border-line px-3.5 py-4">
          <p className="mb-2.5 text-[13px] leading-relaxed text-fg3">
            {t('Titolo, descrizione e immagine per Google e i social sono nel pannello della pagina, a destra.')}
          </p>
          <Button size="sm" className="w-full" onClick={onEditFields}>
            {t('Modifica titolo e descrizione')}
          </Button>
        </div>
      )}
    </div>
  )
}

function CheckList({ checks, onSelect }: { checks: SeoCheck[]; onSelect: (id: string) => void }) {
  return (
    <ul className="space-y-0.5 p-1.5 pt-0">
      {checks.map((c) => (
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
              <span className={cx('block text-[12.5px] leading-snug', c.level === 'ok' && 'text-fg2')}>{c.label}</span>
              {c.detail && c.level !== 'ok' && (
                <span className="block text-[11.5px] leading-snug text-fg3">{c.detail}</span>
              )}
            </span>
          </button>
        </li>
      ))}
    </ul>
  )
}
