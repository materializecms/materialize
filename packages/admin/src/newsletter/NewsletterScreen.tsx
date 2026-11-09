import type { RichText } from '@materializecms/core'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft,
  CalendarClock,
  Download,
  FileText,
  Mail,
  Plus,
  Search,
  Send,
  Sparkles,
  Trash2,
  Upload,
  UserPlus,
  Users,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useSession } from '../app/context.ts'
import { When } from '../app/ScheduleMenu.tsx'
import { useAiReady } from '../components/AiMenu.tsx'
import {
  Button,
  cx,
  Dialog,
  EmptyState,
  IconButton,
  Input,
  MenuItem,
  Popover,
  ScreenHeader,
  Segmented,
  Spinner,
  Switch,
  Textarea,
  toast,
} from '../components/ui.tsx'
import { RichTextEditor } from '../fields/RichTextEditor.tsx'
import { api, type DocumentSummary, type Newsletter, type Subscriber } from '../lib/api.ts'
import { fullDate, relativeTime, whenDate } from '../lib/format.ts'
import { t, tn } from '../lib/i18n.ts'
import { navigate } from '../lib/router.ts'

const STATUS = (): Record<Newsletter['status'], { label: string; tone: string }> => ({
  draft: { label: t('Bozza'), tone: 'bg-seg text-fg2' },
  scheduled: { label: t('Programmata'), tone: 'bg-accent/12 text-accent' },
  sending: { label: t('In invio'), tone: 'bg-warn/12 text-warn' },
  sent: { label: t('Inviata'), tone: 'bg-ok/12 text-ok' },
  failed: { label: t('Non inviata'), tone: 'bg-danger/10 text-danger' },
})

const percent = (part: number, whole: number) => (whole ? `${Math.round((part / whole) * 100)}%` : '–')

const fail = (error: unknown) => toast(error instanceof Error ? error.message : t('Errore'), 'error')

/** The newsletter: what was sent and is being written, who receives it, and one newsletter open. */
export function NewsletterScreen({ view }: { view?: string }) {
  const counts = useQuery({ queryKey: ['subscribers', 'counts'], queryFn: () => api.subscribers({ limit: 1 }) })
  const active = counts.data?.counts.active ?? 0
  if (view && view !== 'subscribers') return <Editor id={view} active={active} />
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <ScreenHeader
        icon={<Mail />}
        color="#ec4899"
        title="Newsletter"
        subtitle={counts.isPending ? '' : tn(active, 'Un iscritto attivo', '{n} iscritti attivi')}
        actions={view === 'subscribers' ? null : <NewMenu />}
      >
        <div className="mt-5 max-w-xs">
          <Segmented
            className="flex w-full"
            value={view === 'subscribers' ? 'subscribers' : 'letters'}
            onChange={(v) => navigate({ name: 'newsletter', view: v === 'subscribers' ? 'subscribers' : undefined })}
            options={[
              { value: 'letters', label: 'Newsletter' },
              { value: 'subscribers', label: `${t('Iscritti')}${counts.data ? ` · ${active}` : ''}` },
            ]}
          />
        </div>
      </ScreenHeader>
      <div className="mx-auto w-full max-w-[920px] px-4 pt-6 pb-20 sm:px-8">
        {view === 'subscribers' ? <Subscribers /> : <Letters />}
      </div>
    </div>
  )
}

/** A new newsletter: empty, from an article, or written by the AI from the latest articles. */
function NewMenu() {
  const aiReady = useAiReady()
  const [picking, setPicking] = useState(false)
  const [busy, setBusy] = useState(false)
  const open = (n: Newsletter) => navigate({ name: 'newsletter', view: n.id })
  const run = async (fn: () => Promise<Newsletter>) => {
    setBusy(true)
    try {
      open(await fn())
    } catch (error) {
      fail(error)
    } finally {
      setBusy(false)
    }
  }
  return (
    <>
      <Popover
        align="end"
        width={280}
        trigger={({ toggle, ref }) => (
          <Button ref={ref} variant="primary" loading={busy} icon={<Plus className="size-4" />} onClick={toggle}>
            {t('Nuova newsletter')}
          </Button>
        )}
      >
        {(close) => (
          <div className="p-1">
            <MenuItem
              icon={<Mail />}
              onClick={() => {
                close()
                void run(() => api.createNewsletter({ subject: t('Senza oggetto') }))
              }}
            >
              <span className="block">{t('Vuota')}</span>
              <span className="block text-[12px] font-normal text-fg3">{t('Scrivi da zero')}</span>
            </MenuItem>
            <MenuItem
              icon={<FileText />}
              onClick={() => {
                close()
                setPicking(true)
              }}
            >
              <span className="block">{t('Da un articolo')}</span>
              <span className="block text-[12px] font-normal text-fg3">
                {t('Titolo, testo e link per leggerlo sul sito')}
              </span>
            </MenuItem>
            {aiReady && (
              <MenuItem
                icon={<Sparkles />}
                onClick={() => {
                  close()
                  void run(() => api.aiNewsletter({ count: 3 }))
                }}
              >
                <span className="block">{t('Scritta dall’AI')}</span>
                <span className="block text-[12px] font-normal text-fg3">
                  {t('Dagli ultimi articoli, con la voce del brand')}
                </span>
              </MenuItem>
            )}
          </div>
        )}
      </Popover>
      {picking && (
        <ArticlePicker
          onClose={() => setPicking(false)}
          onPick={(id) => {
            setPicking(false)
            void run(() => api.newsletterFromDocument(id))
          }}
        />
      )}
    </>
  )
}

function ArticlePicker({ onClose, onPick }: { onClose: () => void; onPick: (id: string) => void }) {
  const { schema, locale } = useSession()
  const [search, setSearch] = useState('')
  const lists = schema.collections.filter((c) => !c.singleton)
  const results = useQuery({
    queryKey: ['newsletter-articles', search, locale],
    queryFn: async () => {
      const found: (DocumentSummary & { label: string })[] = []
      for (const c of lists) {
        const { items } = await api.list(c.name, { locale, search, limit: 8 })
        for (const i of items) if (i.status !== 'draft') found.push({ ...i, label: c.label })
      }
      return found
    },
  })
  return (
    <Dialog open onClose={onClose} title={t('Da quale articolo?')} width={460}>
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-fg3" />
        <Input
          data-autofocus
          value={search}
          placeholder={t('Cerca tra i contenuti pubblicati')}
          onChange={(e) => setSearch(e.target.value)}
          className="h-9 pl-8"
        />
      </div>
      <ul className="mt-2 max-h-80 overflow-y-auto">
        {results.isPending ? (
          <li className="flex justify-center py-6">
            <Spinner />
          </li>
        ) : !results.data?.length ? (
          <li className="px-2 py-4 text-[13px] text-fg3">{t('Niente di pubblicato con queste parole.')}</li>
        ) : (
          results.data.map((d) => (
            <li key={d.id}>
              <button
                type="button"
                onClick={() => onPick(d.id)}
                className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-[13.5px] hover:bg-hover"
              >
                <span className="min-w-0 flex-1 truncate font-medium text-fg">{d.title}</span>
                <span className="shrink-0 text-[12px] text-fg3">{d.label}</span>
              </button>
            </li>
          ))
        )}
      </ul>
    </Dialog>
  )
}

function Letters() {
  const query = useQuery({ queryKey: ['newsletters'], queryFn: api.newsletters, refetchInterval: 15_000 })
  const list = query.data?.newsletters ?? []
  if (query.isPending)
    return (
      <div className="flex justify-center py-16">
        <Spinner />
      </div>
    )
  if (!list.length)
    return (
      <EmptyState icon={<Mail />} title={t('Ancora nessuna newsletter')}>
        <p>
          {t(
            'Scrivila da zero, parti da un articolo del sito o falla preparare all’AI dagli ultimi articoli. Prima di mandarla agli iscritti puoi inviarne una prova a te.',
          )}
        </p>
        <p className="mt-2">
          {t(
            'Per raccogliere iscritti, aggiungi a una pagina una sezione con l’iscrizione dalla libreria ({sections}).',
            {
              sections: 'Invito → Newsletter, Footer → Con iscrizione',
            },
          )}
        </p>
      </EmptyState>
    )
  return (
    <ul className="divide-y divide-line rounded-xl border border-line bg-panel">
      {list.map((n) => (
        <li key={n.id}>
          <button
            type="button"
            onClick={() => navigate({ name: 'newsletter', view: n.id })}
            className="flex w-full flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 text-left hover:bg-hover"
          >
            <span className="min-w-40 flex-1">
              <span className="block truncate font-medium">{n.subject}</span>
              <span className="block truncate text-[12.5px] text-fg3">
                {n.status === 'sent' && n.sentAt
                  ? t('Inviata {when}', { when: relativeTime(n.sentAt) })
                  : n.status === 'scheduled' && n.runAt
                    ? t('Parte {when}', { when: whenDate(n.runAt) })
                    : t('Modificata {when} · {name}', { when: relativeTime(n.updatedAt), name: n.createdByName })}
              </span>
            </span>
            {n.status === 'sent' && (
              <span className="flex gap-4 text-[12.5px] text-fg2 tabular-nums">
                <span title={t('Email consegnate al servizio di posta')}>{t('{n} inviate', { n: n.stats.sent })}</span>
                <span title={t('Chi ha aperto l’email (se le immagini non sono bloccate)')}>
                  {t('{percent} aperture', { percent: percent(n.stats.opened, n.stats.sent) })}
                </span>
                <span title={t('Chi ha seguito almeno un link')}>
                  {t('{percent} clic', { percent: percent(n.stats.clicked, n.stats.sent) })}
                </span>
              </span>
            )}
            <span className={cx('rounded-full px-2 py-0.5 text-[12px] font-medium', STATUS()[n.status].tone)}>
              {STATUS()[n.status].label}
            </span>
          </button>
        </li>
      ))}
    </ul>
  )
}

/** One newsletter: written while a draft, tried, sent or scheduled; once sent, its numbers. */
function Editor({ id, active }: { id: string; active: number }) {
  const queryClient = useQueryClient()
  const { user } = useSession()
  const query = useQuery({
    queryKey: ['newsletter', id],
    queryFn: () => api.newsletter(id),
    refetchInterval: (q) => (q.state.data?.status === 'sending' ? 3000 : false),
  })
  const n = query.data
  const [subject, setSubject] = useState('')
  const [preheader, setPreheader] = useState('')
  const [body, setBody] = useState<RichText>([])
  const [dirty, setDirty] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [confirm, setConfirm] = useState(false)
  const [testTo, setTestTo] = useState(user.email)
  const loaded = useRef<string | null>(null)

  useEffect(() => {
    if (!n || loaded.current === n.id) return
    loaded.current = n.id
    setSubject(n.subject)
    setPreheader(n.preheader)
    setBody(n.body)
  }, [n])

  const locked = !!n && (n.status === 'sent' || n.status === 'sending')
  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ['newsletter', id] })
    void queryClient.invalidateQueries({ queryKey: ['newsletters'] })
  }
  const save = async () => {
    if (!dirty || locked) return
    const saved = await api.saveNewsletter(id, { subject: subject.trim() || t('Senza oggetto'), preheader, body })
    queryClient.setQueryData(['newsletter', id], saved)
    setDirty(false)
  }
  // Saved by itself a moment after the last change.
  // biome-ignore lint/correctness/useExhaustiveDependencies: save reads the latest values
  useEffect(() => {
    if (!dirty) return
    const timer = setTimeout(() => void save().catch(fail), 1200)
    return () => clearTimeout(timer)
  }, [dirty, subject, preheader, body])

  const act = async (name: string, fn: () => Promise<unknown>, done?: string) => {
    setBusy(name)
    try {
      await save()
      await fn()
      if (done) toast(done)
      refresh()
    } catch (error) {
      fail(error)
    } finally {
      setBusy(null)
    }
  }

  if (query.isPending)
    return (
      <div className="flex flex-1 justify-center py-16">
        <Spinner />
      </div>
    )
  if (!n)
    return (
      <EmptyState icon={<Mail />} title={t('Questa newsletter non esiste')}>
        <Button onClick={() => navigate({ name: 'newsletter' })}>{t('Torna alle newsletter')}</Button>
      </EmptyState>
    )

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <header className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-3 sm:px-6">
        <IconButton
          label={t('Torna alle newsletter')}
          onClick={() => void save().then(() => navigate({ name: 'newsletter' }))}
        >
          <ArrowLeft />
        </IconButton>
        <span className={cx('rounded-full px-2 py-0.5 text-[12px] font-medium', STATUS()[n.status].tone)}>
          {STATUS()[n.status].label}
          {n.status === 'scheduled' && n.runAt ? ` · ${whenDate(n.runAt)}` : ''}
        </span>
        <span className="text-[12.5px] text-fg3">{dirty ? t('Da salvare…') : locked ? '' : t('Salvata')}</span>
        <span className="flex-1" />
        {!locked && (
          <>
            <Popover
              align="end"
              width={300}
              trigger={({ toggle, ref }) => (
                <Button ref={ref} size="sm" icon={<Mail className="size-3.5" />} onClick={toggle}>
                  {t('Invia una prova')}
                </Button>
              )}
            >
              {(close) => (
                <form
                  className="space-y-2 p-3"
                  onSubmit={(e) => {
                    e.preventDefault()
                    close()
                    void act(
                      'test',
                      () => api.testNewsletter(id, testTo),
                      t('Prova inviata a {email}', { email: testTo }),
                    )
                  }}
                >
                  <span className="block text-[13px] font-medium">{t('A quale indirizzo?')}</span>
                  <Input type="email" required value={testTo} onChange={(e) => setTestTo(e.target.value)} />
                  <p className="text-[12px] text-fg3">
                    {t('Non conta nelle statistiche e il link per disiscriversi non funziona.')}
                  </p>
                  <Button type="submit" size="sm" variant="primary" loading={busy === 'test'} className="w-full">
                    {t('Invia la prova')}
                  </Button>
                </form>
              )}
            </Popover>
            <Popover
              align="end"
              width={300}
              trigger={({ toggle, ref }) => (
                <Button ref={ref} size="sm" icon={<CalendarClock className="size-3.5" />} onClick={toggle}>
                  {n.status === 'scheduled' ? t('Cambia ora') : t('Programma')}
                </Button>
              )}
            >
              {() => (
                <div className="p-3.5">
                  <When
                    title={t('Parte il')}
                    hint={t(
                      'Va a tutti gli iscritti attivi in quel momento (oggi {n}). Fino ad allora puoi modificarla.',
                      {
                        n: active,
                      },
                    )}
                    current={
                      n.status === 'scheduled' && n.runAt ? { runAt: n.runAt, createdByName: n.createdByName } : null
                    }
                    onSet={async (at) => {
                      await save()
                      await api.scheduleNewsletter(id, at)
                      refresh()
                      if (at) toast(t('Partirà {when}', { when: whenDate(at) }))
                    }}
                    onError={fail}
                  />
                </div>
              )}
            </Popover>
            <Button
              size="sm"
              variant="primary"
              icon={<Send className="size-3.5" />}
              disabled={!active}
              title={active ? undefined : t('Non ci sono ancora iscritti attivi')}
              onClick={() => setConfirm(true)}
            >
              {t('Invia ora')}
            </Button>
          </>
        )}
      </header>

      <div className="mx-auto w-full max-w-[720px] space-y-4 px-4 py-6 sm:px-6">
        {n.status === 'failed' && n.error && (
          <p className="rounded-lg bg-danger/10 px-3 py-2 text-[13px] text-danger">{n.error}</p>
        )}
        {(n.status === 'sent' || n.status === 'sending') && <Numbers n={n} />}
        <label className="block">
          <span className="mb-1.5 block text-[13px] font-medium text-fg2">{t('Oggetto')}</span>
          <Input
            value={subject}
            disabled={locked}
            maxLength={200}
            onChange={(e) => {
              setSubject(e.target.value)
              setDirty(true)
            }}
            className="text-[15px] font-medium"
          />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-[13px] font-medium text-fg2">
            {t('Anteprima')}{' '}
            <span className="font-normal text-fg3">· {t('la frase che molte app mostrano dopo l’oggetto')}</span>
          </span>
          <Input
            value={preheader}
            disabled={locked}
            maxLength={200}
            onChange={(e) => {
              setPreheader(e.target.value)
              setDirty(true)
            }}
          />
        </label>
        <div>
          <span className="mb-1.5 block text-[13px] font-medium text-fg2">{t('Testo')}</span>
          {locked ? (
            <div className="pointer-events-none opacity-80">
              <RichTextEditor value={body} onChange={() => {}} />
            </div>
          ) : (
            <RichTextEditor
              value={body}
              onChange={(v) => {
                setBody(v)
                setDirty(true)
              }}
            />
          )}
        </div>
        {!locked && (
          <div className="flex justify-between gap-2 pt-2">
            <Button
              variant="ghost"
              icon={<Trash2 className="size-3.5" />}
              onClick={() =>
                void act('remove', async () => {
                  await api.removeNewsletter(id)
                  navigate({ name: 'newsletter' })
                })
              }
            >
              {t('Elimina')}
            </Button>
            <p className="self-center text-[12px] text-fg3">
              {t('In fondo a ogni email: il link per disiscriversi e i dati del mittente (Iscritti → Impostazioni).')}
            </p>
          </div>
        )}
      </div>

      <Dialog
        open={confirm}
        onClose={() => setConfirm(false)}
        title={tn(active, 'Inviare a un iscritto?', 'Inviare a {n} iscritti?')}
        footer={
          <>
            <Button onClick={() => setConfirm(false)}>{t('Annulla')}</Button>
            <Button
              variant="primary"
              loading={busy === 'send'}
              icon={<Send className="size-3.5" />}
              onClick={() => {
                setConfirm(false)
                void act('send', () => api.sendNewsletter(id), t('Invio partito'))
              }}
            >
              {t('Invia adesso')}
            </Button>
          </>
        }
      >
        {t(
          '«{subject}» parte subito per tutti gli iscritti attivi, una email alla volta. Dopo non si può più modificare.',
          {
            subject,
          },
        )}
      </Dialog>
    </div>
  )
}

function Numbers({ n }: { n: Newsletter }) {
  const s = n.stats
  const cells = [
    {
      label: t('Inviate'),
      value: `${s.sent}`,
      hint: s.pending ? t('{n} in coda', { n: s.pending }) : s.failed ? t('{n} non riuscite', { n: s.failed }) : '',
    },
    { label: t('Aperture'), value: percent(s.opened, s.sent), hint: tn(s.opened, 'una persona', '{n} persone') },
    { label: t('Clic sui link'), value: percent(s.clicked, s.sent), hint: tn(s.clicked, 'una persona', '{n} persone') },
    { label: t('Disiscritti'), value: `${s.unsubscribed}`, hint: '' },
  ]
  return (
    <section className="space-y-2">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {cells.map((c) => (
          <div key={c.label} className="rounded-xl border border-line bg-panel p-3">
            <span className="block text-[12.5px] text-fg2">{c.label}</span>
            <span className="block text-[22px] font-semibold tracking-[-0.03em] tabular-nums">{c.value}</span>
            <span className="block text-[12px] text-fg3">{c.hint}</span>
          </div>
        ))}
      </div>
      <p className="text-[12px] text-fg3">
        {n.sentAt ? `${t('Inviata il {date}.', { date: fullDate(n.sentAt) })} ` : ''}
        {t('Le aperture sono una stima: alcune app di posta bloccano le immagini, altre le aprono da sole.')}
      </p>
    </section>
  )
}

function Subscribers() {
  const { user } = useSession()
  const queryClient = useQueryClient()
  const [status, setStatus] = useState<'all' | Subscriber['status']>('all')
  const [search, setSearch] = useState('')
  const [adding, setAdding] = useState(false)
  const [email, setEmail] = useState('')
  const file = useRef<HTMLInputElement>(null)
  const admin = user.role === 'admin'
  const query = useQuery({
    queryKey: ['subscribers', status, search],
    queryFn: () =>
      api.subscribers({ status: status === 'all' ? undefined : status, search: search || undefined, limit: 200 }),
  })
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['subscribers'] })
  const counts = query.data?.counts

  const importFile = async (f: File | undefined) => {
    if (!f) return
    try {
      const res = await api.importSubscribers(await f.text())
      toast(
        [
          t('{n} aggiunti', { n: res.added }),
          res.skipped ? t('{n} già iscritti', { n: res.skipped }) : '',
          res.unsubscribed ? t('{n} disiscritti lasciati fuori', { n: res.unsubscribed }) : '',
        ]
          .filter(Boolean)
          .join(', '),
      )
      void refresh()
    } catch (error) {
      fail(error)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Segmented
          size="sm"
          value={status}
          onChange={setStatus}
          options={[
            { value: 'all', label: t('Tutti') },
            { value: 'active', label: `${t('Attivi')}${counts ? ` ${counts.active}` : ''}` },
            { value: 'pending', label: `${t('Da confermare')}${counts ? ` ${counts.pending}` : ''}` },
            { value: 'unsubscribed', label: `${t('Disiscritti')}${counts ? ` ${counts.unsubscribed}` : ''}` },
          ]}
        />
        <div className="relative min-w-40 flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-fg3" />
          <Input
            value={search}
            placeholder={t('Cerca')}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 pl-8"
          />
        </div>
        {admin && (
          <>
            <Button size="sm" icon={<UserPlus className="size-3.5" />} onClick={() => setAdding(true)}>
              {t('Aggiungi')}
            </Button>
            <Button size="sm" icon={<Upload className="size-3.5" />} onClick={() => file.current?.click()}>
              {t('Importa CSV')}
            </Button>
            <input
              ref={file}
              type="file"
              accept=".csv,text/csv,text/plain"
              hidden
              onChange={(e) => {
                void importFile(e.target.files?.[0])
                e.target.value = ''
              }}
            />
            <a
              href={api.subscribersCsv()}
              className="inline-flex h-7 items-center gap-1.5 rounded-md border border-line2 bg-panel px-2.5 text-[13px] font-medium hover:bg-hover [&_svg]:size-3.5"
            >
              <Download /> {t('Esporta')}
            </a>
          </>
        )}
      </div>

      {query.isPending ? (
        <div className="flex justify-center py-12">
          <Spinner />
        </div>
      ) : !query.data?.items.length ? (
        <EmptyState
          icon={<Users />}
          title={search || status !== 'all' ? t('Nessun iscritto qui') : t('Ancora nessun iscritto')}
        >
          <p>
            {t(
              'Le persone si iscrivono dal modulo di una sezione con l’iscrizione ({sections}) e confermano dal link che ricevono per email. Puoi anche importare un CSV da Mailchimp, Brevo o un foglio di calcolo.',
              { sections: 'Invito → Newsletter, Footer → Con iscrizione' },
            )}
          </p>
        </EmptyState>
      ) : (
        <ul className="divide-y divide-line rounded-xl border border-line bg-panel">
          {query.data.items.map((s) => (
            <li key={s.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5">
              <span className="min-w-48 flex-1">
                <span className="block truncate font-medium">{s.email}</span>
                <span className="block truncate text-[12.5px] text-fg3">
                  {[
                    s.name,
                    s.source === 'import'
                      ? t('importato')
                      : s.source === 'panel'
                        ? t('aggiunto dal pannello')
                        : s.source,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </span>
              </span>
              <span
                className={cx(
                  'rounded-full px-2 py-0.5 text-[12px] font-medium',
                  s.status === 'active'
                    ? 'bg-ok/12 text-ok'
                    : s.status === 'pending'
                      ? 'bg-warn/12 text-warn'
                      : 'bg-seg text-fg3',
                )}
              >
                {s.status === 'active' ? t('Attivo') : s.status === 'pending' ? t('Da confermare') : t('Disiscritto')}
              </span>
              <span className="w-28 text-right text-[12.5px] text-fg3" title={fullDate(s.createdAt)}>
                {relativeTime(s.confirmedAt ?? s.createdAt)}
              </span>
              {admin && (
                <IconButton
                  label={t('Elimina i dati di questo iscritto')}
                  onClick={async () => {
                    if (!confirm(t('Eliminare {email} e i suoi dati? Non riceverà più niente.', { email: s.email })))
                      return
                    try {
                      await api.removeSubscriber(s.id)
                      void refresh()
                    } catch (error) {
                      fail(error)
                    }
                  }}
                >
                  <Trash2 />
                </IconButton>
              )}
            </li>
          ))}
        </ul>
      )}

      {admin && <NewsletterSettings />}

      <Dialog
        open={adding}
        onClose={() => setAdding(false)}
        title={t('Aggiungi un iscritto')}
        footer={
          <>
            <Button onClick={() => setAdding(false)}>{t('Annulla')}</Button>
            <Button
              variant="primary"
              disabled={!email.trim()}
              onClick={async () => {
                try {
                  const res = await api.addSubscriber({ email: email.trim() })
                  toast(
                    res.mailed
                      ? t('Gli abbiamo mandato l’email per confermare')
                      : t('Aggiunto: dovrà confermare, ma l’email non è configurata'),
                  )
                  setEmail('')
                  setAdding(false)
                  void refresh()
                } catch (error) {
                  fail(error)
                }
              }}
            >
              {t('Aggiungi')}
            </Button>
          </>
        }
      >
        <Input
          data-autofocus
          type="email"
          value={email}
          placeholder={t('nome@esempio.it')}
          onChange={(e) => setEmail(e.target.value)}
        />
        <p className="mt-2 text-[12.5px] text-fg3">
          {t(
            'Riceverà un’email per confermare: il consenso deve darlo lui. Per chi ha già acconsentito altrove, usa Importa CSV.',
          )}
        </p>
      </Dialog>
    </div>
  )
}

function NewsletterSettings() {
  const query = useQuery({ queryKey: ['newsletter-settings'], queryFn: api.newsletterSettings })
  const [footer, setFooter] = useState<string | null>(null)
  const [tracking, setTracking] = useState<boolean | null>(null)
  const value = { footer: footer ?? query.data?.footer ?? '', tracking: tracking ?? query.data?.tracking ?? true }
  const changed = footer !== null || tracking !== null
  return (
    <section className="space-y-3 rounded-xl border border-line bg-panel p-4">
      <h2 className="text-[14px] font-semibold">{t('Impostazioni')}</h2>
      <label className="block">
        <span className="mb-1.5 block text-[13px] font-medium text-fg2">{t('Mittente, in fondo a ogni email')}</span>
        <Textarea
          rows={2}
          value={value.footer}
          placeholder={t('Studio Rossi · via Roma 1, 20100 Milano · P. IVA 01234567890')}
          onChange={(e) => setFooter(e.target.value)}
        />
        <span className="mt-1 block text-[12px] text-fg3">
          {t('Nome e indirizzo di chi invia: in molti paesi la legge li chiede in ogni newsletter.')}
        </span>
      </label>
      <label className="flex items-start gap-3">
        <Switch checked={value.tracking} onChange={setTracking} label={t('Statistiche')} />
        <span className="text-[13px] leading-relaxed">
          <span className="block font-medium">{t('Aperture e clic')}</span>
          <span className="text-fg3">
            {t(
              'Un’immagine invisibile e i link che passano dal sito dicono chi apre e chi clicca. Va scritto nell’informativa privacy.',
            )}
          </span>
        </span>
      </label>
      {changed && (
        <Button
          size="sm"
          variant="primary"
          onClick={async () => {
            try {
              await api.saveNewsletterSettings(value)
              setFooter(null)
              setTracking(null)
              await query.refetch()
              toast(t('Impostazioni salvate'))
            } catch (error) {
              fail(error)
            }
          }}
        >
          {t('Salva')}
        </Button>
      )}
    </section>
  )
}
