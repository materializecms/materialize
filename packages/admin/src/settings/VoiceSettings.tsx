import { type BrandVoice, VOICE_TONES, type VoiceAddress } from '@materializecms/core/voice'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Sparkles } from 'lucide-react'
import { type FormEvent, type ReactNode, useEffect, useState } from 'react'
import { Button, cx, Segmented, Spinner, Textarea, toast } from '../components/ui.tsx'
import { api } from '../lib/api.ts'
import { t } from '../lib/i18n.ts'

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    // biome-ignore lint/a11y/noLabelWithoutControl: the control is passed in as children
    <label className="block space-y-1.5">
      <span className="text-[13px] font-medium">{label}</span>
      {children}
      {hint && <span className="block text-[13px] leading-relaxed text-fg3">{hint}</span>}
    </label>
  )
}

const ADDRESS = (): { value: VoiceAddress | 'none'; label: string }[] => [
  { value: 'none', label: t('Come capita') },
  { value: 'tu', label: t('Tu') },
  { value: 'voi', label: t('Voi') },
  { value: 'lei', label: t('Lei') },
]

/**
 * Impostazioni → Voce del brand: how the site speaks. The AI follows it in every text it writes
 * or changes; it can also read it from the texts already published, to start from.
 */
export function VoiceSettings({ editable }: { editable: boolean }) {
  const queryClient = useQueryClient()
  const saved = useQuery({ queryKey: ['voice'], queryFn: api.voice })
  const [voice, setVoice] = useState<BrandVoice>({})
  const [saving, setSaving] = useState(false)
  const [reading, setReading] = useState(false)
  useEffect(() => {
    if (saved.data) setVoice(saved.data.voice)
  }, [saved.data])
  const set = (patch: Partial<BrandVoice>) => setVoice((v) => ({ ...v, ...patch }))
  const tones = voice.tones ?? []

  const save = async (e: FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      const res = await api.saveVoice(voice)
      queryClient.setQueryData(['voice'], res)
      toast(t('Voce del brand salvata: l’AI la usa da subito'))
    } catch (error) {
      toast(error instanceof Error ? error.message : t('Salvataggio non riuscito'), 'error')
    } finally {
      setSaving(false)
    }
  }

  const suggest = async () => {
    setReading(true)
    try {
      const res = await api.suggestVoice()
      setVoice(res.voice)
      toast(t('Letta da {count} testi del sito: controllala e salva', { count: res.texts }))
    } catch (error) {
      toast(error instanceof Error ? error.message : t('Non è riuscito'), 'error')
    } finally {
      setReading(false)
    }
  }

  if (saved.isLoading) return <Spinner />
  return (
    <form onSubmit={save} className="mx-auto max-w-2xl space-y-6 px-5 py-8">
      <div className="space-y-2">
        <h2 className="text-[16px] font-semibold">{t('Voce del brand')}</h2>
        <p className="text-[14px] leading-relaxed text-fg2">
          {t(
            'Come parla il sito. L’AI la segue in ogni testo che scrive o cambia: il pulsante ✨, l’assistente dell’editor, le traduzioni e i client AI collegati con MCP. Così i testi suonano uguali, chiunque li scriva.',
          )}
        </p>
        {editable && (
          <Button
            type="button"
            onClick={() => void suggest()}
            loading={reading}
            icon={<Sparkles className="size-4 text-accent" />}
          >
            {t('Ricavala dai testi del sito')}
          </Button>
        )}
      </div>
      <fieldset disabled={!editable} className="space-y-5">
        <Field
          label={t('Chi siamo e per chi scriviamo')}
          hint={t('Una o due frasi: cosa fate, per chi, cosa vi distingue.')}
        >
          <Textarea
            value={voice.about ?? ''}
            onChange={(e) => set({ about: e.target.value })}
            rows={3}
            maxLength={1000}
            placeholder={t('Studio di architettura a Milano: case e uffici luminosi per famiglie e piccole aziende.')}
          />
        </Field>
        <div className="space-y-1.5">
          <p className="text-[13px] font-medium">{t('Tono')}</p>
          <div className="flex flex-wrap gap-1.5">
            {VOICE_TONES.map((tone) => {
              const on = tones.includes(tone)
              return (
                <button
                  key={tone}
                  type="button"
                  aria-pressed={on}
                  disabled={!editable || (!on && tones.length >= 3)}
                  onClick={() => set({ tones: on ? tones.filter((x) => x !== tone) : [...tones, tone] })}
                  className={cx(
                    'h-7 rounded-full border px-3 text-[13px] transition-colors disabled:opacity-45',
                    on ? 'border-accent bg-accent/12 text-fg' : 'border-line2 text-fg2 hover:text-fg',
                  )}
                >
                  {tone}
                </button>
              )
            })}
          </div>
          <p className="text-[13px] text-fg3">{t('Fino a tre.')}</p>
        </div>
        <div className="space-y-1.5">
          <p className="text-[13px] font-medium">{t('Come vi rivolgete a chi legge')}</p>
          <Segmented
            size="sm"
            value={voice.address ?? 'none'}
            options={ADDRESS()}
            onChange={(v) => set({ address: v === 'none' ? null : v })}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('Parole da usare')} hint={t('Separate da virgole: i termini del vostro mestiere.')}>
            <Textarea
              value={voice.prefer ?? ''}
              onChange={(e) => set({ prefer: e.target.value })}
              rows={3}
              maxLength={1000}
              placeholder={t('progetto, luce, su misura')}
            />
          </Field>
          <Field label={t('Parole da evitare')} hint={t('Che non vi somigliano, o che la concorrenza usa troppo.')}>
            <Textarea
              value={voice.avoid ?? ''}
              onChange={(e) => set({ avoid: e.target.value })}
              rows={3}
              maxLength={1000}
              placeholder={t('eccellenza, leader, soluzioni')}
            />
          </Field>
        </div>
        <Field label={t('Altre regole')}>
          <Textarea
            value={voice.rules ?? ''}
            onChange={(e) => set({ rules: e.target.value })}
            rows={3}
            maxLength={1500}
            placeholder={t('Frasi brevi. Niente punti esclamativi. I numeri in cifre.')}
          />
        </Field>
        <Field
          label={t('Un testo che suona come voi')}
          hint={t('Un paragrafo scritto bene, vostro: l’AI ne prende lo stile, mai il contenuto.')}
        >
          <Textarea
            value={voice.example ?? ''}
            onChange={(e) => set({ example: e.target.value })}
            rows={5}
            maxLength={3000}
          />
        </Field>
        {editable ? (
          <Button type="submit" variant="primary" loading={saving}>
            {t('Salva')}
          </Button>
        ) : (
          <p className="text-[13px] text-fg3">{t('La voce del brand la cambia un amministratore.')}</p>
        )}
      </fieldset>
    </form>
  )
}
