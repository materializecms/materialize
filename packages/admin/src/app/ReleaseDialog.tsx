import { useQueryClient } from '@tanstack/react-query'
import { Rocket } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Button, cx, Dialog, Input, toast } from '../components/ui.tsx'
import { api, type StoredDocument } from '../lib/api.ts'
import { whenDate } from '../lib/format.ts'
import { t, tn } from '../lib/i18n.ts'
import { navigate } from '../lib/router.ts'
import { releasesKey, useReleases } from './ReleasesScreen.tsx'

type DocRelease = StoredDocument['release']

/** In the document header: the release it goes out with. */
export function ReleaseChip({ release, onClick }: { release: NonNullable<DocRelease>; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={t('Nel rilascio «{name}»', { name: release.name })}
      className="inline-flex h-7 max-w-48 items-center gap-1.5 rounded-md bg-[#f97316]/10 px-2 text-[12px] font-medium text-[#c2410c] hover:bg-[#f97316]/15 dark:text-[#fdba74] [&_svg]:size-3.5 [&_svg]:shrink-0"
    >
      <Rocket />
      <span className="truncate max-md:hidden">
        {release.runAt ? t('Esce {when}', { when: whenDate(release.runAt) }) : release.name}
      </span>
    </button>
  )
}

/**
 * Puts the document in a release (an existing one or a new one), says what happens to it there,
 * or takes it out. The document stays as it is until the release goes out.
 */
export function ReleaseDialog({
  doc,
  open,
  onClose,
  ensureSaved,
  onChange,
  onError,
}: {
  doc: StoredDocument
  open: boolean
  onClose: () => void
  ensureSaved: () => Promise<StoredDocument | null>
  onChange: (release: DocRelease) => void
  onError: (error: unknown) => void
}) {
  const queryClient = useQueryClient()
  const releases = useReleases()
  const list = releases.data?.releases ?? []
  const current = doc.release ?? null
  const [choice, setChoice] = useState<string>('new')
  const [name, setName] = useState('')
  const [action, setAction] = useState<'publish' | 'unpublish'>('publish')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!open) return
    setChoice(current?.id ?? list[0]?.id ?? 'new')
    setAction(current?.action ?? 'publish')
    setName('')
  }, [open, current?.id, current?.action, list[0]?.id])

  const done = async (release: DocRelease) => {
    onChange(release)
    await queryClient.invalidateQueries({ queryKey: releasesKey })
    onClose()
  }

  const add = async () => {
    setBusy(true)
    try {
      const saved = await ensureSaved()
      if (!saved) return
      const id = choice === 'new' ? (await api.createRelease(name.trim())).id : choice
      const release = await api.putReleaseItem(id, saved.id, action)
      toast(t('Aggiunta a «{name}»', { name: release.name }))
      await done({ id: release.id, name: release.name, runAt: release.runAt, action })
    } catch (error) {
      onError(error)
    } finally {
      setBusy(false)
    }
  }

  const remove = async () => {
    if (!current) return
    setBusy(true)
    try {
      await api.removeReleaseItem(current.id, doc.id)
      await done(null)
    } catch (error) {
      onError(error)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      width={440}
      title={current ? t('Nel rilascio «{name}»', { name: current.name }) : t('Aggiungi a un rilascio')}
      footer={
        <>
          {current && (
            <Button variant="ghost" className="mr-auto" disabled={busy} onClick={() => void remove()}>
              {t('Togli dal rilascio')}
            </Button>
          )}
          <Button onClick={onClose}>{t('Annulla')}</Button>
          <Button
            variant="primary"
            loading={busy}
            disabled={choice === 'new' && !name.trim()}
            onClick={() => void add()}
          >
            {current ? t('Salva') : t('Aggiungi')}
          </Button>
        </>
      }
    >
      <div className="space-y-4 text-[13px]">
        <p className="leading-relaxed">
          {t(
            'Le pagine di un rilascio escono tutte insieme, subito o a un’ora stabilita; se una non è pronta non esce niente. Fino ad allora questa pagina resta com’è.',
          )}
        </p>
        <fieldset className="space-y-1">
          <legend className="mb-1.5 font-medium text-fg">{t('Rilascio')}</legend>
          {list.map((r) => (
            <label
              key={r.id}
              className={cx(
                'flex cursor-pointer items-center gap-2.5 rounded-md border px-3 py-2',
                choice === r.id ? 'border-accent bg-accent/5' : 'border-line hover:bg-hover',
              )}
            >
              <input type="radio" name="release" checked={choice === r.id} onChange={() => setChoice(r.id)} />
              <span className="min-w-0 flex-1 truncate font-medium text-fg">{r.name}</span>
              <span className="shrink-0 text-[12px] text-fg3">
                {r.runAt ? t('esce {when}', { when: whenDate(r.runAt) }) : tn(r.items.length, '1 pagina', '{n} pagine')}
              </span>
            </label>
          ))}
          <label
            className={cx(
              'flex cursor-pointer items-center gap-2.5 rounded-md border px-3 py-2',
              choice === 'new' ? 'border-accent bg-accent/5' : 'border-line hover:bg-hover',
            )}
          >
            <input type="radio" name="release" checked={choice === 'new'} onChange={() => setChoice('new')} />
            <span className="font-medium text-fg">{t('Nuovo rilascio')}</span>
          </label>
          {choice === 'new' && (
            <Input
              data-autofocus
              value={name}
              maxLength={120}
              placeholder={t('Nome, es. Collezione inverno')}
              onChange={(e) => setName(e.target.value)}
              className="mt-1"
            />
          )}
        </fieldset>
        <fieldset>
          <legend className="mb-1.5 font-medium text-fg">{t('Quando il rilascio esce')}</legend>
          <div className="flex gap-4">
            <label className="flex items-center gap-1.5">
              <input type="radio" name="action" checked={action === 'publish'} onChange={() => setAction('publish')} />
              {t('Pubblica questa bozza')}
            </label>
            <label className={cx('flex items-center gap-1.5', !doc.publishedAt && 'opacity-50')}>
              <input
                type="radio"
                name="action"
                disabled={!doc.publishedAt}
                checked={action === 'unpublish'}
                onChange={() => setAction('unpublish')}
              />
              {t('Togli dal sito')}
            </label>
          </div>
        </fieldset>
        <button
          type="button"
          onClick={() => {
            onClose()
            navigate({ name: 'releases' })
          }}
          className="text-accent hover:underline"
        >
          {t('Vedi tutti i rilasci')}
        </button>
      </div>
    </Dialog>
  )
}
