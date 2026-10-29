import { useQueryClient } from '@tanstack/react-query'
import { type FormEvent, useState } from 'react'
import { Button, Input } from '../components/ui.tsx'
import { ApiError, api } from '../lib/api.ts'

export function Logo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <rect width="32" height="32" rx="8" className="fill-fg" />
      <path
        d="M9 22V10l7 7 7-7v12"
        className="stroke-bg"
        strokeWidth="2.6"
        fill="none"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  )
}

export function AuthScreen({ mode }: { mode: 'setup' | 'login' }) {
  const queryClient = useQueryClient()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      if (mode === 'setup') await api.setup({ name, email, password })
      else await api.login({ email, password })
      await queryClient.invalidateQueries()
    } catch (err) {
      const issues = err instanceof ApiError ? err.issues : []
      const pw = issues.find((i) => i.path === 'password')
      setError(pw ? 'La password deve avere almeno 10 caratteri' : (err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const label = 'mb-1.5 block text-[12px] font-medium text-fg2'

  return (
    <div className="flex min-h-full items-center justify-center px-4 py-12">
      <form onSubmit={submit} className="w-full max-w-[340px]">
        <Logo className="mb-6 size-9" />
        <h1 className="text-[20px] font-semibold tracking-tight">
          {mode === 'setup' ? 'Benvenuto in Materialize' : 'Accedi'}
        </h1>
        <p className="mt-1 mb-6 text-fg2">
          {mode === 'setup'
            ? 'Crea l’account amministratore. Ci vuole un minuto.'
            : 'Inserisci le tue credenziali per continuare.'}
        </p>
        <div className="space-y-3.5">
          {mode === 'setup' && (
            <label className="block">
              <span className={label}>Nome</span>
              <Input value={name} onChange={(e) => setName(e.target.value)} required autoComplete="name" autoFocus />
            </label>
          )}
          <label className="block">
            <span className={label}>Email</span>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              autoFocus={mode === 'login'}
            />
          </label>
          <label className="block">
            <span className={label}>Password</span>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={mode === 'setup' ? 10 : undefined}
              autoComplete={mode === 'setup' ? 'new-password' : 'current-password'}
            />
            {mode === 'setup' && <span className="mt-1 block text-[12px] text-fg3">Almeno 10 caratteri.</span>}
          </label>
        </div>
        {error && (
          <p role="alert" className="mt-4 text-[13px] text-danger">
            {error}
          </p>
        )}
        <Button type="submit" variant="primary" loading={busy} className="mt-6 w-full">
          {mode === 'setup' ? 'Crea account e inizia' : 'Accedi'}
        </Button>
      </form>
    </div>
  )
}
