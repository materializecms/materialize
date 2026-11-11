import { ArchiveRestore, Upload } from 'lucide-react'
import { useRef, useState } from 'react'
import { Button, Spinner } from '../components/ui.tsx'
import { api } from '../lib/api.ts'
import { fullDate } from '../lib/format.ts'
import { t, tn } from '../lib/i18n.ts'

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/**
 * Waits for the restart: first for the server to stop (it answers before stopping), then for it to
 * come back, and starts the panel over. False after 15 minutes without it.
 */
async function waitForRestart(): Promise<boolean> {
  const up = async () => (await api.health().catch(() => null))?.ok === true
  const until = Date.now() + 15 * 60_000
  // Seen down at least once, or 30 seconds passed (a restart quicker than the checks).
  const stopping = Date.now() + 30_000
  while (Date.now() < stopping && (await up())) await sleep(1000)
  while (Date.now() < until) {
    if (await up()) {
      location.assign('/admin/')
      return true
    }
    await sleep(1500)
  }
  return false
}

/**
 * Uploads an archive made by «Scarica tutto» on another installation: the server checks it, then
 * restarts and puts it in place. With `token`, from the installation in the browser.
 */
export function RestoreUpload({ token, onCancel }: { token?: string; onCancel?: () => void }) {
  const input = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [progress, setProgress] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [restarting, setRestarting] = useState<{ site: string; media: number; createdAt: string | null } | null>(null)
  const [lost, setLost] = useState(false)

  const send = async () => {
    if (!file) return
    setError(null)
    setProgress(0)
    try {
      const res = await api.restoreArchive(file, setProgress, token)
      setRestarting(res.summary)
      if (!(await waitForRestart())) setLost(true)
    } catch (err) {
      setError((err as Error).message)
      setProgress(null)
    }
  }

  if (restarting)
    return (
      <div role="status" className="space-y-2 rounded-xl bg-panel2 p-4">
        <p className="flex items-center gap-2 text-[14px] font-medium">
          {!lost && <Spinner />}
          {lost
            ? t(
                'Il server non è ancora tornato. Controlla i suoi messaggi (con Docker: docker compose logs materialize), poi ricarica la pagina.',
              )
            : t('Archivio controllato: il sito riparte con i suoi contenuti…')}
        </p>
        <p className="text-[13px] text-fg2">
          {[
            restarting.site,
            tn(restarting.media, 'un’immagine', '{n} immagini'),
            restarting.createdAt ? t('salvato {when}', { when: fullDate(restarting.createdAt) }) : '',
          ]
            .filter(Boolean)
            .join(' · ')}
        </p>
        <p className="text-[13px] text-fg3">
          {t(
            'Ci vuole qualche minuto, il tempo di rimettere tutto e rigenerare il sito. Poi entri con gli account del sito ripristinato.',
          )}
        </p>
      </div>
    )

  return (
    <div className="space-y-3">
      <input
        ref={input}
        type="file"
        accept=".tar.gz,.tgz,application/gzip"
        className="hidden"
        onChange={(e) => {
          setFile(e.target.files?.[0] ?? null)
          setError(null)
        }}
      />
      <button
        type="button"
        onClick={() => input.current?.click()}
        disabled={progress !== null}
        className="flex w-full items-center gap-3 rounded-xl border border-dashed border-line2 px-4 py-3 text-left hover:border-accent disabled:opacity-60"
      >
        <ArchiveRestore className="size-5 shrink-0 text-fg3" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[14px] font-medium">
            {file ? file.name : t('Scegli l’archivio (materialize-….tar.gz)')}
          </span>
          <span className="block text-[12.5px] text-fg3">
            {file
              ? file.size < 1024 * 1024
                ? `${Math.max(1, Math.round(file.size / 1024))} KB`
                : `${(file.size / 1024 / 1024).toFixed(file.size > 1024 * 1024 * 100 ? 0 : 1)} MB`
              : t('Lo crea «Scarica tutto», in Impostazioni → Backup del sito di partenza.')}
          </span>
        </span>
      </button>
      {progress !== null && (
        <div
          className="h-1.5 overflow-hidden rounded-full bg-seg"
          role="progressbar"
          aria-valuenow={Math.round(progress * 100)}
        >
          <div className="h-full rounded-full bg-accent transition-[width]" style={{ width: `${progress * 100}%` }} />
        </div>
      )}
      {error && (
        <p role="alert" className="text-[13px] text-danger">
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        {onCancel && (
          <Button onClick={onCancel} disabled={progress !== null}>
            {t('Indietro')}
          </Button>
        )}
        <Button
          variant={token === undefined ? 'danger' : 'primary'}
          icon={<Upload className="size-4" />}
          disabled={!file}
          loading={progress !== null}
          onClick={send}
        >
          {progress !== null && progress < 1
            ? t('Caricamento {n}%', { n: Math.round(progress * 100) })
            : progress !== null
              ? t('Controllo l’archivio…')
              : t('Ripristina')}
        </Button>
      </div>
    </div>
  )
}
