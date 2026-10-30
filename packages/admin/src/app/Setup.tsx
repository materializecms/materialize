import { useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, CircleAlert, CircleCheck, CircleX, KeyRound } from 'lucide-react'
import { type FormEvent, type ReactNode, useState } from 'react'
import { Button, cx, Input, inputClass } from '../components/ui.tsx'
import { ApiError, api, type SetupStatus } from '../lib/api.ts'
import { Logo } from './Auth.tsx'
import { localeName } from './Sidebar.tsx'

const LANGUAGES = ['it', 'en', 'es', 'fr', 'de', 'pt']
const STEPS = ['Controllo', 'Il sito', 'Il tuo account'] as const

const label = 'mb-1.5 block text-[13px] font-medium text-fg2'

function Frame({ step, children }: { step?: number; children: ReactNode }) {
  return (
    <div className="flex min-h-full items-center justify-center px-4 py-12">
      <div className="w-full max-w-[420px]">
        <Logo className="mb-6 size-9" />
        {step !== undefined && (
          <ol className="mb-6 flex gap-1.5" aria-label="Passi dell’installazione">
            {STEPS.map((name, i) => (
              <li key={name} className="flex-1" aria-current={i === step ? 'step' : undefined}>
                <div className={cx('h-1 rounded-full', i <= step ? 'bg-accent' : 'bg-line')} />
                <div className={cx('mt-1.5 text-[12px]', i === step ? 'font-medium text-fg' : 'text-fg3')}>{name}</div>
              </li>
            ))}
          </ol>
        )}
        {children}
      </div>
    </div>
  )
}

const ICONS = {
  ok: <CircleCheck className="size-4 text-ok" />,
  warn: <CircleAlert className="size-4 text-warn" />,
  error: <CircleX className="size-4 text-danger" />,
}

/**
 * The first visit to a new installation: checks the server, asks the site's name and language and
 * creates the administrator, step by step. On a server online it needs the link printed when
 * `materialize start` started (?installa=…), so nobody else can claim a fresh installation.
 */
export function SetupWizard({ status }: { status: Extract<SetupStatus, { needsSetup: true }> }) {
  const queryClient = useQueryClient()
  const [token, setToken] = useState(() => new URLSearchParams(location.search).get('installa') ?? '')
  const [typed, setTyped] = useState('')
  const [askToken, setAskToken] = useState(status.needsToken && !token)
  const [step, setStep] = useState(0)
  const [siteName, setSiteName] = useState(status.site.name)
  const [locale, setLocale] = useState(status.site.locale)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const blocked = status.checks.some((c) => c.state === 'error')
  const languages = LANGUAGES.includes(status.site.locale) ? LANGUAGES : [status.site.locale, ...LANGUAGES]

  if (askToken)
    return (
      <Frame>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            setToken(typed.trim())
            setAskToken(false)
          }}
        >
          <h1 className="flex items-center gap-2 text-[20px] font-semibold tracking-tight">
            <KeyRound className="size-5 text-fg3" /> Serve il link di installazione
          </h1>
          <p className="mt-2 mb-5 text-[14px] leading-relaxed text-fg2">
            Per sicurezza, solo chi ha avviato il server può installare Materialize. All’avvio ha scritto un link che
            finisce con <code className="font-mono text-[13px]">?installa=…</code>: aprilo, oppure incolla qui il codice
            dopo l’uguale.
          </p>
          <Input
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            placeholder="Codice di installazione"
            aria-label="Codice di installazione"
            className="font-mono"
            required
            autoFocus
          />
          {error && (
            <p role="alert" className="mt-3 text-[14px] text-danger">
              {error}
            </p>
          )}
          <Button type="submit" variant="primary" className="mt-5 w-full">
            Continua
          </Button>
        </form>
      </Frame>
    )

  if (done)
    return (
      <Frame>
        <h1 className="text-[20px] font-semibold tracking-tight">Materialize è installato</h1>
        <p className="mt-2 text-[14px] leading-relaxed text-fg2">
          Il sito <strong className="font-semibold text-fg">{siteName}</strong> è pronto e il tuo account è attivo.
          Quando vorrai, nelle Impostazioni trovi l’email per i messaggi del sito e la verifica in due passaggi.
        </p>
        <Button
          variant="primary"
          className="mt-6 w-full"
          onClick={() => {
            // The link's code has done its job: it leaves the address bar.
            history.replaceState(null, '', location.pathname)
            void queryClient.invalidateQueries()
          }}
          autoFocus
        >
          Entra nel pannello
        </Button>
      </Frame>
    )

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await api.setup({ name, email, password, token: token || undefined, site: { name: siteName, locale } })
      setDone(true)
    } catch (err) {
      if (err instanceof ApiError && err.code === 'setup_token') {
        setError(err.message)
        setAskToken(true)
        return
      }
      const issues = err instanceof ApiError ? err.issues : []
      setError(
        issues.some((i) => i.path === 'password')
          ? 'La password deve avere almeno 10 caratteri'
          : issues.some((i) => i.path === 'email')
            ? 'Controlla l’indirizzo email'
            : (err as Error).message,
      )
    } finally {
      setBusy(false)
    }
  }

  const back = (
    <button
      type="button"
      onClick={() => setStep(step - 1)}
      className="flex items-center gap-1 text-[13px] text-fg2 hover:text-fg [&_svg]:size-3.5"
    >
      <ArrowLeft /> Indietro
    </button>
  )

  if (step === 0)
    return (
      <Frame step={0}>
        <h1 className="text-[20px] font-semibold tracking-tight">Benvenuto in Materialize</h1>
        <p className="mt-1 mb-5 text-[14px] text-fg2">Tre passi e il sito è pronto. Prima, un controllo del server.</p>
        <ul className="divide-y divide-line rounded-xl border border-line bg-panel">
          {status.checks.map((c) => (
            <li key={c.id} className="flex gap-3 px-4 py-3">
              <span className="mt-0.5 shrink-0">{ICONS[c.state]}</span>
              <span className="min-w-0">
                <span className="block text-[14px] font-medium">{c.label}</span>
                <span className="block text-[13px] leading-relaxed text-fg3">{c.detail}</span>
              </span>
            </li>
          ))}
        </ul>
        {blocked && (
          <p role="alert" className="mt-4 text-[14px] text-danger">
            Prima di continuare va sistemato quello segnato in rosso, poi ricarica la pagina.
          </p>
        )}
        <Button variant="primary" className="mt-6 w-full" disabled={blocked} onClick={() => setStep(1)} autoFocus>
          Continua
        </Button>
      </Frame>
    )

  if (step === 1)
    return (
      <Frame step={1}>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            setStep(2)
          }}
        >
          <h1 className="text-[20px] font-semibold tracking-tight">Il sito</h1>
          <p className="mt-1 mb-5 text-[14px] text-fg2">Si possono cambiare in qualsiasi momento dalle Impostazioni.</p>
          <div className="space-y-3.5">
            <label className="block">
              <span className={label}>Nome del sito</span>
              <Input
                value={siteName}
                onChange={(e) => setSiteName(e.target.value)}
                required
                maxLength={120}
                autoFocus
              />
            </label>
            <label className="block">
              <span className={label}>Lingua principale</span>
              <select value={locale} onChange={(e) => setLocale(e.target.value)} className={inputClass}>
                {languages.map((l) => (
                  <option key={l} value={l}>
                    {localeName(l)}
                  </option>
                ))}
              </select>
              <span className="mt-1 block text-[13px] text-fg3">
                Altre lingue si aggiungono dopo, in Impostazioni → Lingue.
              </span>
            </label>
          </div>
          <Button type="submit" variant="primary" className="mt-6 w-full">
            Continua
          </Button>
          <div className="mt-4">{back}</div>
        </form>
      </Frame>
    )

  return (
    <Frame step={2}>
      <form onSubmit={submit}>
        <h1 className="text-[20px] font-semibold tracking-tight">Il tuo account</h1>
        <p className="mt-1 mb-5 text-[14px] text-fg2">Sarai l’amministratore: potrai invitare altre persone dopo.</p>
        <div className="space-y-3.5">
          <label className="block">
            <span className={label}>Nome</span>
            <Input value={name} onChange={(e) => setName(e.target.value)} required autoComplete="name" autoFocus />
          </label>
          <label className="block">
            <span className={label}>Email</span>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </label>
          <label className="block">
            <span className={label}>Password</span>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={10}
              autoComplete="new-password"
            />
            <span className="mt-1 block text-[13px] text-fg3">Almeno 10 caratteri.</span>
          </label>
        </div>
        {error && (
          <p role="alert" className="mt-4 text-[14px] text-danger">
            {error}
          </p>
        )}
        <Button type="submit" variant="primary" loading={busy} className="mt-6 w-full">
          Installa
        </Button>
        <div className="mt-4">{back}</div>
      </form>
    </Frame>
  )
}
