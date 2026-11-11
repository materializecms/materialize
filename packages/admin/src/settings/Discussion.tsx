import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, ExternalLink, MessageSquare, ShieldAlert, ShieldCheck, Trash2, Undo2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useSession } from '../app/context.ts'
import { Button, EmptyState, Segmented, Spinner, Switch, toast } from '../components/ui.tsx'
import { api, type DiscussionState, type VisitorComment } from '../lib/api.ts'
import { fullDate, relativeTime } from '../lib/format.ts'
import { t, tn } from '../lib/i18n.ts'
import { SettingsHeading, SettingsPage } from './SettingsPage.tsx'

type View = VisitorComment['status']

/** How many comments wait for approval: for the badges on Impostazioni and the Overview. */
export function usePendingComments(): number {
  return (
    useQuery({
      queryKey: ['discussion', { status: 'pending', limit: 1 }],
      queryFn: () => api.discussion({ status: 'pending', limit: 1 }),
      staleTime: 30_000,
    }).data?.pending ?? 0
  )
}

/**
 * Impostazioni → Commenti: what visitors wrote under the articles. Waiting ones are approved or
 * set aside as spam; below, where comments are on and whether each one waits for approval.
 */
export function Discussion() {
  const { user } = useSession()
  const queryClient = useQueryClient()
  const [view, setView] = useState<View>('pending')
  const list = useQuery({
    queryKey: ['discussion', { status: view, limit: 100 }],
    queryFn: () => api.discussion({ status: view, limit: 100 }),
  })
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['discussion'] })
  const items = list.data?.items ?? []

  const act = async (c: VisitorComment, status: View, done: string) => {
    try {
      await api.setCommentStatus(c.id, status)
      toast(done)
      await refresh()
    } catch (error) {
      toast((error as Error).message, 'error')
    }
  }

  return (
    <SettingsPage className="space-y-4">
      <SettingsHeading
        title={t('Commenti')}
        description={t(
          'Quello che i visitatori scrivono sotto gli articoli. Compare sul sito solo dopo l’approvazione.',
        )}
      />
      <Segmented
        size="sm"
        value={view}
        onChange={setView}
        options={[
          {
            value: 'pending',
            label: `${t('Da approvare')}${list.data?.pending ? ` · ${list.data.pending}` : ''}`,
          },
          { value: 'approved', label: t('Approvati') },
          { value: 'spam', label: `Spam${list.data?.spam ? ` · ${list.data.spam}` : ''}` },
        ]}
      />
      {list.isLoading ? (
        <Spinner />
      ) : !items.length ? (
        <EmptyState icon={<MessageSquare />} title={t('Nessun commento qui')}>
          {view === 'pending'
            ? t('I commenti nuovi aspettano qui la tua approvazione.')
            : view === 'spam'
              ? t('Qui finiscono i commenti che sembrano spam: scritti in un attimo, pieni di link o ripetuti.')
              : t('I commenti approvati compaiono sotto i loro articoli.')}
        </EmptyState>
      ) : (
        <ul className="divide-y divide-line">
          {items.map((c) => (
            <li key={c.id} className="py-4">
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-[13px]">
                <span className="font-semibold text-fg">{c.name}</span>
                {c.email && (
                  <a href={`mailto:${c.email}`} className="text-fg3 hover:text-accent hover:underline">
                    {c.email}
                  </a>
                )}
                <span className="text-fg3" title={fullDate(c.createdAt)}>
                  · {relativeTime(c.createdAt)}
                </span>
              </div>
              <a
                href={c.path}
                target="_blank"
                rel="noreferrer"
                className="mt-0.5 inline-flex items-center gap-1 text-[13px] text-fg2 hover:text-accent"
              >
                {c.title || c.path} <ExternalLink className="size-3" />
              </a>
              <p className="mt-2 text-[14px] leading-relaxed break-words whitespace-pre-line">{c.text}</p>
              {c.spam && (
                <p className="mt-1 text-[12.5px] text-warn">{t('Sembra spam: {reason}', { reason: c.spam })}</p>
              )}
              <div className="mt-3 flex flex-wrap gap-2">
                {c.status !== 'approved' && (
                  <Button
                    size="sm"
                    variant={c.status === 'pending' ? 'primary' : 'secondary'}
                    icon={<Check className="size-3.5" />}
                    onClick={() => act(c, 'approved', t('Commento approvato: ora è sul sito'))}
                  >
                    {c.status === 'spam' ? t('Non è spam, approva') : t('Approva')}
                  </Button>
                )}
                {c.status === 'approved' && (
                  <Button
                    size="sm"
                    icon={<Undo2 className="size-3.5" />}
                    onClick={() => act(c, 'pending', t('Commento tolto dal sito'))}
                  >
                    {t('Togli dal sito')}
                  </Button>
                )}
                {c.status !== 'spam' && (
                  <Button
                    size="sm"
                    icon={<ShieldAlert className="size-3.5" />}
                    onClick={() => act(c, 'spam', t('Spostato nello spam'))}
                  >
                    {t('È spam')}
                  </Button>
                )}
                {user.role === 'admin' && (
                  <Button
                    size="sm"
                    className="hover:text-danger"
                    icon={<Trash2 className="size-3.5" />}
                    onClick={async () => {
                      if (!confirm(t('Eliminare il commento di {name}? Non si può recuperare.', { name: c.name })))
                        return
                      await api.removeVisitorComment(c.id)
                      toast(t('Commento eliminato'))
                      await refresh()
                    }}
                  >
                    {t('Elimina')}
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
      <DiscussionSettings editable={user.role === 'admin'} />
    </SettingsPage>
  )
}

/** Where comments are on, and how they go. */
function DiscussionSettings({ editable }: { editable: boolean }) {
  const queryClient = useQueryClient()
  const current = useQuery({ queryKey: ['discussion-settings'], queryFn: api.discussionSettings })
  const [state, setState] = useState<DiscussionState | null>(null)
  const [saving, setSaving] = useState(false)
  useEffect(() => {
    if (current.data) setState(current.data)
  }, [current.data])
  if (!state) return null

  // Only the boxes choose the collections: the switches keep the default ("those with a date")
  // when no box was ever touched. One save at a time, each from what the last one returned.
  const save = async (patch: Partial<DiscussionState['settings']>) => {
    if (saving) return
    setSaving(true)
    try {
      const res = await api.saveDiscussionSettings({ ...state.settings, ...patch })
      queryClient.setQueryData(['discussion-settings'], res)
      setState(res)
      toast(t('Salvato: il sito si aggiorna da solo'))
    } catch (error) {
      toast((error as Error).message, 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="space-y-4 pt-8">
      <SettingsHeading title={t('Dove e come')} />
      {state.collections.length ? (
        <fieldset disabled={!editable || saving} className="space-y-2">
          <legend className="mb-1 text-[13px] font-medium text-fg2">{t('Commenti attivi in')}</legend>
          {state.collections.map((c) => (
            <label key={c.name} className="flex items-center gap-2 text-[14px]">
              <input
                type="checkbox"
                className="size-4 accent-[var(--accent)]"
                checked={state.on.includes(c.name)}
                onChange={(e) =>
                  save({
                    collections: e.target.checked ? [...state.on, c.name] : state.on.filter((n) => n !== c.name),
                  })
                }
              />
              {c.label}
            </label>
          ))}
        </fieldset>
      ) : (
        <p className="text-[13px] text-fg3">{t('Nessuna raccolta ha pagine sul sito.')}</p>
      )}
      <Toggle
        editable={editable && !saving}
        checked={state.settings.moderation}
        onChange={(moderation) => save({ moderation })}
        title={t('Approva ogni commento prima che compaia')}
        text={
          state.settings.moderation
            ? t('Consigliato: niente arriva sul sito senza che tu l’abbia letto.')
            : t('I commenti che passano l’antispam compaiono subito; li togli quando vuoi.')
        }
      />
      <Toggle
        editable={editable && !saving}
        checked={state.settings.notify}
        onChange={(notify) => save({ notify })}
        title={t('Avvisami per email')}
        text={t('Un’email all’indirizzo di Impostazioni → Email per ogni commento nuovo, spam escluso.')}
      />
      <p className="flex items-start gap-2 text-[13px] leading-relaxed text-fg3">
        <ShieldCheck className="mt-0.5 size-3.5 shrink-0" />
        {tn(
          state.on.length,
          'Antispam senza CAPTCHA, come nei moduli. Il modulo dei commenti compare in una raccolta.',
          'Antispam senza CAPTCHA, come nei moduli. Il modulo dei commenti compare in {n} raccolte.',
        )}
      </p>
    </section>
  )
}

function Toggle({
  editable,
  checked,
  onChange,
  title,
  text,
}: {
  editable: boolean
  checked: boolean
  onChange: (value: boolean) => void
  title: string
  text: string
}) {
  return (
    <div className="flex items-start gap-3">
      <Switch checked={checked} onChange={(value) => editable && onChange(value)} label={title} />
      <div>
        <div className="text-[14px] font-medium">{title}</div>
        <div className="text-[13px] text-fg3">{text}</div>
      </div>
    </div>
  )
}
