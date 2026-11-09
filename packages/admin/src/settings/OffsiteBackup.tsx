import { useQuery, useQueryClient } from '@tanstack/react-query'
import { CircleAlert, CircleCheck, CloudUpload, Copy, Download, KeyRound } from 'lucide-react'
import { type FormEvent, type ReactNode, useEffect, useState } from 'react'
import { Button, Dialog, Input, Segmented, toast } from '../components/ui.tsx'
import { api, type OffsiteForm, type OffsiteState } from '../lib/api.ts'
import { fullDate, relativeTime } from '../lib/format.ts'
import { t, tn, tx } from '../lib/i18n.ts'

const label = 'mb-1 block text-[13px] font-medium text-fg2'
const hint = 'mt-1 block text-[13px] leading-relaxed text-fg3'

function Field({ name, help, children }: { name: string; help?: ReactNode; children: ReactNode }) {
  return (
    // biome-ignore lint/a11y/noLabelWithoutControl: the input arrives as children
    <label className="block">
      <span className={label}>{name}</span>
      {children}
      {help && <span className={hint}>{help}</span>}
    </label>
  )
}

const empty = (s: OffsiteState): OffsiteForm => ({
  kind: s.kind,
  keep: s.keep,
  s3: {
    endpoint: s.s3?.endpoint ?? '',
    region: s.s3?.region ?? 'auto',
    bucket: s.s3?.bucket ?? '',
    prefix: s.s3?.prefix ?? '',
    accessKeyId: s.s3?.accessKeyId ?? '',
    secretAccessKey: '',
  },
  webdav: { url: s.webdav?.url ?? '', user: s.webdav?.user ?? '', password: '' },
})

/** Only what the chosen kind needs goes to the server. */
const toSend = (f: OffsiteForm): OffsiteForm => ({
  kind: f.kind,
  keep: f.keep,
  ...(f.kind === 's3' ? { s3: f.s3 } : {}),
  ...(f.kind === 'webdav' ? { webdav: f.webdav } : {}),
})

/**
 * Impostazioni → Sicurezza → Backup: every night an encrypted copy of the backups on an
 * S3-compatible storage or a WebDAV folder, so that losing the server does not lose the site.
 */
export function OffsiteBackup() {
  const queryClient = useQueryClient()
  const query = useQuery({
    queryKey: ['offsite'],
    queryFn: api.offsite,
    refetchInterval: (q) => (q.state.data?.running ? 2000 : false),
  })
  const [form, setForm] = useState<OffsiteForm | null>(null)
  const [busy, setBusy] = useState<'save' | 'test' | 'run' | null>(null)
  const [shownKey, setShownKey] = useState<string | null>(null)
  const [askPassword, setAskPassword] = useState(false)
  const data = query.data
  useEffect(() => {
    if (data && !form) setForm(empty(data))
  }, [data, form])
  if (!data || !form) return null

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ['security-overview'] })
    void queryClient.invalidateQueries({ queryKey: ['activity'] })
  }
  const s3 = form.s3 as NonNullable<OffsiteForm['s3']>
  const dav = form.webdav as NonNullable<OffsiteForm['webdav']>
  const setS3 = (patch: Partial<typeof s3>) => setForm({ ...form, s3: { ...s3, ...patch } })
  const setDav = (patch: Partial<typeof dav>) => setForm({ ...form, webdav: { ...dav, ...patch } })

  const test = async () => {
    setBusy('test')
    try {
      const res = await api.testOffsite(toSend(form))
      toast(
        res.ok ? t('Collegamento riuscito: scrittura, lettura ed eliminazione funzionano') : (res.message ?? ''),
        res.ok ? 'ok' : 'error',
      )
    } catch (error) {
      toast((error as Error).message, 'error')
    } finally {
      setBusy(null)
    }
  }
  const save = async (e: FormEvent) => {
    e.preventDefault()
    setBusy('save')
    try {
      const res = await api.saveOffsite(toSend(form))
      queryClient.setQueryData(['offsite'], res)
      setForm(empty(res))
      if (res.recoveryKey) setShownKey(res.recoveryKey)
      toast(form.kind === 'off' ? t('Copia fuori dal server spenta') : t('Impostazioni salvate'))
      refresh()
    } catch (error) {
      toast((error as Error).message, 'error')
    } finally {
      setBusy(null)
    }
  }
  const run = async () => {
    setBusy('run')
    try {
      queryClient.setQueryData(['offsite'], await api.runOffsite())
      toast(t('Copia avviata: prosegue anche se lasci la pagina'))
      refresh()
    } catch (error) {
      toast((error as Error).message, 'error')
    } finally {
      setBusy(null)
    }
  }

  const saved = data.kind !== 'off' && data.hasKey
  const status = data.status

  return (
    <>
      <form onSubmit={save} className="space-y-4 rounded-lg border border-line bg-panel px-4 py-3.5">
        <div>
          <div className="flex items-center gap-2 text-[14px] font-medium [&_svg]:size-4 [&_svg]:text-fg3">
            <CloudUpload /> {t('Copia fuori dal server')}
          </div>
          <p className="mt-0.5 text-[13px] leading-relaxed text-fg3">
            {t(
              'Ogni notte la copia del database e le immagini nuove vanno su uno spazio esterno, cifrate prima di uscire: se il server si rompe, il sito si ricostruisce da lì. Chi apre lo spazio vede solo dati illeggibili.',
            )}
          </p>
        </div>

        <Segmented
          value={form.kind}
          onChange={(kind) => setForm({ ...form, kind })}
          options={[
            { value: 'off', label: t('Spenta') },
            { value: 's3', label: t('S3 compatibile') },
            { value: 'webdav', label: 'WebDAV' },
          ]}
        />

        {form.kind === 's3' && (
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Field
                name={t('Indirizzo del servizio (endpoint)')}
                help={t(
                  'Cloudflare R2: https://<account>.r2.cloudflarestorage.com · Backblaze B2: https://s3.<regione>.backblazeb2.com · Hetzner: https://<regione>.your-objectstorage.com · Amazon: https://s3.<regione>.amazonaws.com',
                )}
              >
                <Input
                  value={s3.endpoint}
                  onChange={(e) => setS3({ endpoint: e.target.value.trim() })}
                  placeholder="https://…"
                  required
                />
              </Field>
            </div>
            <Field name="Bucket">
              <Input value={s3.bucket} onChange={(e) => setS3({ bucket: e.target.value.trim() })} required />
            </Field>
            <Field
              name={t('Regione')}
              help={t('auto per Cloudflare R2; altrimenti quella del bucket, per esempio eu-central-1')}
            >
              <Input value={s3.region} onChange={(e) => setS3({ region: e.target.value.trim() })} />
            </Field>
            <Field name="Access key ID">
              <Input
                value={s3.accessKeyId}
                onChange={(e) => setS3({ accessKeyId: e.target.value.trim() })}
                autoComplete="off"
                required
              />
            </Field>
            <Field name="Secret access key">
              <Input
                type="password"
                value={s3.secretAccessKey}
                onChange={(e) => setS3({ secretAccessKey: e.target.value })}
                placeholder={data.s3?.hasSecret ? `•••••••• (${t('salvata')})` : ''}
                autoComplete="new-password"
                required={!data.s3?.hasSecret}
              />
            </Field>
            <div className="sm:col-span-2">
              <Field
                name={t('Cartella nel bucket')}
                help={t('Facoltativa: utile se nello stesso bucket metti più siti.')}
              >
                <Input
                  value={s3.prefix ?? ''}
                  onChange={(e) => setS3({ prefix: e.target.value.trim() })}
                  placeholder={t('sito')}
                />
              </Field>
            </div>
          </div>
        )}

        {form.kind === 'webdav' && (
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Field
                name={t('Indirizzo della cartella')}
                help={t(
                  'Nextcloud: https://cloud.example.com/remote.php/dav/files/<utente>/backup-sito/ · la cartella si crea da sola, quella che la contiene deve esistere.',
                )}
              >
                <Input
                  value={dav.url}
                  onChange={(e) => setDav({ url: e.target.value.trim() })}
                  placeholder="https://…"
                  required
                />
              </Field>
            </div>
            <Field name={t('Utente')}>
              <Input value={dav.user} onChange={(e) => setDav({ user: e.target.value })} autoComplete="off" />
            </Field>
            <Field
              name="Password"
              help={t('Con Nextcloud, meglio una password per app (Impostazioni personali → Sicurezza).')}
            >
              <Input
                type="password"
                value={dav.password}
                onChange={(e) => setDav({ password: e.target.value })}
                placeholder={data.webdav?.hasSecret ? `•••••••• (${t('salvata')})` : ''}
                autoComplete="new-password"
              />
            </Field>
          </div>
        )}

        {form.kind !== 'off' && (
          <label className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-fg2">
            <span className="whitespace-nowrap">{t('Copie del database da tenere')}</span>
            <select
              value={form.keep}
              onChange={(e) => setForm({ ...form, keep: Number(e.target.value) })}
              className="h-7 rounded-md border border-line2 bg-input px-1.5 text-[13px] text-fg outline-none"
            >
              {[7, 14, 30, 90, 365].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
            <span className="text-fg3">· {t('le immagini restano tutte')}</span>
          </label>
        )}

        <div className="flex flex-wrap items-center gap-2">
          {form.kind !== 'off' && (
            <Button size="sm" loading={busy === 'test'} onClick={test}>
              {t('Prova il collegamento')}
            </Button>
          )}
          <Button size="sm" variant="primary" type="submit" loading={busy === 'save'}>
            {t('Salva')}
          </Button>
          {saved && (
            <Button size="sm" loading={busy === 'run' || data.running} onClick={run} disabled={data.running}>
              {data.running ? t('Copia in corso…') : t('Esegui ora')}
            </Button>
          )}
          {data.hasKey && (
            <button
              type="button"
              onClick={() => setAskPassword(true)}
              className="ml-auto flex items-center gap-1.5 text-[13px] text-fg2 hover:text-fg [&_svg]:size-3.5"
            >
              <KeyRound /> {t('Mostra la chiave di ripristino')}
            </button>
          )}
        </div>

        {saved && status && (
          <p
            className={`flex items-start gap-2 text-[13px] leading-relaxed [&_svg]:mt-0.5 [&_svg]:size-4 [&_svg]:shrink-0 ${status.ok ? 'text-fg2 [&_svg]:text-ok' : 'text-danger'}`}
            role="status"
          >
            {status.ok ? <CircleCheck /> : <CircleAlert />}
            <span>
              <span title={fullDate(status.at)}>{relativeTime(status.at)}</span>
              {status.ok
                ? `: ${status.media ? tn(status.media, 'copia riuscita, {n} file nuovo dalla libreria.', 'copia riuscita, {n} file nuovi dalla libreria.') : t('copia riuscita.')}`
                : `: ${status.message}`}
            </span>
          </p>
        )}
        {saved && !status && !data.running && (
          <p className="text-[13px] text-fg3">
            {t('La prima copia parte entro un’ora, oppure subito con Esegui ora.')}
          </p>
        )}
      </form>
      {/* Outside the form: the password dialog has a form of its own. */}
      <RecoveryKeyDialog recoveryKey={shownKey} onClose={() => setShownKey(null)} />
      <PasswordDialog
        open={askPassword}
        onClose={() => setAskPassword(false)}
        onKey={(k) => {
          setAskPassword(false)
          setShownKey(k)
        }}
      />
    </>
  )
}

/** The recovery key, with what it is for: shown after the first save, or on request. */
function RecoveryKeyDialog({ recoveryKey, onClose }: { recoveryKey: string | null; onClose: () => void }) {
  const [kept, setKept] = useState(false)
  if (!recoveryKey) return null
  const file = () => {
    const text = `${t('Chiave di ripristino dei backup di Materialize')}\n\n${recoveryKey}\n\n${t('Serve per decifrare i backup salvati fuori dal server:')}\nnpx materialize decrypt <${t('cartella')}> --key ${recoveryKey}\n`
    const url = URL.createObjectURL(new Blob([text], { type: 'text/plain' }))
    const a = document.createElement('a')
    a.href = url
    a.download = t('materialize-chiave-di-ripristino.txt')
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 10_000)
  }
  return (
    <Dialog
      open
      onClose={() => kept && onClose()}
      title={t('La chiave di ripristino')}
      width={480}
      footer={
        <Button
          variant="primary"
          disabled={!kept}
          onClick={() => {
            setKept(false)
            onClose()
          }}
        >
          {t('Fatto')}
        </Button>
      }
    >
      <p className="text-[14px] leading-relaxed text-fg2">
        {tx(
          'I backup fuori dal server sono cifrati con questa chiave. {without}: conservala lontano dal server, per esempio nel gestore di password o stampata.',
          { without: <strong className="text-fg">{t('Senza, non si possono rimettere')}</strong> },
        )}
      </p>
      <code className="mt-3 block rounded-md bg-panel2 px-3 py-2.5 font-mono text-[13px] break-all select-all">
        {recoveryKey}
      </code>
      <div className="mt-3 flex gap-2">
        <Button
          size="sm"
          icon={<Copy className="size-3.5" />}
          onClick={() =>
            void navigator.clipboard.writeText(recoveryKey).then(
              () => toast(t('Chiave copiata')),
              () => toast(t('Selezionala e copiala a mano'), 'error'),
            )
          }
        >
          {t('Copia')}
        </Button>
        <Button size="sm" icon={<Download className="size-3.5" />} onClick={file}>
          {t('Scarica come file')}
        </Button>
      </div>
      <label className="mt-4 flex items-center gap-2 text-[14px]">
        <input type="checkbox" checked={kept} onChange={(e) => setKept(e.target.checked)} className="size-4" />
        {t('L’ho salvata in un posto sicuro')}
      </label>
    </Dialog>
  )
}

function PasswordDialog({
  open,
  onClose,
  onKey,
}: {
  open: boolean
  onClose: () => void
  onKey: (key: string) => void
}) {
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const submit = async (e: FormEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setBusy(true)
    setError(null)
    try {
      onKey((await api.offsiteKey(password)).recoveryKey)
      setPassword('')
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }
  return (
    <Dialog open={open} onClose={onClose} title={t('Mostra la chiave di ripristino')}>
      <form onSubmit={submit}>
        <p className="mb-3 text-[14px] text-fg2">{t('Per sicurezza, conferma la tua password.')}</p>
        <Input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          aria-label={t('Password')}
          autoFocus
          required
        />
        {error && (
          <p role="alert" className="mt-2 text-[13px] text-danger">
            {error}
          </p>
        )}
        <div className="mt-4 flex justify-end gap-2">
          <Button onClick={onClose}>{t('Annulla')}</Button>
          <Button type="submit" variant="primary" loading={busy}>
            {t('Mostra')}
          </Button>
        </div>
      </form>
    </Dialog>
  )
}
