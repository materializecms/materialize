import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, Copy, Download, Laptop, Monitor, ShieldCheck, Smartphone } from 'lucide-react'
import qrcode from 'qrcode-generator'
import { type FormEvent, useMemo, useState } from 'react'
import { Button, cx, Input, Spinner, toast } from '../components/ui.tsx'
import { type AccountSecurity, ApiError, api } from '../lib/api.ts'
import { relativeTime } from '../lib/format.ts'

/** The QR code an authenticator app scans, drawn as SVG on white (phones read it in dark mode too). */
function QrCode({ value, size = 168 }: { value: string; size?: number }) {
  const cells = useMemo(() => {
    const qr = qrcode(0, 'M')
    qr.addData(value)
    qr.make()
    const n = qr.getModuleCount()
    const out: string[] = []
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (qr.isDark(r, c)) out.push(`M${c} ${r}h1v1h-1z`)
    return { n, path: out.join('') }
  }, [value])
  return (
    <svg
      viewBox={`-2 -2 ${cells.n + 4} ${cells.n + 4}`}
      width={size}
      height={size}
      role="img"
      aria-label="Codice QR da inquadrare con l’app"
      className="shrink-0 rounded-lg bg-white"
      shapeRendering="crispEdges"
    >
      <path d={cells.path} fill="#000" />
    </svg>
  )
}

/** Recovery codes, shown once: copy them or save them as a file. */
export function RecoveryCodes({ codes, onDone }: { codes: string[]; onDone: () => void }) {
  const text = `Codici di riserva per il pannello di ${location.host}\nOgni codice si usa una volta sola, al posto del codice dell'app.\n\n${codes.join('\n')}\n`
  return (
    <div className="space-y-3">
      <p className="text-[12.5px] leading-relaxed text-fg2">
        Se perdi il telefono, entri con uno di questi codici: ognuno vale una volta. Conservali in un posto sicuro, come
        un gestore di password. <strong className="font-medium text-fg">Non li vedrai più.</strong>
      </p>
      <ol className="grid grid-cols-2 gap-x-6 gap-y-1 rounded-lg border border-line bg-panel2 px-4 py-3 font-mono text-[13px]">
        {codes.map((c) => (
          <li key={c}>{c}</li>
        ))}
      </ol>
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          icon={<Copy className="size-3.5" />}
          onClick={() => navigator.clipboard?.writeText(text).then(() => toast('Codici copiati'))}
        >
          Copia
        </Button>
        <Button
          size="sm"
          icon={<Download className="size-3.5" />}
          onClick={() => {
            const a = document.createElement('a')
            a.href = URL.createObjectURL(new Blob([text], { type: 'text/plain' }))
            a.download = 'codici-di-riserva.txt'
            a.click()
            URL.revokeObjectURL(a.href)
          }}
        >
          Scarica
        </Button>
        <div className="flex-1" />
        <Button size="sm" variant="primary" icon={<Check className="size-3.5" />} onClick={onDone}>
          Li ho salvati
        </Button>
      </div>
    </div>
  )
}

/**
 * Turning two-step verification on: scan the code (or type the key), confirm with the first
 * code, save the recovery codes.
 */
export function TwoFactorSetup({ onDone, onCancel }: { onDone: () => void; onCancel?: () => void }) {
  const setup = useQuery({ queryKey: ['2fa-setup'], queryFn: api.setupTwoFactor, staleTime: Infinity, gcTime: 0 })
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [codes, setCodes] = useState<string[] | null>(null)

  if (codes) return <RecoveryCodes codes={codes} onDone={onDone} />
  if (setup.isPending) return <Spinner />
  if (setup.error || !setup.data) return <p className="text-[13px] text-danger">{setup.error?.message}</p>

  const confirm = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      setCodes((await api.enableTwoFactor(code)).recoveryCodes)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={confirm} className="space-y-4">
      <ol className="list-decimal space-y-1 pl-4 text-[12.5px] leading-relaxed text-fg2">
        <li>Apri un’app di autenticazione: Google Authenticator, Microsoft Authenticator, 1Password, Bitwarden…</li>
        <li>Inquadra il codice, oppure scrivi la chiave a mano.</li>
        <li>Inserisci il codice di 6 cifre che l’app mostra.</li>
      </ol>
      <div className="flex items-center gap-4">
        <QrCode value={setup.data.uri} />
        <div className="min-w-0 space-y-1.5">
          <span className="block text-[11.5px] font-medium text-fg3">Chiave</span>
          <code className="block font-mono text-[12px] leading-relaxed break-all text-fg2">
            {setup.data.secret.replace(/(.{4})/g, '$1 ').trim()}
          </code>
          <button
            type="button"
            className="text-[12px] font-medium text-accent hover:underline"
            onClick={() => navigator.clipboard?.writeText(setup.data.secret).then(() => toast('Chiave copiata'))}
          >
            Copia la chiave
          </button>
        </div>
      </div>
      <label className="block">
        <span className="mb-1.5 block text-[12px] font-medium text-fg2">Codice dall’app</span>
        <Input
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/[^\d]/g, '').slice(0, 6))}
          inputMode="numeric"
          autoComplete="one-time-code"
          placeholder="123456"
          required
          className="font-mono tracking-[0.3em]"
        />
      </label>
      {error && <p className="text-[13px] text-danger">{error}</p>}
      <div className="flex justify-end gap-2">
        {onCancel && <Button onClick={onCancel}>Annulla</Button>}
        <Button type="submit" variant="primary" loading={busy} disabled={code.length < 6}>
          Attiva
        </Button>
      </div>
    </form>
  )
}

/** "Chrome su macOS", from what the browser says it is. */
export function deviceName(userAgent: string | null): { label: string; mobile: boolean } {
  const ua = userAgent ?? ''
  const browser = /Edg\//.test(ua)
    ? 'Edge'
    : /Firefox\//.test(ua)
      ? 'Firefox'
      : /Chrome\//.test(ua)
        ? 'Chrome'
        : /Safari\//.test(ua)
          ? 'Safari'
          : /node|curl|undici/i.test(ua)
            ? 'Programma'
            : 'Browser'
  const os = /iPhone|iPad/.test(ua)
    ? 'iOS'
    : /Android/.test(ua)
      ? 'Android'
      : /Mac OS X|Macintosh/.test(ua)
        ? 'macOS'
        : /Windows/.test(ua)
          ? 'Windows'
          : /Linux/.test(ua)
            ? 'Linux'
            : ''
  return { label: os ? `${browser} su ${os}` : browser, mobile: /iPhone|Android|Mobile/.test(ua) }
}

/** Asks for the password before something sensitive (turning off, new recovery codes). */
function PasswordStep({
  label,
  danger,
  onConfirm,
  onCancel,
}: {
  label: string
  danger?: boolean
  onConfirm: (password: string) => Promise<void>
  onCancel: () => void
}) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  return (
    <form
      className="mt-3 flex gap-2"
      onSubmit={async (e) => {
        e.preventDefault()
        setBusy(true)
        setError(null)
        try {
          await onConfirm(password)
        } catch (err) {
          setError(
            err instanceof ApiError && err.code === 'wrong_password' ? 'Password non corretta' : (err as Error).message,
          )
          setBusy(false)
        }
      }}
    >
      <div className="min-w-0 flex-1">
        <Input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="La tua password"
          autoComplete="current-password"
          required
          autoFocus
        />
        {error && <p className="mt-1 text-[12px] text-danger">{error}</p>}
      </div>
      <Button onClick={onCancel}>Annulla</Button>
      <Button type="submit" variant={danger ? 'danger' : 'primary'} loading={busy}>
        {label}
      </Button>
    </form>
  )
}

/** Profilo → Sicurezza: two-step verification and the devices signed in. */
export function SecurityPanel() {
  const queryClient = useQueryClient()
  const query = useQuery({ queryKey: ['account-security'], queryFn: api.security })
  const [mode, setMode] = useState<'setup' | 'disable' | 'recovery' | null>(null)
  const [codes, setCodes] = useState<string[] | null>(null)
  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ['account-security'] })
    await queryClient.invalidateQueries({ queryKey: ['me'] })
  }

  if (!query.data) return <Spinner />
  const data: AccountSecurity = query.data
  const others = data.sessions.filter((s) => !s.current).length

  return (
    <div className="space-y-5">
      <section className="rounded-lg border border-line p-3.5">
        <div className="flex items-center gap-2.5">
          <ShieldCheck className={cx('size-4.5 shrink-0', data.twoFactor.enabled ? 'text-ok' : 'text-fg3')} />
          <div className="min-w-0 flex-1">
            <div className="text-[13px] font-medium">Verifica in due passaggi</div>
            <div className="text-[12px] text-fg3">
              {data.twoFactor.enabled
                ? `Attiva · ${data.twoFactor.recoveryLeft} codici di riserva rimasti`
                : 'Oltre alla password, un codice dall’app del telefono.'}
            </div>
          </div>
          {!data.twoFactor.enabled && mode !== 'setup' && !codes && (
            <Button size="sm" variant="primary" onClick={() => setMode('setup')}>
              Attiva
            </Button>
          )}
        </div>
        {codes ? (
          <div className="mt-3">
            <RecoveryCodes codes={codes} onDone={() => setCodes(null)} />
          </div>
        ) : mode === 'setup' ? (
          <div className="mt-4">
            <TwoFactorSetup
              onCancel={() => setMode(null)}
              onDone={() => {
                setMode(null)
                toast('Verifica in due passaggi attiva')
                void refresh()
              }}
            />
          </div>
        ) : mode === 'disable' ? (
          <PasswordStep
            label="Disattiva"
            danger
            onCancel={() => setMode(null)}
            onConfirm={async (password) => {
              await api.disableTwoFactor(password)
              setMode(null)
              toast('Verifica in due passaggi disattivata')
              await refresh()
            }}
          />
        ) : mode === 'recovery' ? (
          <PasswordStep
            label="Crea nuovi codici"
            onCancel={() => setMode(null)}
            onConfirm={async (password) => {
              setCodes((await api.newRecoveryCodes(password)).recoveryCodes)
              setMode(null)
              await refresh()
            }}
          />
        ) : (
          data.twoFactor.enabled && (
            <div className="mt-3 flex flex-wrap gap-2">
              <Button size="sm" onClick={() => setMode('recovery')}>
                Nuovi codici di riserva
              </Button>
              {data.required ? (
                <span className="self-center text-[12px] text-fg3">Il sito la richiede a tutti.</span>
              ) : (
                <Button size="sm" className="hover:text-danger" onClick={() => setMode('disable')}>
                  Disattiva
                </Button>
              )}
            </div>
          )
        )}
      </section>

      <section>
        <div className="mb-2 flex items-center">
          <h3 className="flex-1 text-[12px] font-medium text-fg2">Dispositivi collegati</h3>
          {others > 0 && (
            <button
              type="button"
              className="text-[12px] font-medium text-accent hover:underline"
              onClick={async () => {
                const { ended } = await api.endOtherSessions()
                toast(ended === 1 ? 'Un dispositivo disconnesso' : `${ended} dispositivi disconnessi`)
                await refresh()
              }}
            >
              Disconnetti gli altri
            </button>
          )}
        </div>
        <ul className="divide-y divide-line rounded-lg border border-line">
          {data.sessions.map((s) => {
            const device = deviceName(s.userAgent)
            return (
              <li key={s.id} className="flex items-center gap-3 px-3 py-2">
                <span className="text-fg3 [&_svg]:size-4">
                  {device.mobile ? <Smartphone /> : s.userAgent ? <Laptop /> : <Monitor />}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[12.5px] font-medium">
                    {device.label}
                    {s.current && <span className="ml-1.5 font-normal text-ok">· questo dispositivo</span>}
                  </div>
                  <div className="truncate text-[11.5px] text-fg3">
                    {s.ip && !/^(local|::1|127\.|::ffff:127\.)/.test(s.ip) ? `${s.ip} · ` : ''}
                    {s.current ? 'attivo ora' : `attivo ${relativeTime(s.lastSeenAt)}`} · entrato{' '}
                    {relativeTime(s.createdAt)}
                  </div>
                </div>
                {!s.current && (
                  <Button
                    size="sm"
                    onClick={async () => {
                      await api.endSession(s.id)
                      toast('Dispositivo disconnesso')
                      await refresh()
                    }}
                  >
                    Disconnetti
                  </Button>
                )}
              </li>
            )
          })}
        </ul>
        <p className="mt-1.5 text-[11.5px] text-fg3">Un accesso inutilizzato per 14 giorni si chiude da solo.</p>
      </section>
    </div>
  )
}
