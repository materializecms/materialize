import { useQuery, useQueryClient } from '@tanstack/react-query'
import { type FormEvent, useState } from 'react'
import { Button, Input } from '../components/ui.tsx'
import { ApiError, api } from '../lib/api.ts'

/** Blocks of the mark, left to right: the M takes shape, from faint to solid (docs/assets/logo.svg). */
const MARK: [number, number, number][] = [
  ...[2, 14.5, 27, 39.5, 52].map((y): [number, number, number] => [2, y, 0.3]),
  [14.5, 14.5, 0.5],
  [27, 27, 0.7],
  [39.5, 14.5, 0.85],
  ...[2, 14.5, 27, 39.5, 52].map((y): [number, number, number] => [52, y, 1]),
]

/** Materialize's icon: the mark in white on its violet tile. */
export function Logo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 72 72" className={className} aria-hidden="true">
      <rect width="72" height="72" rx="17" fill="#5B4BEA" />
      <g transform="translate(14 14) scale(0.6875)" fill="#fff">
        {MARK.map(([x, y, o]) => (
          <rect key={`${x}-${y}`} x={x} y={y} width="10" height="10" rx="2.6" opacity={o} />
        ))}
      </g>
    </svg>
  )
}

/** Signing in; the first account is made by the installation (Setup.tsx). */
export function AuthScreen() {
  const queryClient = useQueryClient()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  // Password accepted, the account asks for a code too.
  const [ticket, setTicket] = useState<string | null>(null)
  const [forgot, setForgot] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const res = await api.login({ email, password })
      if (res.twoFactor) {
        setTicket(res.ticket)
        setPassword('')
        return
      }
      await queryClient.invalidateQueries()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const label = 'mb-1.5 block text-[13px] font-medium text-fg2'

  if (forgot)
    return (
      <div className="mz-backdrop flex min-h-full items-center justify-center px-4 py-12">
        <div className="mz-card w-full max-w-[388px]">
          <Logo className="mb-6 size-9" />
          <ForgotPassword initialEmail={email} onBack={() => setForgot(false)} />
        </div>
      </div>
    )

  if (ticket)
    return (
      <div className="mz-backdrop flex min-h-full items-center justify-center px-4 py-12">
        <div className="mz-card w-full max-w-[388px]">
          <Logo className="mb-6 size-9" />
          <TwoFactorStep
            ticket={ticket}
            onDone={() => void queryClient.invalidateQueries()}
            onBack={() => setTicket(null)}
          />
        </div>
      </div>
    )

  return (
    <div className="mz-backdrop flex min-h-full items-center justify-center px-4 py-12">
      <form onSubmit={submit} className="mz-card w-full max-w-[388px]">
        <Logo className="mb-6 size-9" />
        <h1 className="text-[20px] font-semibold tracking-tight">Accedi</h1>
        <p className="mt-1 mb-6 text-fg2">Inserisci le tue credenziali per continuare.</p>
        <div className="space-y-3.5">
          <label className="block">
            <span className={label}>Email</span>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              autoFocus
            />
          </label>
          <label className="block">
            <span className="mb-1.5 flex items-baseline justify-between text-[13px] font-medium text-fg2">
              Password
              <button
                type="button"
                className="text-[13px] font-normal text-accent hover:underline"
                onClick={() => setForgot(true)}
              >
                Password dimenticata?
              </button>
            </span>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
          </label>
        </div>
        {error && (
          <p role="alert" className="mt-4 text-[14px] text-danger">
            {error}
          </p>
        )}
        <Button type="submit" variant="primary" loading={busy} className="mt-6 w-full">
          Accedi
        </Button>
        {/* Who makes it, without the version: a public page should not tell which one is running. */}
        <p className="mt-10 text-center text-[12px] text-fg3">
          <a
            href="https://github.com/materializecms/materialize"
            target="_blank"
            rel="noreferrer"
            className="hover:text-fg2 hover:underline"
          >
            Materialize · CMS open source
          </a>
        </p>
      </form>
    </div>
  )
}

/**
 * A forgotten password: a link by email, valid an hour. The answer never says whether the email
 * has an account. Without email set up on the site, it says who can help instead.
 */
function ForgotPassword({ initialEmail, onBack }: { initialEmail: string; onBack: () => void }) {
  const [email, setEmail] = useState(initialEmail)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)
  const recovery = useQuery({ queryKey: ['recovery'], queryFn: api.recovery })
  const label = 'mb-1.5 block text-[13px] font-medium text-fg2'
  const back = (
    <button type="button" className="mt-4 text-[13px] text-fg2 hover:text-fg" onClick={onBack}>
      Torna all’accesso
    </button>
  )

  if (recovery.data && !recovery.data.mail)
    return (
      <div>
        <h1 className="text-[20px] font-semibold tracking-tight">Password dimenticata</h1>
        <p className="mt-2 text-[14px] leading-relaxed text-fg2">
          Questo sito non ha ancora l’invio delle email, quindi il link non può arrivarti per posta. Chiedi a un
          amministratore: dalla pagina Persone crea un link per una nuova password.
        </p>
        <p className="mt-3 text-[14px] leading-relaxed text-fg2">
          Se sei l’unico amministratore, chi gestisce il server può creare il link con il comando{' '}
          <code className="font-mono text-[13px]">materialize reset-password</code> seguito dalla tua email.
        </p>
        {back}
      </div>
    )

  if (sent)
    return (
      <div>
        <h1 className="text-[20px] font-semibold tracking-tight">Controlla la posta</h1>
        <p className="mt-2 text-[14px] leading-relaxed text-fg2">
          Se <strong className="font-semibold text-fg">{email.trim()}</strong> ha un account, tra poco riceverai
          un’email con il link per scegliere una nuova password. Il link vale un’ora.
        </p>
        <p className="mt-3 text-[13px] leading-relaxed text-fg3">
          Non arriva? Guarda anche nello spam, oppure chiedi a un amministratore.
        </p>
        {back}
      </div>
    )

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await api.forgot(email.trim())
      setSent(true)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit}>
      <h1 className="text-[20px] font-semibold tracking-tight">Password dimenticata</h1>
      <p className="mt-1 mb-6 text-fg2">
        Scrivi l’email del tuo account: ti mandiamo un link per sceglierne una nuova.
      </p>
      <label className="block">
        <span className={label}>Email</span>
        <Input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="email"
          autoFocus
        />
      </label>
      {error && (
        <p role="alert" className="mt-4 text-[14px] text-danger">
          {error}
        </p>
      )}
      <Button type="submit" variant="primary" loading={busy} className="mt-6 w-full">
        Mandami il link
      </Button>
      {back}
    </form>
  )
}

/** The second step of signing in: the code from the app, or a recovery code. */
export function TwoFactorStep({ ticket, onDone, onBack }: { ticket: string; onDone: () => void; onBack: () => void }) {
  const [code, setCode] = useState('')
  const [recovery, setRecovery] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await api.verifyLogin({ ticket, code })
      onDone()
    } catch (err) {
      setError((err as Error).message)
      if (err instanceof ApiError && err.code === 'challenge_expired') onBack()
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit}>
      <h1 className="text-[20px] font-semibold tracking-tight">Verifica in due passaggi</h1>
      <p className="mt-1 mb-6 text-fg2">
        {recovery
          ? 'Scrivi uno dei codici di riserva che hai salvato: ognuno vale una volta.'
          : 'Apri l’app di autenticazione e scrivi il codice di 6 cifre.'}
      </p>
      <Input
        key={recovery ? 'r' : 'c'}
        value={code}
        onChange={(e) => setCode(recovery ? e.target.value : e.target.value.replace(/[^\d]/g, '').slice(0, 6))}
        inputMode={recovery ? 'text' : 'numeric'}
        autoComplete="one-time-code"
        placeholder={recovery ? 'abcd-efgh' : '123456'}
        aria-label={recovery ? 'Codice di riserva' : 'Codice'}
        required
        autoFocus
        className="font-mono tracking-[0.2em]"
      />
      {error && (
        <p role="alert" className="mt-4 text-[14px] text-danger">
          {error}
        </p>
      )}
      <Button type="submit" variant="primary" loading={busy} className="mt-6 w-full">
        Continua
      </Button>
      <div className="mt-4 flex justify-between text-[13px]">
        <button type="button" className="text-fg2 hover:text-fg" onClick={onBack}>
          Indietro
        </button>
        <button
          type="button"
          className="font-medium text-accent hover:underline"
          onClick={() => {
            setRecovery(!recovery)
            setCode('')
            setError(null)
          }}
        >
          {recovery ? 'Usa il codice dell’app' : 'Usa un codice di riserva'}
        </button>
      </div>
    </form>
  )
}
