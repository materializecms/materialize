import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Check,
  Copy,
  KeyRound,
  Mail,
  MoreHorizontal,
  PencilLine,
  ShieldAlert,
  ShieldCheck,
  ShieldOff,
  Trash2,
  UserPlus,
  UserRound,
  Users,
} from 'lucide-react'
import { type FormEvent, useState } from 'react'
import { useSession } from '../app/context.ts'
import {
  Button,
  cx,
  Dialog,
  EmptyState,
  IconButton,
  Input,
  MenuItem,
  MenuSeparator,
  Popover,
  ScreenHeader,
  Segmented,
  Spinner,
  Switch,
  toast,
} from '../components/ui.tsx'
import { ApiError, api, type Member, type User } from '../lib/api.ts'
import { fullDate, relativeTime } from '../lib/format.ts'
import { t, tn } from '../lib/i18n.ts'

/** The roles, in the panel's language: read when drawn, so they follow a change of language. */
export const ROLES: Record<User['role'], { readonly label: string; readonly hint: string }> = {
  admin: {
    get label() {
      return t('Amministratore')
    },
    get hint() {
      return t('Tutto, comprese persone ed eliminazioni')
    },
  },
  editor: {
    get label() {
      return t('Editor')
    },
    get hint() {
      return t('Crea, modifica e pubblica i contenuti')
    },
  },
}

export function Avatar({ name, size = 28 }: { name: string; size?: number }) {
  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-full bg-accent font-semibold text-accent-fg"
      style={{ width: size, height: size, fontSize: size * 0.42 }}
    >
      {name.trim().slice(0, 1).toUpperCase() || '?'}
    </span>
  )
}

/** A link to hand over when email is not set up (Impostazioni → Email): people copy it and send it themselves. */
function LinkDialog({
  link,
  onClose,
}: {
  link: { url: string; title: string; text: string } | null
  onClose: () => void
}) {
  const [copied, setCopied] = useState(false)
  const url = link ? new URL(link.url, location.origin).toString() : ''
  return (
    <Dialog
      open={!!link}
      onClose={onClose}
      width={480}
      title={link?.title}
      footer={
        <Button variant="primary" onClick={onClose}>
          {t('Fatto')}
        </Button>
      }
    >
      <p className="mb-3">{link?.text}</p>
      <div className="flex gap-1.5">
        <Input readOnly value={url} className="font-mono text-[13px]" onFocus={(e) => e.target.select()} />
        <Button
          data-autofocus
          icon={copied ? <Check className="size-4 text-ok" /> : <Copy className="size-4" />}
          onClick={() =>
            navigator.clipboard?.writeText(url).then(() => {
              setCopied(true)
              setTimeout(() => setCopied(false), 1800)
            })
          }
        >
          {copied ? t('Copiato') : t('Copia')}
        </Button>
      </div>
      <p className="mt-2 text-[13px] text-fg3">
        {t('Chi ha il link può usarlo una sola volta: invialo solo alla persona giusta.')}
      </p>
    </Dialog>
  )
}

function InviteDialog({
  open,
  onClose,
  onCreated,
}: {
  open: boolean
  onClose: () => void
  onCreated: (link: string, email: string, mailed?: boolean) => void
}) {
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [role, setRole] = useState<User['role']>('editor')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const { link, mailed } = await api.invite({ email, name: name || undefined, role })
      onCreated(link, email, mailed)
      setEmail('')
      setName('')
    } catch (err) {
      setError(
        err instanceof ApiError && err.issues.some((i) => i.path === 'email')
          ? t('Controlla l’indirizzo email')
          : (err as Error).message,
      )
    } finally {
      setBusy(false)
    }
  }

  const label = 'mb-1.5 block text-[13px] font-medium text-fg2'
  return (
    <Dialog open={open} onClose={onClose} width={440} title={t('Invita una persona')}>
      <form onSubmit={submit} className="space-y-4 pt-2">
        <label className="block">
          <span className={label}>Email</span>
          <Input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t('nome@example.com')}
          />
        </label>
        <label className="block">
          <span className={label}>{t('Nome (facoltativo)')}</span>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('Si potrà cambiare in seguito')}
          />
        </label>
        <div>
          <span className={label}>{t('Ruolo')}</span>
          <Segmented
            className="flex w-full"
            value={role}
            onChange={setRole}
            options={[
              { value: 'editor', label: ROLES.editor.label },
              { value: 'admin', label: ROLES.admin.label },
            ]}
          />
          <p className="mt-1.5 text-[13px] text-fg3">{ROLES[role].hint}.</p>
        </div>
        {error && <p className="text-[14px] text-danger">{error}</p>}
        <div className="-mx-5 flex justify-end gap-2 border-t border-line px-5 pt-3">
          <Button onClick={onClose}>{t('Annulla')}</Button>
          <Button type="submit" variant="primary" loading={busy} icon={<Mail className="size-4" />}>
            {t('Crea invito')}
          </Button>
        </div>
      </form>
    </Dialog>
  )
}

export function PeopleScreen() {
  const { user: me } = useSession()
  const queryClient = useQueryClient()
  const people = useQuery({ queryKey: ['people'], queryFn: api.people })
  const [inviting, setInviting] = useState(false)
  const [link, setLink] = useState<{ url: string; title: string; text: string } | null>(null)
  const [removing, setRemoving] = useState<Member | null>(null)
  const [editing, setEditing] = useState<Member | null>(null)
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['people'] })

  const run = async (action: () => Promise<unknown>, done?: string) => {
    try {
      await action()
      refresh()
      if (done) toast(done)
    } catch (error) {
      toast((error as Error).message, 'error')
    }
  }

  const reset = async (person: Member) => {
    try {
      const { link: url, mailed } = await api.resetLink(person.id)
      if (mailed) {
        toast(t('Link per la nuova password inviato a {email}', { email: person.email }))
        return
      }
      setLink({
        url,
        title: t('Nuova password per {name}', { name: person.name }),
        text: t(
          'Manda questo link a {email}: potrà scegliere una nuova password entro 24 ore. La persona verrà disconnessa da tutti i dispositivi.',
          { email: person.email },
        ),
      })
    } catch (error) {
      toast((error as Error).message, 'error')
    }
  }

  if (me.role !== 'admin') {
    return <EmptyState icon={<Users />} title={t('Solo gli amministratori gestiscono le persone')} />
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ScreenHeader
        icon={<UserRound />}
        color="#8b5cf6"
        title={t('Persone')}
        subtitle={
          people.data
            ? tn(people.data.users.length, 'Una persona con accesso al pannello', '{n} persone con accesso al pannello')
            : ''
        }
        actions={
          <Button variant="primary" icon={<UserPlus className="size-4" />} onClick={() => setInviting(true)}>
            {t('Invita')}
          </Button>
        }
      />

      <div className="min-h-0 flex-1 overflow-y-auto">
        {people.isPending ? (
          <div className="flex justify-center py-20">
            <Spinner />
          </div>
        ) : people.error ? (
          <EmptyState icon={<Users />} title={t('Impossibile caricare le persone')}>
            {people.error.message}
          </EmptyState>
        ) : (
          <div className="max-w-[880px] px-4 pt-6 pb-8 sm:px-8">
            <section className="overflow-hidden rounded-2xl bg-panel2">
              {people.data.users.map((person) => (
                <div key={person.id} className="flex items-center gap-3 border-b border-line px-4 py-3 last:border-0">
                  <Avatar name={person.name} size={32} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">
                      {person.name}
                      {person.id === me.id && (
                        <span className="ml-1.5 text-[13px] font-normal text-fg3">{t('(tu)')}</span>
                      )}
                    </div>
                    <div className="truncate text-[13px] text-fg3">{person.email}</div>
                    {/* On phones the role goes under the email: the name keeps the whole width. */}
                    <div className="mt-0.5 flex items-center gap-1.5 text-[13px] text-fg2 sm:hidden">
                      {person.role === 'admin' && <ShieldCheck className="size-3.5 text-accent" />}
                      {ROLES[person.role].label}
                    </div>
                  </div>
                  <span
                    className="hidden w-36 text-[13px] text-fg3 sm:block"
                    title={person.lastSeenAt ? fullDate(person.lastSeenAt) : undefined}
                  >
                    {person.lastSeenAt
                      ? t('Accesso {when}', { when: relativeTime(person.lastSeenAt) })
                      : t('Mai entrato')}
                  </span>
                  {/* Said in words: a lone dash told nothing about what it meant. */}
                  <span
                    className={cx(
                      'hidden w-32 items-center gap-1.5 text-[13px] md:inline-flex [&_svg]:size-3.5 [&_svg]:shrink-0',
                      person.twoFactor ? 'text-ok' : 'text-warn',
                    )}
                    title={
                      person.twoFactor ? t('Entra con password e codice dall’app') : t('Entra solo con la password')
                    }
                  >
                    {person.twoFactor ? <ShieldCheck /> : <ShieldAlert />}
                    {person.twoFactor ? t('Due passaggi') : t('Solo password')}
                  </span>
                  <span className="hidden w-36 items-center gap-1.5 text-[13px] sm:inline-flex">
                    {person.role === 'admin' && <ShieldCheck className="size-3.5 text-accent" />}
                    {ROLES[person.role].label}
                  </span>
                  <Popover
                    align="end"
                    width={250}
                    trigger={({ toggle, ref }) => (
                      <IconButton ref={ref} label={t('Azioni')} onClick={toggle}>
                        <MoreHorizontal />
                      </IconButton>
                    )}
                  >
                    {(close) => (
                      <div className="p-1">
                        <div className="px-2 pt-1.5 pb-1 text-[12px] font-medium text-fg3">{t('Ruolo')}</div>
                        {(['editor', 'admin'] as const).map((role) => (
                          <MenuItem
                            key={role}
                            checked={person.role === role}
                            hint={undefined}
                            onClick={() => {
                              close()
                              if (role !== person.role)
                                void run(() => api.updateUser(person.id, { role }), t('Ruolo aggiornato'))
                            }}
                          >
                            {ROLES[role].label}
                          </MenuItem>
                        ))}
                        <MenuSeparator />
                        <MenuItem
                          icon={<PencilLine />}
                          onClick={() => {
                            close()
                            setEditing(person)
                          }}
                        >
                          {t('Modifica nome ed email')}
                        </MenuItem>
                        <MenuItem
                          icon={<KeyRound />}
                          onClick={() => {
                            close()
                            void reset(person)
                          }}
                        >
                          {t('Link per una nuova password')}
                        </MenuItem>
                        {person.twoFactor && person.id !== me.id && (
                          <MenuItem
                            icon={<ShieldOff />}
                            onClick={() => {
                              close()
                              if (
                                confirm(
                                  t(
                                    'Disattivare la verifica in due passaggi di {name}? Potrà entrare con la sola password e riattivarla dal profilo. Fallo solo se ha perso il telefono e i codici di riserva.',
                                    { name: person.name },
                                  ),
                                )
                              )
                                void run(() => api.resetTwoFactor(person.id), t('Verifica in due passaggi disattivata'))
                            }}
                          >
                            {t('Disattiva la verifica in due passaggi')}
                          </MenuItem>
                        )}
                        <MenuItem
                          icon={<Trash2 />}
                          danger
                          disabled={person.id === me.id}
                          onClick={() => {
                            close()
                            setRemoving(person)
                          }}
                        >
                          {t('Rimuovi dal sito')}
                        </MenuItem>
                      </div>
                    )}
                  </Popover>
                </div>
              ))}
            </section>
            <EditorialSetting />
            <TwoFactorSetting
              everyone={people.data.users.every((u) => u.twoFactor)}
              missing={people.data.users.filter((u) => !u.twoFactor).length}
              mine={!!people.data.users.find((u) => u.id === me.id)?.twoFactor}
            />

            {people.data.invites.length > 0 && (
              <section className="mt-8">
                <h2 className="mb-2 text-[13px] font-medium text-fg3">{t('Inviti in attesa')}</h2>
                <div className="overflow-hidden rounded-2xl bg-panel2">
                  {people.data.invites.map((invite) => (
                    <div
                      key={invite.id}
                      className="flex items-center gap-3 border-b border-line px-4 py-3 last:border-0"
                    >
                      <span className="flex size-8 shrink-0 items-center justify-center rounded-full border border-dashed border-line2 text-fg3">
                        <Mail className="size-4" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-medium">{invite.name || invite.email}</div>
                        <div className="truncate text-[13px] text-fg3">
                          {ROLES[invite.role].label} · {t('scade {when}', { when: relativeTime(invite.expiresAt) })}
                        </div>
                      </div>
                      <Button
                        size="sm"
                        onClick={async () => {
                          try {
                            const { link: url, mailed } = await api.invite({
                              email: invite.email,
                              name: invite.name || undefined,
                              role: invite.role,
                            })
                            if (mailed) {
                              toast(t('Nuovo invito inviato a {email}', { email: invite.email }))
                              refresh()
                              return
                            }
                            setLink({
                              url,
                              title: t('Nuovo link di invito'),
                              text: t('Il link precedente non vale più. Manda questo a {email}: è valido 7 giorni.', {
                                email: invite.email,
                              }),
                            })
                            refresh()
                          } catch (error) {
                            toast((error as Error).message, 'error')
                          }
                        }}
                      >
                        {t('Nuovo link')}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => run(() => api.revokeInvite(invite.id), t('Invito annullato'))}
                      >
                        {t('Annulla')}
                      </Button>
                    </div>
                  ))}
                </div>
              </section>
            )}

            <p className="mt-6 text-[13px] text-fg3">
              <strong className="font-medium text-fg2">{t('Editor')}</strong>: {ROLES.editor.hint.toLowerCase()}.{' '}
              <strong className="font-medium text-fg2">{t('Amministratori')}</strong>: {ROLES.admin.hint.toLowerCase()}.
            </p>
          </div>
        )}
      </div>

      <InviteDialog
        open={inviting}
        onClose={() => setInviting(false)}
        onCreated={(url, email, mailed) => {
          setInviting(false)
          refresh()
          if (mailed) {
            toast(t('Invito inviato per email a {email}', { email }))
            return
          }
          setLink({
            url,
            title: t('Invito pronto'),
            text: t('Manda questo link a {email}: entrerà scegliendo la sua password. Il link è valido 7 giorni.', {
              email,
            }),
          })
        }}
      />
      <LinkDialog link={link} onClose={() => setLink(null)} />
      <EditPersonDialog
        key={editing?.id}
        person={editing}
        onClose={() => setEditing(null)}
        onSaved={() => {
          setEditing(null)
          void refresh()
          void queryClient.invalidateQueries({ queryKey: ['me'] })
        }}
      />
      <Dialog
        open={!!removing}
        onClose={() => setRemoving(null)}
        title={t('Rimuovere {name}?', { name: removing?.name })}
        footer={
          <>
            <Button onClick={() => setRemoving(null)} data-autofocus>
              {t('Annulla')}
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                const person = removing
                setRemoving(null)
                if (person)
                  void run(() => api.removeUser(person.id), t('{name} non ha più accesso', { name: person.name }))
              }}
            >
              {t('Rimuovi')}
            </Button>
          </>
        }
      >
        {t(
          'La persona non potrà più entrare nel pannello e verrà disconnessa subito. I contenuti che ha creato restano.',
        )}
      </Dialog>
    </div>
  )
}

/** Whether editors may change the layout of pages, or only their texts, links and images. */
/** Two-step verification for everyone: who has not turned it on is asked to, at the next visit. */
function TwoFactorSetting({ everyone, missing, mine }: { everyone: boolean; missing: number; mine: boolean }) {
  const queryClient = useQueryClient()
  const security = useQuery({ queryKey: ['site-security'], queryFn: api.siteSecurity }).data
  if (!security) return null
  return (
    <section className="mt-3 flex items-start gap-3 rounded-2xl bg-panel2 px-4 py-3.5">
      <Switch
        checked={security.requireTwoFactor}
        label={t('Richiedi la verifica in due passaggi a tutti')}
        onChange={async (requireTwoFactor) => {
          try {
            queryClient.setQueryData(['site-security'], await api.saveSiteSecurity({ requireTwoFactor }))
            toast(
              requireTwoFactor
                ? t('Verifica in due passaggi richiesta a tutti')
                : t('Verifica in due passaggi facoltativa'),
            )
          } catch (error) {
            toast((error as Error).message, 'error')
          }
        }}
      />
      <div>
        <div className="text-[14px] font-medium">{t('Richiedi la verifica in due passaggi a tutti')}</div>
        <p className="mt-0.5 text-[13px] leading-relaxed text-fg3">
          {t(
            'Per entrare servono la password e un codice dall’app del telefono: una password rubata da sola non basta.',
          )}{' '}
          {!mine
            ? t('Prima attivala per te, dal tuo profilo → Sicurezza.')
            : everyone
              ? t('Tutti l’hanno già attivata.')
              : security.requireTwoFactor
                ? tn(
                    missing,
                    'Una persona non l’ha ancora attivata: dovrà farlo al prossimo accesso.',
                    '{n} persone non l’hanno ancora attivata: dovranno farlo al prossimo accesso.',
                  )
                : tn(
                    missing,
                    'Una persona non l’ha ancora attivata: se la richiedi, dovrà farlo al prossimo accesso.',
                    '{n} persone non l’hanno ancora attivata: se la richiedi, dovranno farlo al prossimo accesso.',
                  )}
        </p>
      </div>
    </section>
  )
}

function EditorialSetting() {
  const queryClient = useQueryClient()
  const editorial = useQuery({ queryKey: ['editorial'], queryFn: api.editorial }).data?.editorial
  if (!editorial) return null
  const on = !!editorial.editorsContentOnly
  return (
    <section className="mt-6 flex items-start gap-3 rounded-2xl bg-panel2 px-4 py-3.5">
      <Switch
        checked={on}
        label={t('I redattori modificano solo i contenuti')}
        onChange={async (editorsContentOnly) => {
          try {
            queryClient.setQueryData(['editorial'], await api.saveEditorial({ editorsContentOnly }))
            toast(
              editorsContentOnly
                ? t('I redattori ora modificano solo i contenuti')
                : t('I redattori possono anche impaginare'),
            )
          } catch (error) {
            toast((error as Error).message, 'error')
          }
        }}
      />
      <div>
        <div className="text-[14px] font-medium">{t('I redattori modificano solo i contenuti')}</div>
        <p className="mt-0.5 text-[13px] leading-relaxed text-fg3">
          {t(
            'Chi ha il ruolo di redattore apre le pagine in modalità Contenuto: scrive testi, cambia immagini e collegamenti, ma non può spostare, aggiungere o restilizzare gli elementi. Il design resta agli amministratori.',
          )}
        </p>
      </div>
    </section>
  )
}

/** An administrator corrects someone's name or sign-in email (a typo, a new address). */
function EditPersonDialog({
  person,
  onClose,
  onSaved,
}: {
  person: Member | null
  onClose: () => void
  onSaved: () => void
}) {
  const [name, setName] = useState(person?.name ?? '')
  const [email, setEmail] = useState(person?.email ?? '')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  if (!person) return null
  const changedEmail = email.trim().toLowerCase() !== person.email

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await api.updateUser(person.id, {
        ...(name.trim() !== person.name ? { name: name.trim() } : {}),
        ...(changedEmail ? { email: email.trim() } : {}),
      })
      toast(
        changedEmail
          ? t('{name} ora entra con {email}', { name: name.trim() || person.name, email: email.trim().toLowerCase() })
          : t('Nome aggiornato'),
      )
      onSaved()
    } catch (err) {
      setError(
        err instanceof ApiError && err.issues.some((i) => i.path === 'email')
          ? t('Controlla l’indirizzo email')
          : (err as Error).message,
      )
    } finally {
      setBusy(false)
    }
  }

  const label = 'mb-1.5 block text-[13px] font-medium text-fg2'
  return (
    <Dialog open onClose={onClose} width={420} title={t('Modifica {name}', { name: person.name })}>
      <form onSubmit={submit} className="space-y-4 pt-2">
        <label className="block">
          <span className={label}>{t('Nome')}</span>
          <Input value={name} onChange={(e) => setName(e.target.value)} required />
        </label>
        <label className="block">
          <span className={label}>Email</span>
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <span className="mt-1 block text-[13px] text-fg3">
            {changedEmail
              ? t(
                  'Da ora entrerà con il nuovo indirizzo; la password non cambia. Se l’email è configurata, il vecchio indirizzo riceve un avviso.',
                )
              : t('È l’indirizzo con cui entra nel pannello.')}
          </span>
        </label>
        {error && <p className="text-[14px] text-danger">{error}</p>}
        <div className="-mx-5 flex justify-end gap-2 border-t border-line px-5 pt-3">
          <Button onClick={onClose}>{t('Annulla')}</Button>
          <Button type="submit" variant="primary" loading={busy}>
            {t('Salva')}
          </Button>
        </div>
      </form>
    </Dialog>
  )
}
