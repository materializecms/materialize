import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Check,
  Copy,
  KeyRound,
  Mail,
  MoreHorizontal,
  PencilLine,
  ShieldCheck,
  Trash2,
  UserPlus,
  Users,
} from 'lucide-react'
import { type FormEvent, useState } from 'react'
import { useSession } from '../app/context.ts'
import {
  Button,
  Dialog,
  EmptyState,
  IconButton,
  Input,
  MenuItem,
  MenuSeparator,
  Popover,
  Segmented,
  Spinner,
  Switch,
  toast,
} from '../components/ui.tsx'
import { ApiError, api, type Member, type User } from '../lib/api.ts'
import { fullDate, relativeTime } from '../lib/format.ts'

export const ROLES: Record<User['role'], { label: string; hint: string }> = {
  admin: { label: 'Amministratore', hint: 'Tutto, comprese persone ed eliminazioni' },
  editor: { label: 'Editor', hint: 'Crea, modifica e pubblica i contenuti' },
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
          Fatto
        </Button>
      }
    >
      <p className="mb-3">{link?.text}</p>
      <div className="flex gap-1.5">
        <Input readOnly value={url} className="font-mono text-[12px]" onFocus={(e) => e.target.select()} />
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
          {copied ? 'Copiato' : 'Copia'}
        </Button>
      </div>
      <p className="mt-2 text-[12px] text-fg3">
        Chi ha il link può usarlo una sola volta: invialo solo alla persona giusta.
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
          ? 'Controlla l’indirizzo email'
          : (err as Error).message,
      )
    } finally {
      setBusy(false)
    }
  }

  const label = 'mb-1.5 block text-[12px] font-medium text-fg2'
  return (
    <Dialog open={open} onClose={onClose} width={440} title="Invita una persona">
      <form onSubmit={submit} className="space-y-4 pt-2">
        <label className="block">
          <span className={label}>Email</span>
          <Input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="nome@studio.it"
          />
        </label>
        <label className="block">
          <span className={label}>Nome (facoltativo)</span>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Si potrà cambiare in seguito" />
        </label>
        <div>
          <span className={label}>Ruolo</span>
          <Segmented
            className="flex w-full"
            value={role}
            onChange={setRole}
            options={[
              { value: 'editor', label: ROLES.editor.label },
              { value: 'admin', label: ROLES.admin.label },
            ]}
          />
          <p className="mt-1.5 text-[12px] text-fg3">{ROLES[role].hint}.</p>
        </div>
        {error && <p className="text-[13px] text-danger">{error}</p>}
        <div className="-mx-5 flex justify-end gap-2 border-t border-line px-5 pt-3">
          <Button onClick={onClose}>Annulla</Button>
          <Button type="submit" variant="primary" loading={busy} icon={<Mail className="size-4" />}>
            Crea invito
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
        toast(`Link per la nuova password inviato a ${person.email}`)
        return
      }
      setLink({
        url,
        title: `Nuova password per ${person.name}`,
        text: `Manda questo link a ${person.email}: potrà scegliere una nuova password entro 24 ore. La persona verrà disconnessa da tutti i dispositivi.`,
      })
    } catch (error) {
      toast((error as Error).message, 'error')
    }
  }

  if (me.role !== 'admin') {
    return <EmptyState icon={<Users />} title="Solo gli amministratori gestiscono le persone" />
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="flex h-12 shrink-0 items-center gap-3 border-b border-line bg-panel px-5">
        <Users className="size-4 text-fg3" />
        <h1 className="text-[14px] font-semibold">Persone</h1>
        {people.data && <span className="text-fg3 tabular-nums">{people.data.users.length}</span>}
        <div className="flex-1" />
        <Button variant="primary" icon={<UserPlus className="size-4" />} onClick={() => setInviting(true)}>
          Invita
        </Button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {people.isPending ? (
          <div className="flex justify-center py-20">
            <Spinner />
          </div>
        ) : people.error ? (
          <EmptyState icon={<Users />} title="Impossibile caricare le persone">
            {people.error.message}
          </EmptyState>
        ) : (
          <div className="mx-auto max-w-[880px] px-6 py-8">
            <section className="overflow-hidden rounded-lg border border-line bg-panel">
              {people.data.users.map((person) => (
                <div key={person.id} className="flex items-center gap-3 border-b border-line px-4 py-3 last:border-0">
                  <Avatar name={person.name} size={32} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">
                      {person.name}
                      {person.id === me.id && <span className="ml-1.5 text-[12px] font-normal text-fg3">(tu)</span>}
                    </div>
                    <div className="truncate text-[12.5px] text-fg3">{person.email}</div>
                  </div>
                  <span
                    className="hidden w-36 text-[12.5px] text-fg3 sm:block"
                    title={person.lastSeenAt ? fullDate(person.lastSeenAt) : undefined}
                  >
                    {person.lastSeenAt ? `Accesso ${relativeTime(person.lastSeenAt)}` : 'Mai entrato'}
                  </span>
                  <span className="inline-flex w-36 items-center gap-1.5 text-[12.5px]">
                    {person.role === 'admin' && <ShieldCheck className="size-3.5 text-accent" />}
                    {ROLES[person.role].label}
                  </span>
                  <Popover
                    align="end"
                    width={250}
                    trigger={({ toggle, ref }) => (
                      <IconButton ref={ref} label="Azioni" onClick={toggle}>
                        <MoreHorizontal />
                      </IconButton>
                    )}
                  >
                    {(close) => (
                      <div className="p-1">
                        <div className="px-2 pt-1.5 pb-1 text-[11px] font-medium text-fg3">Ruolo</div>
                        {(['editor', 'admin'] as const).map((role) => (
                          <MenuItem
                            key={role}
                            checked={person.role === role}
                            hint={undefined}
                            onClick={() => {
                              close()
                              if (role !== person.role)
                                void run(() => api.updateUser(person.id, { role }), 'Ruolo aggiornato')
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
                          Modifica nome ed email
                        </MenuItem>
                        <MenuItem
                          icon={<KeyRound />}
                          onClick={() => {
                            close()
                            void reset(person)
                          }}
                        >
                          Link per una nuova password
                        </MenuItem>
                        <MenuItem
                          icon={<Trash2 />}
                          danger
                          disabled={person.id === me.id}
                          onClick={() => {
                            close()
                            setRemoving(person)
                          }}
                        >
                          Rimuovi dal sito
                        </MenuItem>
                      </div>
                    )}
                  </Popover>
                </div>
              ))}
            </section>
            <EditorialSetting />

            {people.data.invites.length > 0 && (
              <section className="mt-8">
                <h2 className="mb-2 text-[12px] font-medium text-fg3">Inviti in attesa</h2>
                <div className="overflow-hidden rounded-lg border border-line bg-panel">
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
                        <div className="truncate text-[12.5px] text-fg3">
                          {ROLES[invite.role].label} · scade {relativeTime(invite.expiresAt)}
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
                              toast(`Nuovo invito inviato a ${invite.email}`)
                              refresh()
                              return
                            }
                            setLink({
                              url,
                              title: 'Nuovo link di invito',
                              text: `Il link precedente non vale più. Manda questo a ${invite.email}: è valido 7 giorni.`,
                            })
                            refresh()
                          } catch (error) {
                            toast((error as Error).message, 'error')
                          }
                        }}
                      >
                        Nuovo link
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => run(() => api.revokeInvite(invite.id), 'Invito annullato')}
                      >
                        Annulla
                      </Button>
                    </div>
                  ))}
                </div>
              </section>
            )}

            <p className="mt-6 text-[12.5px] text-fg3">
              <strong className="font-medium text-fg2">Editor</strong>: {ROLES.editor.hint.toLowerCase()}.{' '}
              <strong className="font-medium text-fg2">Amministratori</strong>: {ROLES.admin.hint.toLowerCase()}.
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
            toast(`Invito inviato per email a ${email}`)
            return
          }
          setLink({
            url,
            title: 'Invito pronto',
            text: `Manda questo link a ${email}: entrerà scegliendo la sua password. Il link è valido 7 giorni.`,
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
        title={`Rimuovere ${removing?.name}?`}
        footer={
          <>
            <Button onClick={() => setRemoving(null)} data-autofocus>
              Annulla
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                const person = removing
                setRemoving(null)
                if (person) void run(() => api.removeUser(person.id), `${person.name} non ha più accesso`)
              }}
            >
              Rimuovi
            </Button>
          </>
        }
      >
        La persona non potrà più entrare nel pannello e verrà disconnessa subito. I contenuti che ha creato restano.
      </Dialog>
    </div>
  )
}

/** Whether editors may change the layout of pages, or only their texts, links and images. */
function EditorialSetting() {
  const queryClient = useQueryClient()
  const editorial = useQuery({ queryKey: ['editorial'], queryFn: api.editorial }).data?.editorial
  if (!editorial) return null
  const on = !!editorial.editorsContentOnly
  return (
    <section className="mt-6 flex items-start gap-3 rounded-lg border border-line bg-panel px-4 py-3.5">
      <Switch
        checked={on}
        label="I redattori modificano solo i contenuti"
        onChange={async (editorsContentOnly) => {
          try {
            queryClient.setQueryData(['editorial'], await api.saveEditorial({ editorsContentOnly }))
            toast(
              editorsContentOnly
                ? 'I redattori ora modificano solo i contenuti'
                : 'I redattori possono anche impaginare',
            )
          } catch (error) {
            toast((error as Error).message, 'error')
          }
        }}
      />
      <div>
        <div className="text-[13px] font-medium">I redattori modificano solo i contenuti</div>
        <p className="mt-0.5 text-[12.5px] leading-relaxed text-fg3">
          Chi ha il ruolo di redattore apre le pagine in modalità Contenuto: scrive testi, cambia immagini e
          collegamenti, ma non può spostare, aggiungere o restilizzare gli elementi. Il design resta agli
          amministratori.
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
        changedEmail ? `${name.trim() || person.name} ora entra con ${email.trim().toLowerCase()}` : 'Nome aggiornato',
      )
      onSaved()
    } catch (err) {
      setError(
        err instanceof ApiError && err.issues.some((i) => i.path === 'email')
          ? 'Controlla l’indirizzo email'
          : (err as Error).message,
      )
    } finally {
      setBusy(false)
    }
  }

  const label = 'mb-1.5 block text-[12px] font-medium text-fg2'
  return (
    <Dialog open onClose={onClose} width={420} title={`Modifica ${person.name}`}>
      <form onSubmit={submit} className="space-y-4 pt-2">
        <label className="block">
          <span className={label}>Nome</span>
          <Input value={name} onChange={(e) => setName(e.target.value)} required />
        </label>
        <label className="block">
          <span className={label}>Email</span>
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <span className="mt-1 block text-[12px] text-fg3">
            {changedEmail
              ? 'Da ora entrerà con il nuovo indirizzo; la password non cambia. Se l’email è configurata, il vecchio indirizzo riceve un avviso.'
              : 'È l’indirizzo con cui entra nel pannello.'}
          </span>
        </label>
        {error && <p className="text-[13px] text-danger">{error}</p>}
        <div className="-mx-5 flex justify-end gap-2 border-t border-line px-5 pt-3">
          <Button onClick={onClose}>Annulla</Button>
          <Button type="submit" variant="primary" loading={busy}>
            Salva
          </Button>
        </div>
      </form>
    </Dialog>
  )
}
