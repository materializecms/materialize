import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  CircleAlert,
  CircleCheck,
  CircleX,
  Download,
  FileText,
  Info,
  LogIn,
  Settings,
  ShieldCheck,
  Trash2,
  UserRound,
} from 'lucide-react'
import { type ReactNode, useState } from 'react'
import { useSession } from '../app/context.ts'
import { Button, cx, EmptyState, IconButton, Segmented, Spinner, Switch, toast } from '../components/ui.tsx'
import { type ActivityEntry, api, type SecurityCheck } from '../lib/api.ts'
import { fullDate, relativeTime, whenDate } from '../lib/format.ts'
import { t, tn, tx } from '../lib/i18n.ts'
import { navigate } from '../lib/router.ts'
import { OffsiteBackup } from './OffsiteBackup.tsx'
import { linkButton, SettingsHeading, SettingsPage } from './SettingsPage.tsx'

const STATUS: Record<SecurityCheck['status'], { icon: ReactNode; tone: string }> = {
  bad: { icon: <CircleX />, tone: 'text-danger' },
  warn: { icon: <CircleAlert />, tone: 'text-warn' },
  ok: { icon: <CircleCheck />, tone: 'text-ok' },
  info: { icon: <Info />, tone: 'text-fg3' },
}

const SETTINGS = (): Record<string, string> => ({
  theme: t('il tema'),
  mail: t('l’invio delle email'),
  ai: t('il modello AI'),
  editorial: t('i permessi dei redattori'),
  seo: t('la SEO del sito'),
  redirects: t('i reindirizzamenti'),
  languages: t('le lingue del sito'),
  backups: t('i backup automatici'),
  tracking: t('tracciamento e cookie'),
  updates: t('gli aggiornamenti automatici'),
  voice: t('la voce del brand'),
  forms: t('la conservazione dei messaggi'),
  newsletter: t('le impostazioni della newsletter'),
})

/** One line of the log in words: "ha pubblicato “Chi siamo”". The person's name comes before it. */
export function describe(e: ActivityEntry): { text: string; group: 'access' | 'people' | 'content' | 'settings' } {
  const d = e.detail ?? {}
  const name = e.target ? `“${e.target}”` : ''
  const target = e.target
  const when = (at: unknown) => whenDate(String(at))
  const message = String(d.message ?? '')
  const unpublish = d.action === 'unpublish'
  const [kind, what = ''] = e.action.split('.')
  switch (e.action) {
    case 'login.ok':
      return { text: d.twoFactor ? t('è entrato con la verifica in due passaggi') : t('è entrato'), group: 'access' }
    case 'login.failed':
      return {
        text: d.known
          ? t('password sbagliata per {target}', { target })
          : t('password sbagliata per {target} (nessun account con questo indirizzo)', { target }),
        group: 'access',
      }
    case 'login.code_failed':
      return { text: t('codice di verifica sbagliato per {target}', { target }), group: 'access' }
    case 'login.blocked':
      return { text: t('tentativo di accesso in pausa per {target}', { target }), group: 'access' }
    case 'password.forgot':
      return { text: t('ha chiesto un link per una nuova password'), group: 'access' }
    case 'password.reset_cli':
      return { text: t('link per una nuova password creato dal server per {target}', { target }), group: 'access' }
    case 'logout':
      return { text: t('è uscito'), group: 'access' }
    case 'session.ended':
      return { text: t('ha disconnesso un dispositivo'), group: 'access' }
    case 'session.ended_others':
      return { text: t('ha disconnesso gli altri dispositivi'), group: 'access' }
    case 'twofactor.enabled':
      return { text: t('ha attivato la verifica in due passaggi'), group: 'access' }
    case 'twofactor.disabled':
      return { text: t('ha disattivato la verifica in due passaggi'), group: 'access' }
    case 'twofactor.recovery':
      return { text: t('ha creato nuovi codici di riserva'), group: 'access' }
    case 'twofactor.reset':
      return { text: t('ha disattivato la verifica in due passaggi di {target}', { target }), group: 'access' }
    case 'token.created':
      return { text: t('ha creato il token {name}', { name }), group: 'access' }
    case 'token.revoked':
      return { text: t('ha revocato un token'), group: 'access' }
    case 'security.require_2fa':
      return { text: t('ha richiesto a tutti la verifica in due passaggi'), group: 'access' }
    case 'security.optional_2fa':
      return { text: t('ha reso facoltativa la verifica in due passaggi'), group: 'access' }
    case 'user.setup':
      return { text: t('ha creato il pannello del sito'), group: 'people' }
    case 'user.invited':
      return {
        text:
          d.role === 'admin'
            ? t('ha invitato {target} come amministratore', { target })
            : t('ha invitato {target} come redattore', { target }),
        group: 'people',
      }
    case 'user.invite_revoked':
      return { text: t('ha annullato un invito'), group: 'people' }
    case 'user.joined':
      return { text: t('ha accettato l’invito'), group: 'people' }
    case 'user.password':
      return { text: t('ha cambiato la password'), group: 'people' }
    case 'user.password_reset':
      return { text: t('ha scelto una nuova password dal link'), group: 'people' }
    case 'user.reset_link':
      return { text: t('ha creato un link per una nuova password per {target}', { target }), group: 'people' }
    case 'user.email':
      return {
        text: d.from
          ? t('ha cambiato l’email {from} → {target}', { from: String(d.from), target })
          : t('ha cambiato l’email in {target}', { target }),
        group: 'people',
      }
    case 'user.role':
      return {
        text:
          d.role === 'admin'
            ? t('ha reso {target} amministratore', { target })
            : t('ha reso {target} redattore', { target }),
        group: 'people',
      }
    case 'user.removed':
      return { text: t('ha rimosso {target}', { target }), group: 'people' }
    case 'document.created':
      return { text: t('ha creato {name}', { name }), group: 'content' }
    case 'document.published':
      return {
        text: d.scheduled ? t('ha pubblicato {name}, come programmato', { name }) : t('ha pubblicato {name}', { name }),
        group: 'content',
      }
    case 'document.unpublished':
      return {
        text: d.scheduled
          ? t('ha tolto dal sito {name}, come programmato', { name })
          : t('ha tolto dal sito {name}', { name }),
        group: 'content',
      }
    case 'document.scheduled':
      return {
        text: unpublish
          ? t('ha programmato la rimozione dal sito di {name} per {when}', { name, when: when(d.at) })
          : t('ha programmato la pubblicazione di {name} per {when}', { name, when: when(d.at) }),
        group: 'content',
      }
    case 'document.schedule_cancelled':
      return {
        text: unpublish
          ? t('ha annullato la rimozione dal sito programmata di {name}', { name })
          : t('ha annullato la pubblicazione programmata di {name}', { name }),
        group: 'content',
      }
    case 'release.created':
      return { text: t('ha creato il rilascio {name}', { name }), group: 'content' }
    case 'release.item_added': {
      const release = String(d.release ?? '')
      return {
        text: unpublish
          ? t('ha messo {name} nel rilascio «{release}», da togliere dal sito', { name, release })
          : t('ha messo {name} nel rilascio «{release}»', { name, release }),
        group: 'content',
      }
    }
    case 'release.scheduled':
      return {
        text: d.at
          ? t('ha programmato il rilascio {name} per {when}', { name, when: when(d.at) })
          : t('ha programmato il rilascio {name}', { name }),
        group: 'content',
      }
    case 'release.schedule_cancelled':
      return { text: t('ha annullato l’ora di uscita del rilascio {name}', { name }), group: 'content' }
    case 'release.published': {
      const items = d.items
      return {
        text:
          typeof items === 'number'
            ? tn(
                items,
                'ha pubblicato il rilascio {name} (una pagina)',
                'ha pubblicato il rilascio {name} ({n} pagine)',
                {
                  name,
                },
              )
            : t('ha pubblicato il rilascio {name}', { name }),
        group: 'content',
      }
    }
    case 'release.failed':
      return {
        text: t('non è riuscito a pubblicare il rilascio {name}: {message}', { name, message }),
        group: 'content',
      }
    case 'release.cancelled':
      return { text: t('ha annullato il rilascio {name}', { name }), group: 'content' }
    case 'document.turn_taken':
      // The document's title when the entry has it (as its target); older entries only have the id.
      return {
        text: name
          ? d.from
            ? t('ha preso il controllo di {name}, che stava modificando {from}', { name, from: String(d.from) })
            : t('ha preso il controllo di {name}, che stava modificando un’altra persona', { name })
          : d.from
            ? t('ha preso il controllo di un documento che stava modificando {from}', { from: String(d.from) })
            : t('ha preso il controllo di un documento che stava modificando un’altra persona'),
        group: 'content',
      }
    case 'import.wordpress': {
      const created = d.created
      const parts = [
        t('ha importato da WordPress {name}', { name: name || t('un sito') }) +
          (typeof created === 'number' ? `: ${tn(created, 'un contenuto', '{n} contenuti')}` : ''),
        typeof d.media === 'number' && d.media ? t('{n} immagini', { n: d.media }) : '',
        typeof d.relaid === 'number' ? t('{n} rifatte con l’AI', { n: d.relaid }) : '',
      ]
      return { text: parts.filter(Boolean).join(', '), group: 'content' }
    }
    case 'newsletter.created':
      return {
        text: d.ai
          ? t('ha creato la newsletter {name} con l’AI', { name })
          : t('ha creato la newsletter {name}', { name }),
        group: 'content',
      }
    case 'newsletter.deleted':
      return { text: t('ha eliminato la newsletter {name}', { name }), group: 'content' }
    case 'newsletter.sent': {
      const subscribers = d.subscribers
      return {
        text:
          typeof subscribers === 'number'
            ? tn(
                subscribers,
                'ha inviato la newsletter {name} a un iscritto',
                'ha inviato la newsletter {name} a {n} iscritti',
                { name },
              )
            : t('ha inviato la newsletter {name}', { name }),
        group: 'content',
      }
    }
    case 'newsletter.scheduled':
      return {
        text: d.at
          ? t('ha programmato la newsletter {name} per {when}', { name, when: when(d.at) })
          : t('ha programmato la newsletter {name}', { name }),
        group: 'content',
      }
    case 'newsletter.subscriber_added':
      return { text: t('ha aggiunto {name} agli iscritti alla newsletter', { name }), group: 'content' }
    case 'newsletter.subscriber_removed':
      return { text: t('ha eliminato l’iscritto {name} e i suoi dati', { name }), group: 'content' }
    case 'newsletter.imported':
      return {
        text: t('ha importato {n} iscritti alla newsletter da un CSV', {
          n: typeof d.added === 'number' ? d.added : '',
        }),
        group: 'content',
      }
    case 'newsletter.exported':
      return { text: t('ha esportato l’elenco degli iscritti alla newsletter'), group: 'content' }
    case 'site.ai_request':
      return {
        text:
          d.documents === 1
            ? t('ha chiesto all’AI dalla panoramica: un contenuto modificato in bozza')
            : t('ha chiesto all’AI dalla panoramica: {n} contenuti modificati in bozza', {
                n: String(d.documents ?? ''),
              }),
        group: 'content',
      }
    case 'site.generated':
      return {
        text:
          d.pages === 1
            ? t('ha fatto preparare all’AI una pagina da un brief')
            : t('ha fatto preparare all’AI {n} pagine da un brief', { n: String(d.pages ?? '') }),
        group: 'content',
      }
    case 'document.reviewed': {
      const issues = d.issues
      return {
        text:
          typeof issues === 'number'
            ? tn(
                issues,
                'ha fatto rivedere {name} all’AI: un suggerimento',
                'ha fatto rivedere {name} all’AI: {n} suggerimenti',
                {
                  name,
                },
              )
            : t('ha fatto rivedere {name} all’AI', { name }),
        group: 'content',
      }
    }
    case 'document.preview_shared':
      return {
        text: d.expiresAt
          ? t('ha creato un link di anteprima di {name} valido fino a {when}', { name, when: when(d.expiresAt) })
          : t('ha creato un link di anteprima di {name} senza scadenza', { name }),
        group: 'content',
      }
    case 'document.preview_revoked':
      return {
        text: name ? t('ha revocato un link di anteprima di {name}', { name }) : t('ha revocato un link di anteprima'),
        group: 'content',
      }
    case 'document.schedule_failed':
      return {
        text: unpublish
          ? t('Rimozione programmata di {name} non riuscita: {message}', { name, message })
          : t('Pubblicazione programmata di {name} non riuscita: {message}', { name, message }),
        group: 'content',
      }
    case 'document.deleted':
      return { text: t('ha eliminato {name}', { name }), group: 'content' }
    case 'document.restored':
      return { text: t('ha ripristinato una versione di {name}', { name }), group: 'content' }
    case 'document.translated': {
      const locale = String(d.locale ?? '').toUpperCase()
      return {
        text: d.ai
          ? t('ha creato la versione {locale} di {name} con l’AI', { locale, name })
          : t('ha creato la versione {locale} di {name}', { locale, name }),
        group: 'content',
      }
    }
    case 'media.uploaded':
      return { text: t('ha caricato {name}', { name }), group: 'content' }
    case 'media.deleted':
      return { text: t('ha eliminato il file {name}', { name }), group: 'content' }
    case 'message.exported': {
      const count = d.count
      return {
        text:
          typeof count === 'number'
            ? tn(count, 'ha esportato un messaggio in CSV', 'ha esportato {n} messaggi in CSV')
            : t('ha esportato i messaggi in CSV'),
        group: 'content',
      }
    }
    case 'message.deleted':
      return { text: t('ha eliminato un messaggio ricevuto'), group: 'content' }
    case 'backup.created':
      return {
        text: d.auto ? t('Backup automatico del database') : t('ha fatto un backup del database'),
        group: 'settings',
      }
    case 'backup.offsite':
      return { text: t('Copia cifrata dei backup fuori dal server'), group: 'settings' }
    case 'backup.offsite_failed':
      return { text: t('Copia fuori dal server non riuscita: {message}', { message }), group: 'settings' }
    case 'backup.offsite_started':
      return { text: t('ha avviato una copia fuori dal server'), group: 'settings' }
    case 'backup.key_shown':
      return { text: t('ha mostrato la chiave di ripristino dei backup'), group: 'settings' }
    case 'settings.offsite':
      return {
        text:
          e.target === 'off'
            ? t('ha spento la copia fuori dal server')
            : t('ha impostato la copia fuori dal server su {service}', {
                service: e.target === 's3' ? 'S3' : 'WebDAV',
              }),
        group: 'settings',
      }
    case 'backup.downloaded':
      return { text: t('ha scaricato il backup {target}', { target }), group: 'settings' }
    case 'backup.deleted':
      return { text: t('ha eliminato il backup {target}', { target }), group: 'settings' }
    case 'backup.archive':
      return { text: t('ha scaricato l’archivio completo del sito'), group: 'settings' }
    case 'update.install':
      return {
        text: d.auto
          ? t('Aggiornamento automatico a Materialize {version}', { version: target })
          : t('ha avviato l’aggiornamento a Materialize {version}', { version: target }),
        group: 'settings',
      }
    case 'update.rollback':
      return { text: t('è tornato a Materialize {version}', { version: target }), group: 'settings' }
  }
  if (kind === 'settings')
    return { text: t('ha cambiato {what}', { what: SETTINGS()[what] ?? t('le impostazioni') }), group: 'settings' }
  return { text: e.action, group: 'settings' }
}

const GROUP_ICON = {
  access: <LogIn />,
  people: <UserRound />,
  content: <FileText />,
  settings: <Settings />,
}

const FILTERS = () =>
  [
    { value: '', label: t('Tutto') },
    { value: 'access', label: t('Accessi') },
    { value: 'people', label: t('Persone') },
    { value: 'content', label: t('Contenuti') },
    { value: 'settings', label: t('Impostazioni') },
  ] as const

/**
 * Impostazioni → Protezione, in three sections: Sicurezza (what to fix), Backup (copies here and
 * off the server) and Registro attività (what happened). Administrators only.
 */
export function SecuritySettings({
  part,
  onOpenProfile,
}: {
  part: 'security' | 'backups' | 'activity'
  onOpenProfile: () => void
}) {
  const { user } = useSession()
  if (user.role !== 'admin')
    return (
      <EmptyState icon={<ShieldCheck />} title={t('Il registro della sicurezza lo vedono gli amministratori')}>
        {t('La tua verifica in due passaggi e i tuoi dispositivi sono nel tuo profilo.')}
        <div className="mt-3">
          <Button size="sm" onClick={onOpenProfile}>
            {t('Apri il profilo')}
          </Button>
        </div>
      </EmptyState>
    )
  return (
    <SettingsPage>
      {part === 'backups' ? (
        <BackupsSection />
      ) : part === 'activity' ? (
        <ActivityLog />
      ) : (
        <Overview onOpenProfile={onOpenProfile} />
      )}
    </SettingsPage>
  )
}

function Overview({ onOpenProfile }: { onOpenProfile: () => void }) {
  const query = useQuery({ queryKey: ['security-overview'], queryFn: api.securityOverview })
  if (!query.data) return <Spinner />
  const order = { bad: 0, warn: 1, info: 2, ok: 3 }
  const checks = [...query.data.checks].sort((a, b) => order[a.status] - order[b.status])
  const issues = checks.filter((c) => c.status === 'bad' || c.status === 'warn').length
  return (
    <section className="space-y-4">
      <SettingsHeading
        title={t('Stato della sicurezza')}
        description={
          issues
            ? tn(issues, 'Un punto da sistemare, dal più importante.', '{n} punti da sistemare, dal più importante.')
            : t('Tutto in ordine.')
        }
      />
      <ul className="divide-y divide-line overflow-hidden rounded-2xl bg-panel2">
        {checks.map((c) => (
          <li key={c.id} className="flex items-start gap-3 px-4 py-3">
            <span className={cx('mt-px shrink-0 [&_svg]:size-4.5', STATUS[c.status].tone)}>
              {STATUS[c.status].icon}
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-[14px] font-medium">{c.title}</div>
              <p className="mt-0.5 text-[13px] leading-relaxed text-fg3">{c.detail}</p>
            </div>
            {c.action && (
              <Button
                size="sm"
                onClick={() =>
                  c.action === 'profile'
                    ? onOpenProfile()
                    : c.action === 'backups'
                      ? navigate({ name: 'settings', tab: 'backups' })
                      : navigate(c.action === 'mail' ? { name: 'settings', tab: 'mail' } : { name: 'people' })
                }
              >
                {c.action === 'profile'
                  ? t('Attivala')
                  : c.action === 'mail'
                    ? t('Configura')
                    : c.action === 'backups'
                      ? t('Backup')
                      : t('Persone')}
              </Button>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}

const size = (bytes: number) =>
  bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`

/** Daily copies of the database: switch, how many to keep, make one now, download or delete. */
function BackupsSection() {
  const queryClient = useQueryClient()
  const query = useQuery({ queryKey: ['backups'], queryFn: api.backups })
  const [busy, setBusy] = useState(false)
  if (!query.data) return <Spinner />
  const data = query.data
  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ['backups'] })
    void queryClient.invalidateQueries({ queryKey: ['security-overview'] })
    void queryClient.invalidateQueries({ queryKey: ['activity'] })
  }
  const save = async (patch: Partial<{ enabled: boolean; keep: number }>) => {
    try {
      queryClient.setQueryData(['backups'], await api.saveBackups({ enabled: data.enabled, keep: data.keep, ...patch }))
      refresh()
    } catch (error) {
      toast((error as Error).message, 'error')
    }
  }
  const restore = <code className="font-mono text-[12px]">npx materialize restore</code>
  return (
    <section className="space-y-4">
      <SettingsHeading title={t('Backup')} />
      <div className="flex items-center gap-3 rounded-2xl bg-panel2 px-4 py-3.5">
        <div className="min-w-0 flex-1">
          <div className="text-[14px] font-medium">{t('Scarica tutto')}</div>
          <p className="mt-0.5 text-[13px] leading-relaxed text-fg3">
            {data.available
              ? tx(
                  'Un unico archivio con il database, tutte le immagini originali e i caratteri: da tenere fuori dal server, o per spostare il sito. Si rimette con {command}.',
                  { command: restore },
                )
              : tx(
                  'Un unico archivio con tutte le immagini originali e i caratteri: da tenere fuori dal server, o per spostare il sito. Si rimette con {command}.',
                  { command: restore },
                )}
          </p>
        </div>
        <a
          href="/api/backups/archive"
          download
          className={linkButton}
          onClick={() => {
            toast(t('L’archivio si sta preparando: il download parte tra poco'))
            setTimeout(refresh, 3000)
          }}
        >
          <Download /> {t('Scarica tutto')}
        </a>
      </div>
      <OffsiteBackup />
      {!data.available ? (
        <p className="text-[14px] leading-relaxed text-fg2">
          {t(
            'Il database è ospitato da un fornitore (Turso, libSQL): i backup del database li fa lui, controlla che siano attivi nel suo pannello. L’archivio qui sopra contiene comunque immagini e caratteri.',
          )}
        </p>
      ) : (
        <>
          <div className="flex items-start gap-3 rounded-2xl bg-panel2 px-4 py-3.5">
            <Switch
              checked={data.enabled}
              label={t('Backup automatici ogni giorno')}
              onChange={(enabled) => void save({ enabled })}
            />
            <div className="min-w-0 flex-1">
              <div className="text-[14px] font-medium">{t('Una copia del database ogni giorno')}</div>
              <p className="mt-0.5 text-[13px] leading-relaxed text-fg3">
                {tx(
                  'La fa il server mentre è acceso, nella cartella backups accanto al database. Ne tiene {count} e cancella le più vecchie. Copia anche le immagini nuove: quelle eliminate dalla libreria restano almeno 30 giorni.',
                  {
                    count: (
                      <select
                        value={data.keep}
                        onChange={(e) => void save({ keep: Number(e.target.value) })}
                        aria-label={t('Quante copie tenere')}
                        className="mx-1.5 h-6 rounded-[10px] border border-line2 bg-input px-1 text-[13px] text-fg outline-none"
                      >
                        {[7, 14, 30, 90].map((n) => (
                          <option key={n} value={n}>
                            {n}
                          </option>
                        ))}
                      </select>
                    ),
                  },
                )}
              </p>
            </div>
            <Button
              size="sm"
              variant="primary"
              loading={busy}
              onClick={async () => {
                setBusy(true)
                try {
                  await api.createBackup()
                  toast(t('Backup fatto'))
                  refresh()
                } catch (error) {
                  toast((error as Error).message, 'error')
                } finally {
                  setBusy(false)
                }
              }}
            >
              {t('Fai un backup ora')}
            </Button>
          </div>
          {data.items.length > 0 && (
            <ul className="divide-y divide-line overflow-hidden rounded-2xl bg-panel2">
              {data.items.map((b) => (
                <li key={b.name} className="flex items-center gap-3 px-4 py-2">
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-mono text-[13px]">{b.name}</div>
                    <div className="text-[12px] text-fg3" title={fullDate(b.createdAt)}>
                      {relativeTime(b.createdAt)} · {size(b.size)}
                    </div>
                  </div>
                  <a
                    href={`/api/backups/${encodeURIComponent(b.name)}`}
                    download={b.name}
                    className="inline-flex h-7 items-center gap-1.5 rounded-full px-3 text-[13px] font-medium text-fg2 hover:bg-hover hover:text-fg [&_svg]:size-3.5"
                  >
                    <Download /> {t('Scarica')}
                  </a>
                  <IconButton
                    label={t('Elimina {name}', { name: b.name })}
                    className="hover:text-danger"
                    onClick={async () => {
                      if (!confirm(t('Eliminare il backup {name}?', { name: b.name }))) return
                      await api.removeBackup(b.name).catch((e: Error) => toast(e.message, 'error'))
                      refresh()
                    }}
                  >
                    <Trash2 />
                  </IconButton>
                </li>
              ))}
            </ul>
          )}
          <p className="text-[13px] leading-relaxed text-fg3">
            {data.media.files > 0 &&
              `${t('Copia delle immagini: {files} file, {size}.', { files: data.media.files, size: size(data.media.size) })} `}
            {tx(
              'Per rimettere un backup: ferma il server, poi nella cartella del sito {command}. Le immagini che mancano tornano dalla copia; il database di prima resta salvato tra i backup.',
              {
                command: <code className="font-mono">npx materialize restore {t('percorso/del/backup.db')}</code>,
              },
            )}
          </p>
        </>
      )}
    </section>
  )
}

function ActivityLog() {
  const [group, setGroup] = useState<ReturnType<typeof FILTERS>[number]['value']>('')
  const list = useInfiniteQuery({
    queryKey: ['activity', group],
    queryFn: ({ pageParam }) => api.activity({ group: group || undefined, before: pageParam }),
    initialPageParam: undefined as number | undefined,
    getNextPageParam: (last) => (last.items.length === 50 ? last.items[last.items.length - 1]?.seq : undefined),
  })
  const items = list.data?.pages.flatMap((p) => p.items) ?? []
  return (
    <section className="space-y-4">
      <SettingsHeading title={t('Registro attività')} />
      <div className="max-w-full overflow-x-auto [scrollbar-width:none]">
        <Segmented size="sm" value={group} onChange={setGroup} options={[...FILTERS()]} />
      </div>
      {list.isPending ? (
        <Spinner />
      ) : !items.length ? (
        <p className="py-6 text-center text-[14px] text-fg3">{t('Ancora niente da mostrare.')}</p>
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-2xl bg-panel2">
          {items.map((e) => {
            const { text, group: g } = describe(e)
            const failed = /failed|blocked/.test(e.action)
            return (
              <li key={e.id} className="flex items-start gap-3 px-4 py-2.5">
                <span className={cx('mt-0.5 shrink-0 [&_svg]:size-3.5', failed ? 'text-danger' : 'text-fg3')}>
                  {GROUP_ICON[g]}
                </span>
                <div className="min-w-0 flex-1 text-[13px] leading-snug">
                  {e.userName && !failed && <span className="font-medium">{e.userName} </span>}
                  <span className={failed ? 'text-danger' : 'text-fg2'}>
                    {failed ? text.charAt(0).toUpperCase() + text.slice(1) : text}
                  </span>
                </div>
                <span className="shrink-0 text-right text-[12px] text-fg3" title={fullDate(e.at)}>
                  {relativeTime(e.at)}
                  {e.ip && !/^(local|::1|127\.|::ffff:127\.)/.test(e.ip) && (
                    <span className="block font-mono text-[11px]">{e.ip}</span>
                  )}
                </span>
              </li>
            )
          })}
        </ul>
      )}
      {list.hasNextPage && (
        <div className="flex justify-center">
          <Button size="sm" onClick={() => list.fetchNextPage()} loading={list.isFetchingNextPage}>
            {t('Mostra altre')}
          </Button>
        </div>
      )}
      <p className="text-[12px] text-fg3">{t('Il registro conserva un anno di attività.')}</p>
    </section>
  )
}
