import { BUSINESS_TYPES, normalizePath, type Redirect, type SiteSeo } from '@materializecms/core/seo'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowRight, ExternalLink, Plus, Trash2 } from 'lucide-react'
import { type FormEvent, type ReactNode, useEffect, useState } from 'react'
import { useSession } from '../app/context.ts'
import { Button, IconButton, Input, Spinner, Switch, Textarea, toast } from '../components/ui.tsx'
import { MediaInput } from '../fields/MediaInput.tsx'
import { api } from '../lib/api.ts'

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    // biome-ignore lint/a11y/noLabelWithoutControl: the control is passed in as children
    <label className="block space-y-1.5">
      <span className="text-[13px] font-medium">{label}</span>
      {children}
      {hint && <span className="block text-[12px] leading-relaxed text-fg3">{hint}</span>}
    </label>
  )
}

function Group({ title, text, children }: { title: string; text?: string; children: ReactNode }) {
  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-[15px] font-semibold">{title}</h2>
        {text && <p className="mt-1 text-[14px] leading-relaxed text-fg2">{text}</p>}
      </div>
      {children}
    </section>
  )
}

const lines = (v: string) =>
  v
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)

/** Search engines and sharing for the whole site: name, business data, crawlers, redirects. */
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
  const business = seo.business ?? {}
  const setBusiness = (patch: Partial<NonNullable<SiteSeo['business']>>) => set({ business: { ...business, ...patch } })
  const local = business.type && business.type !== 'Organization' && business.type !== 'Person'
  const siteUrl = schema.site.url

  const save = async (e: FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      const res = await api.saveSeo(seo)
      queryClient.setQueryData(['seo'], res)
      toast('Impostazioni SEO salvate: valgono dalla prossima pubblicazione del sito')
    } catch (error) {
      toast((error as Error).message, 'error')
    } finally {
      setSaving(false)
    }
  }

  if (saved.isLoading) return <Spinner />
  return (
    <div className="mx-auto max-w-xl space-y-10 px-5 py-8">
      <form onSubmit={save} className="space-y-10">
        <fieldset disabled={!editable} className="min-w-0 space-y-10">
          <Group
            title="Il sito sui motori di ricerca"
            text="Valori di partenza per tutte le pagine: ognuna può cambiarli nel pannello Motori di ricerca."
          >
            <div className="grid grid-cols-2 gap-3">
              <Field label="Nome del sito">
                <Input
                  value={seo.siteName ?? ''}
                  placeholder={schema.site.name}
                  onChange={(e) => set({ siteName: e.target.value })}
                />
              </Field>
              <Field label="Titolo delle pagine" hint="%s è il titolo della pagina.">
                <Input
                  value={seo.titleTemplate ?? ''}
                  placeholder={`%s · ${seo.siteName || schema.site.name}`}
                  onChange={(e) => set({ titleTemplate: e.target.value })}
                />
              </Field>
            </div>
            <Field label="Descrizione predefinita" hint="Per le pagine che non ne hanno una.">
              <Textarea
                value={seo.description ?? ''}
                maxLength={300}
                onChange={(e) => set({ description: e.target.value })}
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Immagine di condivisione" hint="1200 × 630, per le pagine senza immagine.">
                <MediaInput value={seo.image} focalPoint={false} onChange={(image) => set({ image })} />
              </Field>
              <Field label="Icona del sito" hint="Quadrata, almeno 512 × 512: scheda del browser e Google.">
                <MediaInput value={seo.favicon} focalPoint={false} onChange={(favicon) => set({ favicon })} />
              </Field>
            </div>
            <Field label="Account su X">
              <Input value={seo.xHandle ?? ''} placeholder="@nome" onChange={(e) => set({ xHandle: e.target.value })} />
            </Field>
          </Group>

          <Group
            title="Chi c’è dietro il sito"
            text="Dati strutturati per Google: nome, logo, contatti e, per un’attività con una sede, indirizzo e orari che possono comparire nei risultati e su Maps."
          >
            <div className="grid grid-cols-2 gap-3">
              <Field label="Tipo">
                <select
                  value={business.type ?? 'Organization'}
                  onChange={(e) => setBusiness({ type: e.target.value as NonNullable<SiteSeo['business']>['type'] })}
                  className="h-9 w-full rounded-md border border-line2 bg-input px-2 text-[14px] outline-none focus:border-accent"
                >
                  {BUSINESS_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Nome">
                <Input
                  value={business.name ?? ''}
                  placeholder={seo.siteName || schema.site.name}
                  onChange={(e) => setBusiness({ name: e.target.value })}
                />
              </Field>
              <Field label="Telefono">
                <Input value={business.phone ?? ''} onChange={(e) => setBusiness({ phone: e.target.value })} />
              </Field>
              <Field label="Email">
                <Input value={business.email ?? ''} onChange={(e) => setBusiness({ email: e.target.value })} />
              </Field>
            </div>
            {business.type !== 'Person' && (
              <Field label="Logo">
                <MediaInput value={business.logo} focalPoint={false} onChange={(logo) => setBusiness({ logo })} />
              </Field>
            )}
            {local && (
              <>
                <Field label="Indirizzo">
                  <Input
                    value={business.street ?? ''}
                    placeholder="Via Roma 1"
                    onChange={(e) => setBusiness({ street: e.target.value })}
                  />
                </Field>
                <div className="grid grid-cols-[1fr_110px_90px_70px] gap-3">
                  <Field label="Città">
                    <Input value={business.city ?? ''} onChange={(e) => setBusiness({ city: e.target.value })} />
                  </Field>
                  <Field label="CAP">
                    <Input
                      value={business.postalCode ?? ''}
                      onChange={(e) => setBusiness({ postalCode: e.target.value })}
                    />
                  </Field>
                  <Field label="Provincia">
                    <Input value={business.region ?? ''} onChange={(e) => setBusiness({ region: e.target.value })} />
                  </Field>
                  <Field label="Paese">
                    <Input
                      value={business.country ?? ''}
                      placeholder="IT"
                      onChange={(e) => setBusiness({ country: e.target.value })}
                    />
                  </Field>
                </div>
                <Field label="Orari" hint="Nel formato di schema.org: Mo-Fr 09:00-18:00, Sa 10:00-13:00.">
                  <Input value={business.hours ?? ''} onChange={(e) => setBusiness({ hours: e.target.value })} />
                </Field>
              </>
            )}
            <Field label="Profili su altri siti" hint="Un indirizzo per riga: Instagram, LinkedIn, Facebook…">
              <Textarea
                value={(business.sameAs ?? []).join('\n')}
                placeholder="https://instagram.com/…"
                onChange={(e) => setBusiness({ sameAs: e.target.value.split('\n') })}
                onBlur={(e) => setBusiness({ sameAs: lines(e.target.value) })}
              />
            </Field>
          </Group>

          <Group
            title="Motori di ricerca e AI"
            text="La mappa del sito e robots.txt si aggiornano da soli a ogni pubblicazione."
          >
            {siteUrl && (
              <div className="flex gap-4 text-[13px]">
                {['sitemap.xml', 'robots.txt'].map((f) => (
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
                checked={!!seo.blockAi}
                onChange={(blockAi) => set({ blockAi })}
                label="Blocca i crawler che addestrano modelli AI"
              />
              <div className="text-[14px]">
                Blocca i crawler che addestrano modelli AI
                <p className="text-[12px] leading-relaxed text-fg3">
                  GPTBot, ClaudeBot, Google-Extended, CCBot e simili. Google e Bing continuano a indicizzare il sito.
                </p>
              </div>
            </div>
            <Field label="Percorsi da non visitare" hint="Uno per riga, per esempio /area-riservata.">
              <Textarea
                value={(seo.disallow ?? []).join('\n')}
                onChange={(e) => set({ disallow: e.target.value.split('\n') })}
                onBlur={(e) => set({ disallow: lines(e.target.value) })}
                className="font-mono text-[13px]"
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Verifica Google Search Console" hint="Il codice del meta tag “google-site-verification”.">
                <Input value={seo.google ?? ''} onChange={(e) => set({ google: e.target.value.trim() })} />
              </Field>
              <Field label="Verifica Bing Webmaster">
                <Input value={seo.bing ?? ''} onChange={(e) => set({ bing: e.target.value.trim() })} />
              </Field>
            </div>
          </Group>
          {editable && (
            <Button type="submit" variant="primary" loading={saving}>
              Salva
            </Button>
          )}
        </fieldset>
      </form>
      <Redirects editable={editable} />
    </div>
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
      await store([...list.filter((r) => r.from !== path), { from: path, to: to.trim() }], 'Reindirizzamento aggiunto')
    ) {
      setFrom('')
      setTo('')
    }
  }

  return (
    <Group
      title="Reindirizzamenti"
      text="Quando cambi l’indirizzo di una pagina pubblicata, il vecchio porta automaticamente al nuovo (301): chi arriva da Google o da un link salvato non trova una pagina vuota. Qui puoi aggiungerne altri, per esempio dal sito precedente."
    >
      {editable && (
        <form onSubmit={add} className="flex items-center gap-2">
          <Input
            aria-label="Vecchio indirizzo"
            value={from}
            placeholder="/vecchia-pagina"
            onChange={(e) => setFrom(e.target.value)}
            className="font-mono text-[13px]"
          />
          <ArrowRight className="size-4 shrink-0 text-fg3" />
          <Input
            aria-label="Nuovo indirizzo"
            value={to}
            placeholder="/nuova-pagina o https://…"
            onChange={(e) => setTo(e.target.value)}
            className="font-mono text-[13px]"
          />
          <Button type="submit" icon={<Plus className="size-3.5" />} disabled={!from.trim() || !to.trim()}>
            Aggiungi
          </Button>
        </form>
      )}
      {saved.isLoading ? (
        <Spinner />
      ) : list.length === 0 ? (
        <p className="text-[13px] text-fg3">Nessun reindirizzamento.</p>
      ) : (
        <ul className="divide-y divide-line rounded-lg border border-line">
          {list.map((r) => (
            <li key={r.from} className="flex items-center gap-2 px-3 py-2 font-mono text-[13px]">
              <span className="min-w-0 flex-1 truncate">{r.from}</span>
              <ArrowRight className="size-3.5 shrink-0 text-fg3" />
              <span className="min-w-0 flex-1 truncate">{r.to}</span>
              {r.auto && <span className="shrink-0 font-sans text-[12px] text-fg3">automatico</span>}
              {editable && (
                <IconButton
                  label="Togli il reindirizzamento"
                  onClick={() =>
                    store(
                      list.filter((o) => o.from !== r.from),
                      'Reindirizzamento tolto',
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
