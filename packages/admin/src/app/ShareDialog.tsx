import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, Copy, Link2, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Button, Dialog, IconButton, Segmented, Spinner, toast } from '../components/ui.tsx'
import { api, type PreviewLink, type StoredDocument } from '../lib/api.ts'
import { relativeTime, whenDate } from '../lib/format.ts'
import { t, tn } from '../lib/i18n.ts'

type Expiry = '1' | '7' | '30' | 'never'

const EXPIRY = (): { value: Expiry; label: string }[] => [
  { value: '1', label: t('1 giorno') },
  { value: '7', label: t('7 giorni') },
  { value: '30', label: t('30 giorni') },
  { value: 'never', label: t('Senza scadenza') },
]

const copy = (url: string) =>
  navigator.clipboard?.writeText(url).then(
    () => toast(t('Link copiato')),
    () => toast(t('Copia non riuscita: seleziona il link e copialo a mano'), 'error'),
  )

/**
 * Secret links that show the draft with the site's design to someone without an account. They
 * follow later edits: whoever has one sees the latest saved version until it expires or is revoked.
 */
export function ShareDialog({
  doc,
  open,
  onClose,
  ensureSaved,
  onError,
}: {
  doc: StoredDocument
  open: boolean
  onClose: () => void
  /** Saves pending changes first, so the link shows what is on screen; null when saving failed. */
  ensureSaved: () => Promise<StoredDocument | null>
  onError: (error: unknown) => void
}) {
  const queryClient = useQueryClient()
  const key = ['previews', doc.id]
  const links = useQuery({ queryKey: key, queryFn: () => api.previews(doc.id), enabled: open })
  const [expiry, setExpiry] = useState<Expiry>('7')
  const [creating, setCreating] = useState(false)
  const [fresh, setFresh] = useState<string | null>(null)

  const create = async () => {
    setCreating(true)
    try {
      if (!(await ensureSaved())) return
      const link = await api.sharePreview(doc.id, expiry === 'never' ? null : Number(expiry))
      setFresh(link.id)
      await queryClient.invalidateQueries({ queryKey: key })
      await copy(link.url)
    } catch (error) {
      onError(error)
    } finally {
      setCreating(false)
    }
  }

  const revoke = async (link: PreviewLink) => {
    try {
      await api.revokePreview(link.id)
      await queryClient.invalidateQueries({ queryKey: key })
      toast(t('Link revocato: non si apre più'))
    } catch (error) {
      onError(error)
    }
  }

  const items = links.data?.items ?? []
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t('Condividi un’anteprima')}
      width={500}
      footer={<Button onClick={onClose}>{t('Fatto')}</Button>}
    >
      <p className="text-[14px] leading-relaxed text-fg2">
        {t(
          'Chi ha il link vede la pagina con il design del sito, anche senza account e prima che sia pubblicata. Mostra sempre l’ultima versione salvata; i motori di ricerca non la vedono.',
        )}
      </p>
      <div className="mt-4 space-y-2">
        <p className="text-[13px] font-medium">{t('Il link vale')}</p>
        <div className="flex flex-wrap items-center gap-2">
          <Segmented value={expiry} options={EXPIRY()} onChange={setExpiry} size="sm" />
          <Button
            variant="primary"
            size="sm"
            loading={creating}
            onClick={() => void create()}
            icon={<Link2 className="size-3.5" />}
            className="ml-auto"
          >
            {t('Crea e copia il link')}
          </Button>
        </div>
      </div>

      <div className="mt-5">
        <p className="mb-1.5 text-[13px] font-medium">{t('Link attivi')}</p>
        {links.isPending ? (
          <Spinner className="size-4" />
        ) : !items.length ? (
          <p className="text-[13px] text-fg3">{t('Nessun link: questa pagina la vede solo chi entra nel pannello.')}</p>
        ) : (
          <ul className="divide-y divide-line rounded-md border border-line">
            {items.map((link) => (
              <li key={link.id} className="flex items-center gap-2 px-2.5 py-2">
                <div className="min-w-0 flex-1">
                  <input
                    readOnly
                    value={link.url}
                    aria-label={t('Link di anteprima')}
                    onFocus={(e) => e.currentTarget.select()}
                    className="w-full truncate bg-transparent font-mono text-[12px] text-fg outline-none"
                  />
                  <p className="text-[12px] text-fg3">
                    {link.expiresAt ? t('Scade {when}', { when: whenDate(link.expiresAt) }) : t('Senza scadenza')} ·{' '}
                    {t('da {name}', { name: link.createdByName || t('qualcuno') })} ·{' '}
                    {link.views
                      ? tn(link.views, 'aperto una volta, l’ultima {when}', 'aperto {n} volte, l’ultima {when}', {
                          when: relativeTime(link.viewedAt ?? link.createdAt),
                        })
                      : t('mai aperto')}
                  </p>
                </div>
                <IconButton label={t('Copia il link')} onClick={() => void copy(link.url)}>
                  {fresh === link.id ? <Check /> : <Copy />}
                </IconButton>
                <IconButton label={t('Revoca il link')} onClick={() => void revoke(link)}>
                  <Trash2 />
                </IconButton>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Dialog>
  )
}
