import type { ConsentCategory, CustomCode, TrackingSettings as Tracking } from '@materializecms/core/tracking'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ChartNoAxesColumn, Cookie, Plus, Trash2 } from 'lucide-react'
import { type FormEvent, useEffect, useState } from 'react'
import { useSession } from '../app/context.ts'
import {
  Button,
  EmptyState,
  IconButton,
  Input,
  Segmented,
  Spinner,
  Switch,
  Textarea,
  toast,
} from '../components/ui.tsx'
import { ApiError, api } from '../lib/api.ts'

const CATEGORIES: { value: ConsentCategory; label: string }[] = [
  { value: 'necessary', label: 'Necessario' },
  { value: 'analytics', label: 'Statistiche' },
  { value: 'marketing', label: 'Marketing' },
]

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4">
      <h2 className="flex items-center gap-2 text-[16px] font-semibold [&_svg]:size-4 [&_svg]:text-fg3">
        {icon}
        {title}
      </h2>
      {children}
    </section>
  )
}

function Field({ label, hint, children }: { label: string; hint?: React.ReactNode; children: React.ReactNode }) {
  return (
    // biome-ignore lint/a11y/noLabelWithoutControl: the control is passed in as children
    <label className="block space-y-1.5">
      <span className="text-[13px] font-medium">{label}</span>
      {children}
      {hint && <span className="block text-[12px] leading-relaxed text-fg3">{hint}</span>}
    </label>
  )
}

/**
 * Impostazioni → Tracciamento e cookie: analytics and tags on the published site, custom code in
 * its head or body, and the consent banner that holds back what needs a yes.
 */
export function TrackingSettings() {
  const { user } = useSession()
  const queryClient = useQueryClient()
  const saved = useQuery({ queryKey: ['tracking'], queryFn: api.tracking, enabled: user.role === 'admin' })
  const [t, setT] = useState<Tracking>({})
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  useEffect(() => {
    if (saved.data) setT(saved.data.tracking)
  }, [saved.data])

  if (user.role !== 'admin')
    return (
      <EmptyState icon={<ChartNoAxesColumn />} title="Statistiche e codice esterno li gestisce un amministratore">
        Codice di terze parti sul sito: per sicurezza, solo gli amministratori lo aggiungono.
      </EmptyState>
    )
  if (saved.isPending) return <Spinner />

  const set = (patch: Partial<Tracking>) => setT((x) => ({ ...x, ...patch }))
  const setBanner = (patch: Partial<NonNullable<Tracking['banner']>>) => set({ banner: { ...t.banner, ...patch } })
  const custom = t.custom ?? []
  const setCustom = (i: number, patch: Partial<CustomCode>) =>
    set({ custom: custom.map((c, j) => (i === j ? { ...c, ...patch } : c)) })
  const gated =
    !!t.ga4 ||
    !!t.gtm ||
    !!t.metaPixel ||
    !!t.matomoUrl ||
    custom.some((c) => c.category !== 'necessary' && c.code.trim())

  const save = async (e: FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setErrors({})
    try {
      // Empty fields are left out, so the site has nothing half-filled.
      const clean = Object.fromEntries(Object.entries(t).filter(([, v]) => v !== '' && v !== undefined)) as Tracking
      queryClient.setQueryData(['tracking'], await api.saveTracking(clean))
      toast('Salvato: vale da subito per il sito pubblicato')
    } catch (error) {
      if (error instanceof ApiError && error.issues.length)
        setErrors(Object.fromEntries(error.issues.map((i) => [i.path.replace(/^tracking\./, ''), i.message])))
      toast((error as Error).message, 'error')
    } finally {
      setSaving(false)
    }
  }

  const input = (key: keyof Tracking, placeholder: string) => (
    <Input
      value={(t[key] as string | undefined) ?? ''}
      placeholder={placeholder}
      onChange={(e) => set({ [key]: e.target.value } as Partial<Tracking>)}
      className={errors[key] ? 'border-danger' : undefined}
      spellCheck={false}
    />
  )
  const error = (key: string) => errors[key] && <span className="block text-[12px] text-danger">{errors[key]}</span>

  return (
    <form onSubmit={save} className="mx-auto max-w-2xl space-y-10 px-5 py-8">
      <Section icon={<ChartNoAxesColumn />} title="Statistiche e marketing">
        <p className="text-[14px] leading-relaxed text-fg2">
          Basta l’ID: Materialize aggiunge il codice a tutte le pagine pubblicate e lo fa partire solo dopo il consenso
          del visitatore, quando serve.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Google Analytics 4" hint="Statistiche: parte dopo il consenso.">
            {input('ga4', 'G-XXXXXXXXXX')}
            {error('ga4')}
          </Field>
          <Field label="Meta Pixel" hint="Marketing: parte dopo il consenso.">
            {input('metaPixel', '1234567890')}
            {error('metaPixel')}
          </Field>
          <Field label="Google Tag Manager" hint="Parte dopo il consenso della categoria scelta.">
            {input('gtm', 'GTM-XXXXXXX')}
            {error('gtm')}
            <Segmented
              size="sm"
              value={t.gtmCategory ?? 'marketing'}
              onChange={(gtmCategory) => set({ gtmCategory })}
              options={CATEGORIES.filter((c) => c.value !== 'necessary')}
            />
          </Field>
          <Field
            label="Plausible"
            hint="Senza cookie: non chiede consenso. Il dominio del sito come registrato su Plausible."
          >
            {input('plausible', 'example.com')}
            {error('plausible')}
          </Field>
          <Field label="Matomo" hint="Statistiche: parte dopo il consenso.">
            <div className="flex gap-2">
              {input('matomoUrl', 'https://matomo.example.com')}
              <div className="w-24 shrink-0">{input('matomoSiteId', 'ID sito')}</div>
            </div>
            {error('matomoUrl')}
            {error('matomoSiteId')}
          </Field>
        </div>
      </Section>

      <Section icon={<Plus />} title="Codice personalizzato">
        <p className="text-[14px] leading-relaxed text-fg2">
          Per gli altri servizi (chat, mappe di calore, verifiche di proprietà…): incolla il codice che ti danno e
          scegli dove va e a cosa serve. Quello di statistica o marketing parte solo dopo il consenso.
        </p>
        {custom.map((c, i) => (
          <div key={c.id} className="space-y-3 rounded-lg border border-line bg-panel p-4">
            <div className="flex items-center gap-2">
              <Input
                value={c.name}
                onChange={(e) => setCustom(i, { name: e.target.value })}
                placeholder="Nome, per esempio Hotjar"
                aria-label="Nome del codice"
              />
              <IconButton
                label={`Togli ${c.name || 'questo codice'}`}
                className="hover:text-danger"
                onClick={() => set({ custom: custom.filter((_, j) => j !== i) })}
              >
                <Trash2 />
              </IconButton>
            </div>
            <div className="flex flex-wrap gap-2">
              <Segmented
                size="sm"
                value={c.place}
                onChange={(place) => setCustom(i, { place })}
                options={[
                  { value: 'head', label: 'Nell’head' },
                  { value: 'body', label: 'In fondo al body' },
                ]}
              />
              <Segmented
                size="sm"
                value={c.category}
                onChange={(category) => setCustom(i, { category })}
                options={CATEGORIES}
              />
            </div>
            <Textarea
              value={c.code}
              onChange={(e) => setCustom(i, { code: e.target.value })}
              placeholder="<script>…</script>"
              aria-label="Codice"
              spellCheck={false}
              className="min-h-24 font-mono text-[12px]"
            />
            {error(`custom.${i}.code`)}
          </div>
        ))}
        <Button
          icon={<Plus className="size-4" />}
          onClick={() =>
            set({
              custom: [
                ...custom,
                { id: crypto.randomUUID().slice(0, 8), name: '', place: 'head', category: 'analytics', code: '' },
              ],
            })
          }
        >
          Aggiungi codice
        </Button>
      </Section>

      <Section icon={<Cookie />} title="Banner dei cookie">
        <p className="text-[14px] leading-relaxed text-fg2">
          {gated
            ? 'Compare da solo ai visitatori, perché c’è codice che chiede il consenso. Rifiutare è facile quanto accettare, e la scelta si cambia da un pulsantino in basso o da un link a #preferenze-cookie (per esempio nel piè di pagina).'
            : 'Non serve finché non aggiungi codice di statistica o marketing: allora comparirà da solo.'}
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Titolo" hint="Vuoto: «Rispettiamo la tua privacy».">
            <Input
              value={t.banner?.title ?? ''}
              onChange={(e) => setBanner({ title: e.target.value })}
              maxLength={120}
            />
          </Field>
          <Field label="Cookie policy" hint="L’indirizzo della pagina con la cookie policy.">
            <Input
              value={t.banner?.policyUrl ?? ''}
              placeholder="/cookie-policy"
              onChange={(e) => setBanner({ policyUrl: e.target.value })}
            />
            {error('banner.policyUrl')}
          </Field>
        </div>
        <Field label="Testo" hint="Vuoto: un testo che spiega cookie tecnici, statistiche e marketing.">
          <Textarea
            value={t.banner?.text ?? ''}
            onChange={(e) => setBanner({ text: e.target.value })}
            maxLength={600}
          />
        </Field>
        <div className="flex flex-wrap items-center gap-6">
          <Field label="Posizione">
            <Segmented
              size="sm"
              value={t.banner?.position ?? 'bottom'}
              onChange={(position) => setBanner({ position })}
              options={[
                { value: 'bottom', label: 'In basso al centro' },
                { value: 'corner', label: 'Nell’angolo' },
              ]}
            />
          </Field>
          <span className="flex items-center gap-2.5 pt-6 text-[13px]">
            <Switch
              checked={t.banner?.reopenButton !== false}
              label="Pulsante per riaprire le preferenze"
              onChange={(reopenButton) => setBanner({ reopenButton })}
            />
            Pulsante per riaprire le preferenze
          </span>
        </div>
        <p className="rounded-lg bg-panel2 px-3.5 py-3 text-[12px] leading-relaxed text-fg3">
          Il banner raccoglie il consenso come chiedono le regole europee e il Garante, ma non sostituisce privacy
          policy e cookie policy scritte per il sito: quelle restano a chi lo gestisce.
        </p>
      </Section>

      <div className="flex justify-end">
        <Button type="submit" variant="primary" loading={saving}>
          Salva
        </Button>
      </div>
    </form>
  )
}
