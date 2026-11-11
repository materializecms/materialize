import { businessTypes, type SiteSeo } from '@materializecms/core/seo'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowRight, ExternalLink } from 'lucide-react'
import { type FormEvent, useEffect, useState } from 'react'
import { useSession } from '../app/context.ts'
import { Button, cx, Input, inputClass, Spinner, Textarea, toast } from '../components/ui.tsx'
import { MediaInput } from '../fields/MediaInput.tsx'
import { api, type CollectionDescription } from '../lib/api.ts'
import { t } from '../lib/i18n.ts'
import { href, navigate, type Route } from '../lib/router.ts'
import { Field, Group, lines } from './SeoSettings.tsx'
import { SettingsPage } from './SettingsPage.tsx'

type Business = NonNullable<SiteSeo['business']>

/**
 * Impostazioni → Sito: who the site is and how to reach them, written once. The name, description,
 * logo and icon; contacts, address and social profiles. Google reads them as structured data, and
 * texts and buttons on the canvas can show them ("Dato del sito"), so they change everywhere at once.
 */
export function SiteSettings({ editable, extra }: { editable: boolean; extra?: CollectionDescription }) {
  const queryClient = useQueryClient()
  const { schema } = useSession()
  const saved = useQuery({ queryKey: ['seo'], queryFn: api.seo })
  const [seo, setSeo] = useState<SiteSeo>({})
  const [name, setName] = useState(schema.site.name)
  const [saving, setSaving] = useState(false)
  useEffect(() => {
    if (saved.data) setSeo(saved.data.seo)
  }, [saved.data])
  const set = (patch: Partial<SiteSeo>) => setSeo((s) => ({ ...s, ...patch }))
  const business: Business = seo.business ?? {}
  const setBusiness = (patch: Partial<Business>) => set({ business: { ...business, ...patch } })
  const local = business.type && business.type !== 'Organization' && business.type !== 'Person'

  const save = async (e: FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      const res = await api.saveSeo(seo, name.trim() || undefined)
      queryClient.setQueryData(['seo'], res)
      // The name shows in the sidebar and in every page title of the panel.
      await queryClient.invalidateQueries({ queryKey: ['schema'] })
      toast(t('Dati del sito salvati: il sito si aggiorna da solo'))
    } catch (error) {
      toast((error as Error).message, 'error')
    } finally {
      setSaving(false)
    }
  }

  const go = (route: Route, label: string) => (
    <a
      href={href(route)}
      onClick={(e) => {
        if (e.metaKey || e.ctrlKey) return
        e.preventDefault()
        navigate(route)
      }}
      className="flex items-center justify-between gap-3 rounded-xl border border-line px-4 py-3 text-[14px] font-medium hover:border-line2 hover:bg-hover"
    >
      {label}
      <ArrowRight className="size-4 text-fg3" />
    </a>
  )

  if (saved.isLoading) return <Spinner />
  return (
    <SettingsPage onSubmit={save}>
      <fieldset disabled={!editable} className="min-w-0 space-y-10">
        <Group
          title={t('Identità')}
          text={t(
            'Come si chiama il sito e come si presenta: nei risultati di Google, nella scheda del browser, nelle condivisioni.',
          )}
        >
          <Field label={t('Nome del sito')}>
            <Input value={name} required maxLength={120} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field
            label={t('Descrizione del sito')}
            hint={t('Una o due frasi: Google la usa per le pagine che non hanno una descrizione propria.')}
          >
            <Textarea
              value={seo.description ?? ''}
              maxLength={300}
              onChange={(e) => set({ description: e.target.value })}
            />
          </Field>
          <div className="grid grid-cols-2 gap-3 max-sm:grid-cols-1">
            <Field label={t('Logo')} hint={t('Per Google e per chi condivide il sito.')}>
              <MediaInput value={business.logo} focalPoint={false} onChange={(logo) => setBusiness({ logo })} />
            </Field>
            <Field label={t('Icona del sito')} hint={t('Quadrata, almeno 512 × 512: scheda del browser e Google.')}>
              <MediaInput value={seo.favicon} focalPoint={false} onChange={(favicon) => set({ favicon })} />
            </Field>
          </div>
          <Field
            label={t('Indirizzo del sito')}
            hint={
              schema.site.url
                ? t('Lo decide il server: si cambia dove è installato Materialize.')
                : t('Non è ancora impostato: sul server si indica con MATERIALIZE_SITE_URL.')
            }
          >
            {schema.site.url ? (
              <a
                href={schema.site.url}
                target="_blank"
                rel="noreferrer"
                className="flex h-8 items-center gap-1.5 font-mono text-[13px] text-accent hover:underline"
              >
                {schema.site.url} <ExternalLink className="size-3.5" />
              </a>
            ) : (
              <span className="flex h-8 items-center text-[13px] text-fg3">—</span>
            )}
          </Field>
        </Group>

        <Group
          title={t('Contatti e sede')}
          text={t(
            'Scritti una volta qui: li legge Google, e testi e pulsanti delle pagine possono mostrarli (sulla tela, «Dato del sito»), così cambiano ovunque insieme.',
          )}
        >
          <div className="grid grid-cols-2 gap-3 max-sm:grid-cols-1">
            <Field label={t('Che cosa è')}>
              <select
                value={business.type ?? 'Organization'}
                onChange={(e) => setBusiness({ type: e.target.value as Business['type'] })}
                className={cx(inputClass, 'h-8')}
              >
                {businessTypes().map((b) => (
                  <option key={b.value} value={b.value}>
                    {b.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={t('Nome per Google')} hint={t('Se è diverso da quello del sito.')}>
              <Input
                value={business.name ?? ''}
                placeholder={name}
                onChange={(e) => setBusiness({ name: e.target.value })}
              />
            </Field>
            <Field label={t('Email')}>
              <Input
                type="email"
                value={business.email ?? ''}
                placeholder="ciao@…"
                onChange={(e) => setBusiness({ email: e.target.value })}
              />
            </Field>
            <Field label={t('Telefono')}>
              <Input
                type="tel"
                value={business.phone ?? ''}
                placeholder="+39 …"
                onChange={(e) => setBusiness({ phone: e.target.value })}
              />
            </Field>
          </div>
          <Field label={t('Indirizzo')}>
            <Input
              value={business.street ?? ''}
              placeholder={t('Via Roma 1')}
              onChange={(e) => setBusiness({ street: e.target.value })}
            />
          </Field>
          <div className="grid grid-cols-[1fr_110px_90px_70px] gap-3 max-sm:grid-cols-2">
            <Field label={t('Città')}>
              <Input value={business.city ?? ''} onChange={(e) => setBusiness({ city: e.target.value })} />
            </Field>
            <Field label={t('CAP')}>
              <Input value={business.postalCode ?? ''} onChange={(e) => setBusiness({ postalCode: e.target.value })} />
            </Field>
            <Field label={t('Provincia')}>
              <Input value={business.region ?? ''} onChange={(e) => setBusiness({ region: e.target.value })} />
            </Field>
            <Field label={t('Paese')}>
              <Input
                value={business.country ?? ''}
                placeholder="IT"
                onChange={(e) => setBusiness({ country: e.target.value })}
              />
            </Field>
          </div>
          <Field
            label={t('Orari')}
            hint={
              local
                ? t('Nel formato di schema.org: Mo-Fr 09:00-18:00, Sa 10:00-13:00.')
                : t('Per Google contano per le attività con una sede (scegli il tipo qui sopra).')
            }
          >
            <Input value={business.hours ?? ''} onChange={(e) => setBusiness({ hours: e.target.value })} />
          </Field>
        </Group>

        <Group title={t('Profili social')} text={t('Un indirizzo per riga: Instagram, LinkedIn, Facebook…')}>
          <Textarea
            aria-label={t('Profili social')}
            value={(business.sameAs ?? []).join('\n')}
            placeholder="https://instagram.com/…"
            onChange={(e) => setBusiness({ sameAs: e.target.value.split('\n') })}
            onBlur={(e) => setBusiness({ sameAs: lines(e.target.value) })}
          />
        </Group>

        {editable && (
          <Button type="submit" variant="primary" loading={saving}>
            {t('Salva')}
          </Button>
        )}
      </fieldset>

      <Group title={t('Anche qui')}>
        <div className="grid grid-cols-2 gap-2 max-sm:grid-cols-1">
          {go({ name: 'settings', tab: 'languages' }, t('Lingue del sito'))}
          {go({ name: 'settings', tab: 'seo' }, t('Motori di ricerca e AI'))}
          {go({ name: 'settings', tab: 'tracking' }, t('Tracciamento e cookie'))}
          {extra && go({ name: 'settings', tab: `${extra.name}:altri` }, t('Altri dati del sito'))}
        </div>
      </Group>
    </SettingsPage>
  )
}
