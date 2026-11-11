import { feedCollections, normalizePath, type Redirect, type SiteSeo } from '@materializecms/core/seo'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowRight, ExternalLink, Plus, Trash2 } from 'lucide-react'
import { type FormEvent, type ReactNode, useEffect, useState } from 'react'
import { useSession } from '../app/context.ts'
import { Button, IconButton, Input, Spinner, Switch, Textarea, toast } from '../components/ui.tsx'
import { MediaInput } from '../fields/MediaInput.tsx'
import { api } from '../lib/api.ts'
import { t } from '../lib/i18n.ts'
import { href, navigate } from '../lib/router.ts'
import { SettingsPage, SettingsSection } from './SettingsPage.tsx'

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    // biome-ignore lint/a11y/noLabelWithoutControl: the control is passed in as children
    <label className="block space-y-1.5">
      <span className="text-[13px] font-medium">{label}</span>
      {children}
      {hint && <span className="block text-[13px] leading-relaxed text-fg3">{hint}</span>}
    </label>
  )
}

export function Group({ title, text, children }: { title: string; text?: string; children: ReactNode }) {
  return (
    <SettingsSection title={title} description={text}>
      {children}
    </SettingsSection>
  )
}

export const lines = (v: string) =>
  v
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)

/** Search engines and sharing for the whole site: page titles, crawlers, feeds, redirects. */
export function SeoSettings({ editable }: { editable: boolean }) {
  const queryClient = useQueryClient()
  const { schema } = useSession()
  const saved = useQuery({ queryKey: ['seo'], queryFn: api.seo })
  const [seo, setSeo] = useState<SiteSeo>({})
  const [saving, setSaving] = useState(false)
  useEffect(() => {
    if (saved.data) setSeo(saved.data.seo)
  }, [saved.data])
  const set = (patch: Partial<SiteSeo>) => setSeo((s) => ({ ...s, ...patch }))
  const siteTab = schema.collections.find((c) => c.singleton)?.name ?? 'settings'
  const siteUrl = schema.site.url
  const shapes = schema.collections.map((c) => ({
    ...c,
    url: c.hasPages || undefined,
    fields: Object.fromEntries(c.fields.map((f) => [f.name, { kind: f.kind }])),
  }))
  // Collections that can be in the feed, and the ones that are (chosen, or by default).
  const feedChoices = schema.collections.filter((c) => c.hasPages && !c.singleton)
  const feed = feedCollections(shapes, seo.feed)

  const save = async (e: FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      const res = await api.saveSeo(seo)
      queryClient.setQueryData(['seo'], res)
      toast(t('Impostazioni SEO salvate: valgono dalla prossima pubblicazione del sito'))
    } catch (error) {
      toast((error as Error).message, 'error')
    } finally {
      setSaving(false)
    }
  }

  if (saved.isLoading) return <Spinner />
  return (
    <SettingsPage>
      <form onSubmit={save} className="space-y-10">
        <fieldset disabled={!editable} className="min-w-0 space-y-10">
          <Group
            title={t('Il sito sui motori di ricerca')}
            text={t('Valori di partenza per tutte le pagine: ognuna può cambiarli nel pannello Motori di ricerca.')}
          >
            <p className="text-[13px] leading-relaxed text-fg3">
              {t('Nome, descrizione, logo, icona e contatti del sito si cambiano in')}{' '}
              <a
                href={href({ name: 'settings', tab: siteTab })}
                onClick={(e) => {
                  if (e.metaKey || e.ctrlKey) return
                  e.preventDefault()
                  navigate({ name: 'settings', tab: siteTab })
                }}
                className="font-medium text-accent hover:underline"
              >
                {t('Impostazioni → Sito')}
              </a>
              .
            </p>
            <div className="grid grid-cols-2 gap-3">
              <Field label={t('Titolo delle pagine')} hint={t('%s è il titolo della pagina.')}>
                <Input
                  value={seo.titleTemplate ?? ''}
                  placeholder={`%s · ${seo.siteName || schema.site.name}`}
                  onChange={(e) => set({ titleTemplate: e.target.value })}
                />
              </Field>
              <Field label={t('Immagine di condivisione')} hint={t('1200 × 630, per le pagine senza immagine.')}>
                <MediaInput value={seo.image} focalPoint={false} onChange={(image) => set({ image })} />
              </Field>
            </div>
            <Field label={t('Account su X')}>
              <Input
                value={seo.xHandle ?? ''}
                placeholder={t('@nome')}
                onChange={(e) => set({ xHandle: e.target.value })}
              />
            </Field>
          </Group>

          <Group
            title={t('Motori di ricerca e AI')}
            text={t('La mappa del sito e robots.txt si aggiornano da soli a ogni pubblicazione.')}
          >
            {siteUrl && (
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-[13px]">
                {[
                  'sitemap.xml',
                  'robots.txt',
                  ...(feed.length ? ['rss.xml'] : []),
                  ...(seo.llms !== false ? ['llms.txt'] : []),
                ].map((f) => (
                  <a
                    key={f}
                    href={`/${f}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-accent hover:underline"
                  >
                    {f} <ExternalLink className="size-3" />
                  </a>
                ))}
              </div>
            )}
            <div className="flex items-start gap-3">
              <Switch
                checked={seo.llms !== false}
                onChange={(on) => set({ llms: on ? undefined : false })}
                label={t('Pronto per le ricerche AI')}
              />
              <div className="text-[14px]">
                {t('Pronto per le ricerche AI')}
                <p className="text-[13px] leading-relaxed text-fg3">
                  {t(
                    'Pubblica llms.txt, l’indice del sito per ChatGPT, Claude, Perplexity e gli altri assistenti, e una copia in testo semplice di ogni pagina (per esempio /chi-siamo.md), più facile da leggere e citare.',
                  )}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Switch
                checked={!!seo.blockAi}
                onChange={(blockAi) => set({ blockAi })}
                label={t('Blocca i crawler che addestrano modelli AI')}
              />
              <div className="text-[14px]">
                {t('Blocca i crawler che addestrano modelli AI')}
                <p className="text-[13px] leading-relaxed text-fg3">
                  {t(
                    'GPTBot, ClaudeBot, Google-Extended, CCBot e simili. Google, Bing e le ricerche AI (ChatGPT Search, Claude, Perplexity) continuano a trovare il sito e a mandarti visitatori.',
                  )}
                </p>
              </div>
            </div>
            {feedChoices.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-[13px] font-medium">{t('Feed RSS')}</p>
                <div className="flex flex-wrap gap-x-4 gap-y-1.5">
                  {feedChoices.map((c) => (
                    <label key={c.name} className="inline-flex items-center gap-2 text-[14px]">
                      <input
                        type="checkbox"
                        className="accent-accent"
                        checked={feed.includes(c.name)}
                        onChange={(e) =>
                          set({
                            feed: e.target.checked ? [...feed, c.name] : feed.filter((n) => n !== c.name),
                          })
                        }
                      />
                      {c.label}
                    </label>
                  ))}
                </div>
                <p className="text-[13px] leading-relaxed text-fg3">
                  {t(
                    'Gli ultimi contenuti pubblicati, in /rss.xml: per i lettori di feed, le newsletter automatiche e le ricerche AI. Nessuna casella, nessun feed.',
                  )}
                </p>
              </div>
            )}
            <Field label={t('Percorsi da non visitare')} hint={t('Uno per riga, per esempio /area-riservata.')}>
              <Textarea
                value={(seo.disallow ?? []).join('\n')}
                onChange={(e) => set({ disallow: e.target.value.split('\n') })}
                onBlur={(e) => set({ disallow: lines(e.target.value) })}
                className="font-mono text-[13px]"
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field
                label={t('Verifica Google Search Console')}
                hint={t('Il codice del meta tag “google-site-verification”.')}
              >
                <Input value={seo.google ?? ''} onChange={(e) => set({ google: e.target.value.trim() })} />
              </Field>
              <Field label={t('Verifica Bing Webmaster')}>
                <Input value={seo.bing ?? ''} onChange={(e) => set({ bing: e.target.value.trim() })} />
              </Field>
            </div>
          </Group>
          {editable && (
            <Button type="submit" variant="primary" loading={saving}>
              {t('Salva')}
            </Button>
          )}
        </fieldset>
      </form>
      <Redirects editable={editable} />
    </SettingsPage>
  )
}

function Redirects({ editable }: { editable: boolean }) {
  const queryClient = useQueryClient()
  const saved = useQuery({ queryKey: ['redirects'], queryFn: api.redirects })
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const list = saved.data?.redirects ?? []

  const store = async (next: Redirect[], message: string) => {
    try {
      queryClient.setQueryData(['redirects'], await api.saveRedirects(next))
      toast(message)
      return true
    } catch (error) {
      toast((error as Error).message, 'error')
      return false
    }
  }
  const add = async (e: FormEvent) => {
    e.preventDefault()
    if (!from.trim() || !to.trim()) return
    const path = normalizePath(from)
    if (
      await store(
        [...list.filter((r) => r.from !== path), { from: path, to: to.trim() }],
        t('Reindirizzamento aggiunto'),
      )
    ) {
      setFrom('')
      setTo('')
    }
  }

  return (
    <Group
      title={t('Reindirizzamenti')}
      text={t(
        'Quando cambi l’indirizzo di una pagina pubblicata, il vecchio porta automaticamente al nuovo (301): chi arriva da Google o da un link salvato non trova una pagina vuota. Qui puoi aggiungerne altri, per esempio dal sito precedente.',
      )}
    >
      {editable && (
        <form onSubmit={add} className="flex items-center gap-2">
          <Input
            aria-label={t('Vecchio indirizzo')}
            value={from}
            placeholder={t('/vecchia-pagina')}
            onChange={(e) => setFrom(e.target.value)}
            className="font-mono text-[13px]"
          />
          <ArrowRight className="size-4 shrink-0 text-fg3" />
          <Input
            aria-label={t('Nuovo indirizzo')}
            value={to}
            placeholder={t('/nuova-pagina o https://…')}
            onChange={(e) => setTo(e.target.value)}
            className="font-mono text-[13px]"
          />
          <Button type="submit" icon={<Plus className="size-3.5" />} disabled={!from.trim() || !to.trim()}>
            {t('Aggiungi')}
          </Button>
        </form>
      )}
      {saved.isLoading ? (
        <Spinner />
      ) : list.length === 0 ? (
        <p className="text-[13px] text-fg3">{t('Nessun reindirizzamento.')}</p>
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-2xl bg-panel2">
          {list.map((r) => (
            <li key={r.from} className="flex items-center gap-2 px-3 py-2 font-mono text-[13px]">
              <span className="min-w-0 flex-1 truncate">{r.from}</span>
              <ArrowRight className="size-3.5 shrink-0 text-fg3" />
              <span className="min-w-0 flex-1 truncate">{r.to}</span>
              {r.auto && <span className="shrink-0 font-sans text-[12px] text-fg3">{t('automatico')}</span>}
              {editable && (
                <IconButton
                  label={t('Togli il reindirizzamento')}
                  onClick={() =>
                    store(
                      list.filter((o) => o.from !== r.from),
                      t('Reindirizzamento tolto'),
                    )
                  }
                >
                  <Trash2 />
                </IconButton>
              )}
            </li>
          ))}
        </ul>
      )}
    </Group>
  )
}
