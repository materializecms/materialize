import { useQueryClient } from '@tanstack/react-query'
import { type FormEvent, useState } from 'react'
import { useSession } from '../app/context.ts'
import { Button, Dialog, Input, Segmented, toast } from '../components/ui.tsx'
import { ApiError, api } from '../lib/api.ts'
import { LANGS, type Lang, setLang, t } from '../lib/i18n.ts'
import { Avatar, ROLES } from './PeopleScreen.tsx'
import { SecurityPanel } from './Security.tsx'

export function ProfileDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user } = useSession()
  const [tab, setTab] = useState<'profile' | 'security'>('profile')
  const queryClient = useQueryClient()
  const [name, setName] = useState(user.name)
  const [email, setEmail] = useState(user.email)
  const [confirm, setConfirm] = useState('')
  const emailChanged = email.trim().toLowerCase() !== user.email
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      if (name.trim() && name.trim() !== user.name) await api.updateMe({ name: name.trim() })
      if (emailChanged) await api.changeEmail({ email: email.trim(), password: confirm })
      if (next) await api.changePassword({ current, next })
      await queryClient.invalidateQueries({ queryKey: ['me'] })
      toast(next ? t('Profilo e password aggiornati') : t('Profilo aggiornato'))
      setCurrent('')
      setNext('')
      setConfirm('')
      onClose()
    } catch (err) {
      const issues = err instanceof ApiError ? err.issues : []
      setError(
        issues.some((i) => i.path === 'next')
          ? t('La nuova password deve avere almeno 10 caratteri')
          : issues.some((i) => i.path === 'password')
            ? t('La password per confermare l’email non è corretta')
            : issues.some((i) => i.path === 'email')
              ? t('Scrivi un indirizzo email valido')
              : (err as Error).message,
      )
    } finally {
      setBusy(false)
    }
  }

  const label = 'mb-1.5 block text-[13px] font-medium text-fg2'
  return (
    <Dialog open={open} onClose={onClose} width={tab === 'security' ? 500 : 420} title={t('Il tuo profilo')}>
      <Segmented
        className="mt-1 mb-4 flex w-full"
        value={tab}
        onChange={setTab}
        options={[
          { value: 'profile', label: t('Profilo') },
          { value: 'security', label: t('Sicurezza') },
        ]}
      />
      {tab === 'security' ? (
        <div className="max-h-[62vh] overflow-y-auto pb-1">
          <SecurityPanel />
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <div className="flex items-center gap-3">
            <Avatar name={name || user.name} size={40} />
            <div className="min-w-0">
              <div className="truncate text-[14px] text-fg">{user.email}</div>
              <div className="text-[13px] text-fg3">{t(ROLES[user.role].label)}</div>
            </div>
          </div>
          <label className="block">
            <span className={label}>{t('Nome')}</span>
            <Input value={name} onChange={(e) => setName(e.target.value)} required autoComplete="name" />
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
            <span className="mt-1 block text-[13px] text-fg3">{t('È l’indirizzo con cui entri nel pannello.')}</span>
          </label>
          {emailChanged && (
            <label className="block">
              <span className={label}>{t('Conferma con la tua password')}</span>
              <Input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
                autoComplete="current-password"
              />
            </label>
          )}
          <div>
            <span className={label}>{t('Lingua del pannello')}</span>
            <Segmented
              className="flex w-full"
              size="sm"
              value={user.locale ?? 'auto'}
              onChange={async (value) => {
                const locale = value === 'auto' ? null : (value as Lang)
                try {
                  await api.updateMe({ locale })
                  await queryClient.invalidateQueries({ queryKey: ['me'] })
                  setLang(locale)
                } catch (err) {
                  toast((err as Error).message, 'error')
                }
              }}
              options={[
                ...LANGS.map((l) => ({ value: l.value, label: l.label })),
                { value: 'auto', label: t('Come il browser') },
              ]}
            />
          </div>
          <fieldset className="space-y-3 rounded-lg border border-line p-3">
            <legend className="-ml-1 px-1 text-[13px] font-medium text-fg2">{t('Cambia password')}</legend>
            <Input
              type="password"
              placeholder={t('Password attuale')}
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
              required={!!next}
              autoComplete="current-password"
            />
            <Input
              type="password"
              placeholder={t('Nuova password, almeno 10 caratteri')}
              value={next}
              onChange={(e) => setNext(e.target.value)}
              minLength={10}
              autoComplete="new-password"
            />
            <p className="text-[13px] text-fg3">{t('Gli altri dispositivi verranno disconnessi.')}</p>
          </fieldset>
          {error && <p className="text-[14px] text-danger">{error}</p>}
          <div className="-mx-5 flex justify-end gap-2 border-t border-line px-5 pt-3">
            <Button onClick={onClose}>{t('Annulla')}</Button>
            <Button type="submit" variant="primary" loading={busy}>
              {t('Salva')}
            </Button>
          </div>
        </form>
      )}
    </Dialog>
  )
}
