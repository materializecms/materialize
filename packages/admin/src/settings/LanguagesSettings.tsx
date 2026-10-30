import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Languages, Plus, Star, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useSession } from '../app/context.ts'
import { localeName } from '../app/Sidebar.tsx'
import { Button, IconButton, Spinner, toast } from '../components/ui.tsx'
import { api } from '../lib/api.ts'

/** Languages offered when adding one; any other code works through the API. */
const COMMON = [
  'it',
  'en',
  'fr',
  'de',
  'es',
  'pt',
  'nl',
  'pl',
  'sv',
  'da',
  'fi',
  'nb',
  'cs',
  'el',
  'ro',
  'hu',
  'hr',
  'sl',
  'ru',
  'uk',
  'tr',
  'ar',
  'he',
  'zh',
  'ja',
  'ko',
  'hi',
]

/**
 * Impostazioni → Lingue: the languages the site is published in. The main one has addresses
 * without a prefix; the others live under /en/, /fr/… Pages are translated from the editor.
 */
export function LanguagesSettings() {
  const { user } = useSession()
  const queryClient = useQueryClient()
  const query = useQuery({ queryKey: ['languages'], queryFn: api.languages })
  const [adding, setAdding] = useState('')
  const [saving, setSaving] = useState(false)
  const admin = user.role === 'admin'

  if (!query.data) return <Spinner />
  const { locales, documents } = query.data

  const save = async (next: { default: string; available: string[] }, message: string) => {
    setSaving(true)
    try {
      const res = await api.saveLanguages(next)
      queryClient.setQueryData(['languages'], res)
      // Every screen reads the languages from the schema.
      await queryClient.invalidateQueries({ queryKey: ['schema'] })
      toast(message)
    } catch (error) {
      toast((error as Error).message, 'error')
    } finally {
      setSaving(false)
    }
  }

  const remove = (code: string) => {
    const count = documents[code] ?? 0
    if (
      count &&
      !confirm(
        `${localeName(code)} ha ${count} ${count === 1 ? 'contenuto' : 'contenuti'}: togliendo la lingua spariscono dal sito, ma restano salvati e tornano se la aggiungi di nuovo.`,
      )
    )
      return
    void save(
      { default: locales.default, available: locales.available.filter((l) => l !== code) },
      `${localeName(code)} tolta dal sito`,
    )
  }

  const choices = COMMON.filter((c) => !locales.available.includes(c))

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-5 py-8">
      <section className="space-y-4">
        <h2 className="flex items-center gap-2 text-[16px] font-semibold [&_svg]:size-4 [&_svg]:text-fg3">
          <Languages />
          Lingue del sito
        </h2>
        <p className="text-[14px] leading-relaxed text-fg2">
          La lingua principale ha gli indirizzi senza prefisso; le altre stanno sotto{' '}
          <span className="font-mono text-[13px]">/en/</span>, <span className="font-mono text-[13px]">/fr/</span>… Ogni
          pagina si traduce dall’editor, dal menu della lingua in alto: menu e piè di pagina condivisi si traducono una
          volta per tutte le pagine.
        </p>
        <ul className="divide-y divide-line rounded-lg border border-line">
          {locales.available.map((code) => {
            const main = code === locales.default
            const count = documents[code] ?? 0
            return (
              <li key={code} className="flex items-center gap-3 px-3 py-2.5">
                <span className="flex size-7 items-center justify-center rounded-md bg-hover font-mono text-[12px] font-medium uppercase text-fg2">
                  {code}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 text-[14px] font-medium">
                    {localeName(code)}
                    {main && (
                      <span className="rounded-full bg-accent/12 px-2 py-0.5 text-[12px] font-medium text-accent">
                        Principale
                      </span>
                    )}
                  </div>
                  <div className="text-[12px] text-fg3">
                    {count ? `${count} ${count === 1 ? 'contenuto' : 'contenuti'}` : 'Nessun contenuto ancora'}
                    {!main && <span className="font-mono"> · /{code}/</span>}
                  </div>
                </div>
                {admin && !main && (
                  <>
                    <Button
                      size="sm"
                      icon={<Star className="size-3.5" />}
                      disabled={saving}
                      onClick={() =>
                        void save(
                          { default: code, available: locales.available },
                          `${localeName(code)} è la lingua principale`,
                        )
                      }
                    >
                      Rendi principale
                    </Button>
                    <IconButton
                      label={`Togli ${localeName(code)}`}
                      onClick={() => remove(code)}
                      className="hover:text-danger"
                    >
                      <Trash2 />
                    </IconButton>
                  </>
                )}
              </li>
            )
          })}
        </ul>
        {admin ? (
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault()
              if (!adding) return
              void save(
                { default: locales.default, available: [...locales.available, adding] },
                `${localeName(adding)} aggiunta: ora puoi tradurre le pagine`,
              ).then(() => setAdding(''))
            }}
          >
            <select
              value={adding}
              onChange={(e) => setAdding(e.target.value)}
              className="h-8 min-w-0 flex-1 rounded-md border border-line2 bg-input px-2 text-[14px] outline-none focus:border-accent"
            >
              <option value="">Scegli una lingua da aggiungere…</option>
              {choices.map((c) => (
                <option key={c} value={c}>
                  {localeName(c)} ({c})
                </option>
              ))}
            </select>
            <Button
              type="submit"
              variant="primary"
              icon={<Plus className="size-3.5" />}
              disabled={!adding}
              loading={saving}
            >
              Aggiungi
            </Button>
          </form>
        ) : (
          <p className="text-[13px] text-fg3">Le lingue le sceglie un amministratore.</p>
        )}
      </section>
    </div>
  )
}
