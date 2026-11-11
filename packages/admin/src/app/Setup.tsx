import { useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, CircleAlert, CircleCheck, CircleX, KeyRound } from 'lucide-react'
import { type FormEvent, type ReactNode, useState } from 'react'
import { Button, cx, Input, inputClass } from '../components/ui.tsx'
import { ApiError, api, type SetupStatus } from '../lib/api.ts'
import { t, tx } from '../lib/i18n.ts'
import { LanguageSwitch, Logo } from './Auth.tsx'
import { localeName } from './Sidebar.tsx'

const LANGUAGES = ['it', 'en', 'es', 'fr', 'de', 'pt']
const steps = () => [t('Controllo'), t('Il sito'), t('Il tuo account')]

const label = 'mb-1.5 block text-[13px] font-medium text-fg2'

/** One screen of the wizard; `languages` adds the switch between the panel's languages below it. */
function Frame({ step, languages, children }: { step?: number; languages?: boolean; children: ReactNode }) {
  return (
    <div className="mz-backdrop flex min-h-full items-center justify-center px-4 py-12">
      <div className="mz-card w-full max-w-[468px]">
        <Logo className="mb-6 size-9" />
        {step !== undefined && (
          <ol className="mb-6 flex gap-1.5" aria-label={t('Passi dell’installazione')}>
            {steps().map((name, i) => (
              <li key={name} className="flex-1" aria-current={i === step ? 'step' : undefined}>
                <div className={cx('h-1 rounded-full', i <= step ? 'bg-accent' : 'bg-line')} />
                <div className={cx('mt-1.5 text-[12px]', i === step ? 'font-medium text-fg' : 'text-fg3')}>{name}</div>
              </li>
            ))}
          </ol>
        )}
        {children}
        {languages && (
          <div className="mt-4">
            <LanguageSwitch />
          </div>
        )}
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
      <Frame languages>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            setToken(typed.trim())
            setAskToken(false)
          }}
        >
          <h1 className="flex items-center gap-2 text-[20px] font-semibold tracking-tight">
            <KeyRound className="size-5 text-fg3" /> {t('Serve il link di installazione')}
          </h1>
          <p className="mt-2 mb-5 text-[14px] leading-relaxed text-fg2">
            {tx(
              'Per sicurezza, solo chi ha avviato il server può installare Materialize. All’avvio ha scritto un link che finisce con {link}: aprilo, oppure incolla qui il codice dopo l’uguale.',
              { link: <code className="font-mono text-[13px] whitespace-nowrap">?installa=…</code> },
            )}
          </p>
          {/* Where the link is, by the way the server was started. */}
          <dl className="-mt-2 mb-5 space-y-1.5 rounded-xl bg-panel2 px-3.5 py-3 text-[13px]">
            {[
              { where: t('Con Docker'), how: 'docker compose logs materialize', command: true },
              { where: t('Su un server (VPS)'), how: 'journalctl -u materialize | grep installa', command: true },
              { where: t('Sul tuo computer'), how: t('nel terminale dove gira Materialize'), command: false },
            ].map(({ where, how, command }) => (
              <div key={where}>
                <dt className="text-fg3">{where}</dt>
                <dd className={cx('text-fg', command && 'font-mono text-[12.5px] break-all')}>{how}</dd>
              </div>
            ))}
          </dl>
          <Input
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            placeholder={t('Codice di installazione')}
            aria-label={t('Codice di installazione')}
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
            {t('Continua')}
          </Button>
        </form>
      </Frame>
    )

  if (done)
    return (
      <Frame>
        <h1 className="text-[20px] font-semibold tracking-tight">{t('Materialize è installato')}</h1>
        <p className="mt-2 text-[14px] leading-relaxed text-fg2">
          {tx(
            'Il sito {site} è pronto e il tuo account è attivo. Quando vorrai, nelle Impostazioni trovi l’email per i messaggi del sito e la verifica in due passaggi.',
            { site: <strong className="font-semibold text-fg">{siteName}</strong> },
          )}
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
          {t('Entra nel pannello')}
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
          ? t('La password deve avere almeno 10 caratteri')
          : issues.some((i) => i.path === 'email')
            ? t('Controlla l’indirizzo email')
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
      <ArrowLeft /> {t('Indietro')}
    </button>
  )

  if (step === 0)
    return (
      <Frame step={0} languages>
        <h1 className="text-[20px] font-semibold tracking-tight">{t('Benvenuto in Materialize')}</h1>
        <p className="mt-1 mb-5 text-[14px] text-fg2">
          {t('Tre passi e il sito è pronto. Prima, un controllo del server.')}
        </p>
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
            {t('Prima di continuare va sistemato quello segnato in rosso, poi ricarica la pagina.')}
          </p>
        )}
        <Button variant="primary" className="mt-6 w-full" disabled={blocked} onClick={() => setStep(1)} autoFocus>
          {t('Continua')}
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
          <h1 className="text-[20px] font-semibold tracking-tight">{t('Il sito')}</h1>
          <p className="mt-1 mb-5 text-[14px] text-fg2">
            {t('Si possono cambiare in qualsiasi momento dalle Impostazioni.')}
          </p>
          <div className="space-y-3.5">
            <label className="block">
              <span className={label}>{t('Nome del sito')}</span>
              <Input
                value={siteName}
                onChange={(e) => setSiteName(e.target.value)}
                required
                maxLength={120}
                autoFocus
              />
            </label>
            <label className="block">
              <span className={label}>{t('Lingua principale')}</span>
              <select value={locale} onChange={(e) => setLocale(e.target.value)} className={inputClass}>
                {languages.map((l) => (
                  <option key={l} value={l}>
                    {localeName(l)}
                  </option>
                ))}
              </select>
              <span className="mt-1 block text-[13px] text-fg3">
                {t('Altre lingue si aggiungono dopo, in Impostazioni → Lingue.')}
              </span>
            </label>
          </div>
          <Button type="submit" variant="primary" className="mt-6 w-full">
            {t('Continua')}
          </Button>
          <div className="mt-4">{back}</div>
        </form>
      </Frame>
    )

  return (
    <Frame step={2}>
      <form onSubmit={submit}>
        <h1 className="text-[20px] font-semibold tracking-tight">{t('Il tuo account')}</h1>
        <p className="mt-1 mb-5 text-[14px] text-fg2">
          {t('Sarai l’amministratore: potrai invitare altre persone dopo.')}
        </p>
        <div className="space-y-3.5">
          <label className="block">
            <span className={label}>{t('Nome')}</span>
            <Input value={name} onChange={(e) => setName(e.target.value)} required autoComplete="name" autoFocus />
          </label>
          <label className="block">
            <span className={label}>{t('Email')}</span>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </label>
          <label className="block">
            <span className={label}>{t('Password')}</span>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={10}
              autoComplete="new-password"
            />
            <span className="mt-1 block text-[13px] text-fg3">{t('Almeno 10 caratteri.')}</span>
          </label>
        </div>
        {error && (
          <p role="alert" className="mt-4 text-[14px] text-danger">
            {error}
          </p>
        )}
        <Button type="submit" variant="primary" loading={busy} className="mt-6 w-full">
          {t('Installa')}
        </Button>
        <div className="mt-4">{back}</div>
      </form>
    </Frame>
  )
}
