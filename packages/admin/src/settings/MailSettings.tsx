import { mailProviders, providerByHost, providerById } from '@materializecms/core/mail'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { CircleAlert, CircleCheck, CircleX, Info, Send, ShieldCheck } from 'lucide-react'
import { type FormEvent, type ReactNode, useEffect, useState } from 'react'
import { Button, cx, Input, inputClass, Segmented, Spinner, toast } from '../components/ui.tsx'
import { api, type DomainCheck, type MailSettings } from '../lib/api.ts'
import { t } from '../lib/i18n.ts'
import { SettingsHeading, SettingsPage } from './SettingsPage.tsx'

const EMPTY: MailSettings = { host: '', port: 587, security: 'starttls', user: '', from: '', to: '', provider: '' }

function Field({ label, hint, children }: { label: string; hint?: ReactNode; children: ReactNode }) {
  return (
    // biome-ignore lint/a11y/noLabelWithoutControl: the control is passed in as children
    <label className="block space-y-1.5">
      <span className="text-[13px] font-medium">{label}</span>
      {children}
      {hint && <span className="block text-[13px] leading-relaxed text-fg3">{hint}</span>}
    </label>
  )
}

const ICON = {
  ok: <CircleCheck className="text-ok" />,
  warn: <CircleAlert className="text-warn" />,
  bad: <CircleX className="text-danger" />,
  info: <Info className="text-fg3" />,
}

/**
 * Impostazioni → Email. Choosing the provider fills in the server and says where to find the
 * credentials; a failed test says why (blocked port, refused password, unverified sender); the
 * sender's domain is checked for SPF, DKIM and DMARC, which keep the messages out of spam.
 */
export function MailForm() {
  const queryClient = useQueryClient()
  const saved = useQuery({ queryKey: ['mail'], queryFn: api.mail })
  const [mail, setMail] = useState<MailSettings>(EMPTY)
  const [pass, setPass] = useState('')
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [problem, setProblem] = useState<{ message: string; hint?: string } | null>(null)
  const [domain, setDomain] = useState<{ domain: string; checks: DomainCheck[] } | null>(null)
  const [checking, setChecking] = useState(false)
  useEffect(() => {
    if (!saved.data) return
    const m = saved.data.mail
    // Settings saved before the list existed: the provider is recognized from the server.
    setMail({ ...m, provider: m.provider || (m.host ? (providerByHost(m.host)?.id ?? '') : '') })
  }, [saved.data])
  const set = (patch: Partial<MailSettings>) => setMail((m) => ({ ...m, ...patch }))
  const provider = providerById(mail.provider)

  const choose = (id: string) => {
    const p = providerById(id)
    setProblem(null)
    setDomain(null)
    if (!p) return set({ provider: '' })
    set({ provider: p.id, host: p.host, port: p.port, security: p.security, ...(p.user ? { user: p.user } : {}) })
  }

  const checkDomain = async (from = mail.from) => {
    setChecking(true)
    try {
      setDomain(await api.mailDomain(from, mail.provider || undefined))
    } catch (error) {
      toast((error as Error).message, 'error')
    } finally {
      setChecking(false)
    }
  }

  const save = async (e?: FormEvent) => {
    e?.preventDefault()
    setSaving(true)
    try {
      const res = await api.saveMail({ ...mail, pass: pass || undefined })
      queryClient.setQueryData(['mail'], res)
      setPass('')
      if (!e) return true
      toast(t('Impostazioni email salvate'))
      if (/@/.test(mail.from)) void checkDomain()
      return true
    } catch (error) {
      toast((error as Error).message, 'error')
      return false
    } finally {
      setSaving(false)
    }
  }

  const test = async () => {
    setTesting(true)
    setProblem(null)
    try {
      if (!(await save())) return
      const res = await api.testMail()
      if (res.ok) toast(t('Email di prova inviata a {to}: controlla anche lo spam', { to: res.to }))
      else setProblem({ message: res.message ?? t('Invio non riuscito'), hint: res.hint })
      if (/@/.test(mail.from)) void checkDomain()
    } catch (error) {
      toast((error as Error).message, 'error')
    } finally {
      setTesting(false)
    }
  }

  if (saved.isLoading) return <Spinner />
  return (
    <SettingsPage onSubmit={save} className="space-y-6">
      <SettingsHeading
        title={t('Invio delle email')}
        description={t(
          'Con un server di posta i messaggi dei moduli del sito arrivano anche per email, e così inviti e link per una nuova password. Senza, i messaggi restano comunque in Messaggi.',
        )}
      />

      <Field label={t('Il tuo fornitore')}>
        <select value={mail.provider ?? ''} onChange={(e) => choose(e.target.value)} className={inputClass}>
          <option value="">{t('Altro: inserisco io i dati')}</option>
          {mailProviders().map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </Field>
      {provider?.note && (
        <p className="-mt-3 flex gap-2 rounded-xl bg-panel2 px-3 py-2 text-[13px] leading-relaxed text-fg2 [&_svg]:mt-0.5 [&_svg]:size-3.5 [&_svg]:shrink-0">
          <Info className="text-fg3" /> {provider.note}
        </p>
      )}

      <div className="grid grid-cols-[1fr_120px] gap-3">
        <Field label={t('Server')}>
          <Input
            value={mail.host}
            placeholder="smtp.example.com"
            onChange={(e) => set({ host: e.target.value.trim() })}
          />
        </Field>
        <Field label={t('Porta')}>
          <Input type="number" value={mail.port} onChange={(e) => set({ port: Number(e.target.value) || 587 })} />
        </Field>
      </div>
      <Field label={t('Sicurezza')} hint={t('TLS di solito sulla porta 465, STARTTLS sulla 587.')}>
        <Segmented
          value={mail.security}
          onChange={(security) =>
            set({ security, port: security === 'tls' ? 465 : security === 'starttls' ? 587 : mail.port })
          }
          options={[
            { value: 'starttls', label: 'STARTTLS' },
            { value: 'tls', label: 'TLS' },
            { value: 'none', label: t('Nessuna') },
          ]}
        />
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={t('Utente')} hint={provider?.userHint}>
          <Input
            value={mail.user}
            autoComplete="off"
            readOnly={!!provider?.user}
            onChange={(e) => set({ user: e.target.value.trim() })}
          />
        </Field>
        <Field
          label={t('Password')}
          hint={[
            provider?.passHint,
            mail.hasPassword ? t('Salvata: lascia vuoto per non cambiarla. Se cambi server, va scritta di nuovo.') : '',
          ]
            .filter(Boolean)
            .join(' ')}
        >
          <Input
            type="password"
            value={pass}
            autoComplete="new-password"
            placeholder={mail.hasPassword ? '••••••••' : ''}
            onChange={(e) => setPass(e.target.value)}
          />
        </Field>
      </div>
      <Field label={t('Mittente')} hint={t('Come appare a chi riceve, per esempio Studio Rossi <sito@example.com>.')}>
        <Input
          value={mail.from}
          placeholder={t('Nome <indirizzo@example.com>')}
          onChange={(e) => set({ from: e.target.value })}
        />
      </Field>
      <Field label={t('Destinatario dei moduli')} hint={t('Dove arrivano i messaggi inviati dal sito.')}>
        <Input value={mail.to} placeholder="studio@example.com" onChange={(e) => set({ to: e.target.value.trim() })} />
      </Field>

      {problem && (
        <div role="alert" className="rounded-lg bg-danger/10 px-4 py-3 text-[14px]">
          <div className="font-medium">{problem.message}</div>
          {problem.hint && <div className="mt-1 leading-relaxed text-fg2">{problem.hint}</div>}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <Button type="submit" variant="primary" loading={saving}>
          {t('Salva')}
        </Button>
        <Button icon={<Send className="size-3.5" />} loading={testing} onClick={test} disabled={!mail.host}>
          {t('Salva e invia una prova')}
        </Button>
        <Button
          icon={<ShieldCheck className="size-3.5" />}
          loading={checking}
          onClick={() => void checkDomain()}
          disabled={!/@/.test(mail.from)}
        >
          {t('Controlla il dominio')}
        </Button>
      </div>

      {domain && (
        <section className="space-y-2" aria-label={t('Controllo del dominio')}>
          <h3 className="text-[14px] font-medium">
            {t('Il dominio {domain}, visto dai server di posta', { domain: domain.domain })}
          </h3>
          <ul className="divide-y divide-line overflow-hidden rounded-2xl bg-panel2">
            {domain.checks.map((c) => (
              <li key={c.id} className="flex gap-3 px-4 py-3 [&_svg]:mt-0.5 [&_svg]:size-4 [&_svg]:shrink-0">
                {ICON[c.state]}
                <span className="min-w-0">
                  <span className="block text-[14px] font-medium">{c.title}</span>
                  <span className={cx('block text-[13px] leading-relaxed text-fg3', 'break-words')}>{c.detail}</span>
                </span>
              </li>
            ))}
          </ul>
          <p className="text-[13px] leading-relaxed text-fg3">
            {t(
              'SPF dice quali server possono inviare per il dominio, DKIM firma i messaggi, DMARC dice cosa fare con quelli che non passano. Si aggiungono nel pannello DNS del dominio; le modifiche possono metterci qualche ora.',
            )}
          </p>
        </section>
      )}
    </SettingsPage>
  )
}
