import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, ChevronDown, Copy, Languages, Loader2, RefreshCw, Sparkles } from 'lucide-react'
import { useState } from 'react'
import { useAiReady } from '../components/AiMenu.tsx'
import { MenuSeparator, Popover, toast } from '../components/ui.tsx'
import { api, type StoredDocument } from '../lib/api.ts'
import { navigate } from '../lib/router.ts'
import { useSession } from './context.ts'
import { localeName } from './Sidebar.tsx'

const dot = { draft: 'bg-fg3', changed: 'bg-warn', published: 'bg-ok' } as const

/**
 * The document's languages, next to its title: open another language, create a translation (a
 * copy to translate by hand, or translated by the AI), or bring a translation in line with a
 * changed original.
 */
export function LanguageMenu({
  doc,
  collection,
  onSynced,
}: {
  doc: StoredDocument
  collection: string
  onSynced: (doc: StoredDocument) => void
}) {
  const { schema, setLocale } = useSession()
  const queryClient = useQueryClient()
  const ai = useAiReady()
  const [busy, setBusy] = useState<string | null>(null)
  const query = useQuery({
    queryKey: ['translations', doc.id],
    queryFn: () => api.translations(doc.id),
    enabled: schema.locales.available.length > 1,
  })
  if (schema.locales.available.length < 2) return null

  const open = (id: string, locale: string) => {
    setLocale(locale)
    navigate({ name: 'document', collection, id })
  }

  const create = async (locale: string, translate: boolean) => {
    setBusy(locale)
    try {
      const created = await api.translate(doc.id, locale, translate)
      void queryClient.invalidateQueries({ queryKey: ['translations'] })
      void queryClient.invalidateQueries({ queryKey: ['list', collection] })
      toast(
        translate
          ? `Tradotto in ${localeName(locale).toLowerCase()}: rivedilo e pubblicalo`
          : `Copia in ${localeName(locale).toLowerCase()} pronta da tradurre`,
      )
      open(created.id, locale)
    } catch (error) {
      toast((error as Error).message, 'error')
    } finally {
      setBusy(null)
    }
  }

  const sync = async () => {
    setBusy('sync')
    try {
      const res = await api.syncTranslation(doc.id, ai)
      onSynced(res.document)
      toast(
        res.added
          ? `Allineata all’originale: ${res.added} ${res.added === 1 ? 'elemento nuovo' : 'elementi nuovi'}${ai ? ' tradotti' : ''}`
          : 'Allineata all’originale',
      )
    } catch (error) {
      toast((error as Error).message, 'error')
    } finally {
      setBusy(null)
    }
  }

  const translations = query.data?.translations ?? []
  const missing = query.data?.missing ?? []
  const item =
    'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] hover:bg-hover disabled:opacity-50 [&_svg]:size-3.5 [&_svg]:shrink-0'

  return (
    <Popover
      align="start"
      width={268}
      trigger={({ toggle, ref }) => (
        <button
          ref={ref}
          type="button"
          onClick={toggle}
          title="Lingue"
          className="flex h-7 shrink-0 items-center gap-1 rounded-md border border-line px-1.5 font-mono text-[12px] font-medium text-fg2 uppercase hover:bg-hover hover:text-fg [&_svg]:size-3.5"
        >
          {busy ? <Loader2 className="animate-spin" /> : <Languages />}
          {doc.locale}
          <ChevronDown className="opacity-60" />
        </button>
      )}
    >
      {(close) => (
        <div className="p-1">
          <div className="px-2 pt-1 pb-1 text-[12px] font-medium text-fg3">Lingue di questa pagina</div>
          {translations.map((t) => (
            <button
              key={t.id}
              type="button"
              className={item}
              onClick={() => {
                close()
                if (t.id !== doc.id) open(t.id, t.locale)
              }}
            >
              <span className={`size-1.5 shrink-0 rounded-full ${dot[t.status]}`} />
              <span className="flex-1 truncate">
                {localeName(t.locale)}
                {!t.sourceId && <span className="text-fg3"> · originale</span>}
              </span>
              {t.id === doc.id && <Check className="text-accent" />}
            </button>
          ))}
          {missing.length > 0 && (
            <>
              <MenuSeparator />
              <div className="px-2 pt-1 pb-1 text-[12px] font-medium text-fg3">Traduci in</div>
              {missing.map((l) => (
                <div key={l} className="flex items-center gap-1 rounded-md pr-1 hover:bg-hover/50">
                  <span className="flex-1 truncate px-2 py-1.5 text-[13px]">{localeName(l)}</span>
                  {ai && (
                    <button
                      type="button"
                      disabled={!!busy}
                      title="Crea la traduzione con l’AI"
                      onClick={() => {
                        close()
                        void create(l, true)
                      }}
                      className="flex h-6 items-center gap-1 rounded-md px-1.5 text-[12px] font-medium text-accent hover:bg-accent/10 disabled:opacity-50 [&_svg]:size-3"
                    >
                      <Sparkles /> AI
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={!!busy}
                    title="Crea una copia da tradurre a mano"
                    onClick={() => {
                      close()
                      void create(l, false)
                    }}
                    className="flex h-6 items-center gap-1 rounded-md px-1.5 text-[12px] font-medium text-fg2 hover:bg-hover hover:text-fg disabled:opacity-50 [&_svg]:size-3"
                  >
                    <Copy /> Copia
                  </button>
                </div>
              ))}
            </>
          )}
          {doc.sourceId && (
            <>
              <MenuSeparator />
              <button
                type="button"
                className={item}
                disabled={!!busy}
                onClick={() => {
                  close()
                  void sync()
                }}
              >
                <RefreshCw />
                <span className="flex-1">
                  Allinea all’originale
                  <span className="block text-[12px] text-fg3">
                    Struttura e stile dell’originale, testi tradotti tenuti{ai ? ', nuovi testi tradotti' : ''}
                  </span>
                </span>
              </button>
            </>
          )}
        </div>
      )}
    </Popover>
  )
}
