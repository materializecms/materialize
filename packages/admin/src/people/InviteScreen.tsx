import { useQuery, useQueryClient } from '@tanstack/react-query'
import { type FormEvent, useState } from 'react'
import { Logo, TwoFactorStep } from '../app/Auth.tsx'
import { Button, Input, Spinner } from '../components/ui.tsx'
import { ApiError, api } from '../lib/api.ts'
import { ROLES } from './PeopleScreen.tsx'

/** Where a one-time link lands: join the site, or choose a new password. No session needed. */
export function InviteScreen({ token }: { token: string }) {
  const queryClient = useQueryClient()
  const info = useQuery({ queryKey: ['invite', token], queryFn: () => api.inviteInfo(token), retry: false })
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [ticket, setTicket] = useState<string | null>(null)
  // Fresh start, signed in, without the one-time link in the address bar.
  const enter = () => {
    queryClient.clear()
    location.replace('/admin/')
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const res = await api.acceptInvite(token, { name: name.trim() || undefined, password })
      // The new password is set; an account with two-step verification still asks for its code.
      if (res.twoFactor) {
        setTicket(res.ticket)
        setBusy(false)
        return
      }
      enter()
    } catch (err) {
      const issues = err instanceof ApiError ? err.issues : []
      setError(
        issues.some((i) => i.path === 'password')
          ? 'La password deve avere almeno 10 caratteri'
          : (err as Error).message,
      )
      setBusy(false)
    }
  }

  const label = 'mb-1.5 block text-[12px] font-medium text-fg2'

  return (
    <div className="flex min-h-full items-center justify-center px-4 py-12">
      <div className="w-full max-w-[340px]">
        <Logo className="mb-6 size-9" />
        {ticket ? (
          <TwoFactorStep ticket={ticket} onDone={enter} onBack={enter} />
        ) : info.isPending ? (
          <Spinner />
        ) : info.error || !info.data ? (
          <>
            <h1 className="text-[20px] font-semibold tracking-tight">Link non valido</h1>
            <p className="mt-2 text-fg2">
              Il link è già stato usato o è scaduto. Chiedine uno nuovo a chi ti ha invitato, oppure{' '}
              <a href="/admin/" className="text-accent hover:underline">
                accedi
              </a>{' '}
              se hai già un account.
            </p>
          </>
        ) : (
          <form onSubmit={submit}>
            <h1 className="text-[20px] font-semibold tracking-tight">
              {info.data.kind === 'invite' ? `Ti diamo il benvenuto in ${info.data.site}` : 'Scegli una nuova password'}
            </h1>
            <p className="mt-1 mb-6 text-fg2">
              {info.data.kind === 'invite'
                ? `Hai ricevuto un invito come ${ROLES[info.data.role].label.toLowerCase()}. Scegli una password per entrare.`
                : `Per l’account ${info.data.email}. Dopo, gli altri dispositivi verranno disconnessi.`}
            </p>
            <div className="space-y-3.5">
              <label className="block">
                <span className={label}>Email</span>
                <Input value={info.data.email} readOnly disabled autoComplete="username" />
              </label>
              {info.data.kind === 'invite' && (
                <label className="block">
                  <span className={label}>Nome</span>
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={info.data.name || 'Come ti chiami'}
                    required={!info.data.name}
                    autoComplete="name"
                    autoFocus
                  />
                </label>
              )}
              <label className="block">
                <span className={label}>{info.data.kind === 'invite' ? 'Password' : 'Nuova password'}</span>
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={10}
                  autoComplete="new-password"
                  autoFocus={info.data.kind === 'reset'}
                />
                <span className="mt-1 block text-[12px] text-fg3">Almeno 10 caratteri.</span>
              </label>
            </div>
            {error && (
              <p role="alert" className="mt-4 text-[13px] text-danger">
                {error}
              </p>
            )}
            <Button type="submit" variant="primary" loading={busy} className="mt-6 w-full">
              {info.data.kind === 'invite' ? 'Entra' : 'Salva e entra'}
            </Button>
          </form>
        )}
      </div>
    </div>
  )
}
