import { AlertTriangle, CalendarClock, X } from 'lucide-react'
import { useState } from 'react'
import { Button, cx, IconButton, Input, Popover, toast } from '../components/ui.tsx'
import { api, type Schedule, type StoredDocument } from '../lib/api.ts'
import { whenDate } from '../lib/format.ts'

/** A Date as the value of a datetime-local input, in the browser's time zone. */
const toInput = (d: Date) => {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** Tomorrow at 9, next Monday at 9: the times people pick most. */
function quickTimes(): { label: string; at: Date }[] {
  const at9 = (days: number) => {
    const d = new Date()
    d.setDate(d.getDate() + days)
    d.setHours(9, 0, 0, 0)
    return d
  }
  const monday = (8 - new Date().getDay()) % 7 || 7
  return [{ label: 'Domani alle 9', at: at9(1) }, ...(monday > 1 ? [{ label: 'Lunedì alle 9', at: at9(monday) }] : [])]
}

/**
 * When a document goes on the site, or comes off it, by itself. The trigger says when, if it is
 * set; a failed publication shows in red with its reason until someone acts on it.
 */
export function ScheduleMenu({
  doc,
  ensureSaved,
  onChange,
  onError,
}: {
  doc: StoredDocument | null
  /** Saves pending changes first: the server checks the draft as it will be published. */
  ensureSaved: () => Promise<StoredDocument | null>
  onChange: (doc: StoredDocument) => void
  onError: (error: unknown) => void
}) {
  const schedule = doc?.schedule
  const next = schedule?.publish ?? schedule?.unpublish ?? null
  const failed = schedule?.failed ?? null

  return (
    <Popover
      align="end"
      width={300}
      trigger={({ toggle, ref }) =>
        failed ? (
          <button
            ref={ref}
            type="button"
            onClick={toggle}
            title={failed.error ?? undefined}
            className="inline-flex h-7 items-center gap-1.5 rounded-md bg-danger/10 px-2 text-[12px] font-medium text-danger hover:bg-danger/15 [&_svg]:size-3.5"
          >
            <AlertTriangle /> <span className="max-md:hidden">Programmazione non riuscita</span>
          </button>
        ) : next ? (
          <button
            ref={ref}
            type="button"
            onClick={toggle}
            className="inline-flex h-7 items-center gap-1.5 rounded-md bg-accent/10 px-2 text-[12px] font-medium text-accent hover:bg-accent/15 [&_svg]:size-3.5"
          >
            <CalendarClock />
            <span className="max-md:hidden">
              {next.action === 'publish' ? 'Esce' : 'Si toglie'} {whenDate(next.runAt)}
            </span>
          </button>
        ) : (
          <IconButton ref={ref} label="Programma la pubblicazione" onClick={toggle}>
            <CalendarClock />
          </IconButton>
        )
      }
    >
      {() => (
        <div className="space-y-4 p-3.5">
          {failed && (
            <div className="rounded-md bg-danger/10 px-2.5 py-2 text-[12.5px] leading-snug text-danger">
              <p className="font-medium">
                {failed.action === 'publish' ? 'La pubblicazione' : 'La rimozione'} di {whenDate(failed.runAt)} non è
                riuscita
              </p>
              {failed.error && <p className="mt-0.5">{failed.error}.</p>}
              <p className="mt-0.5 text-danger/80">Sistema e programma di nuovo, oppure pubblica adesso.</p>
            </div>
          )}
          <When
            title="Pubblica il"
            hint="Esce la bozza com’è in quel momento: puoi continuare a modificarla."
            current={schedule?.publish ?? null}
            onSet={async (at) => {
              const saved = await ensureSaved()
              if (!saved) return
              onChange(await api.schedule(saved.id, 'publish', at))
              if (at) toast(`Uscirà ${whenDate(at)}`)
            }}
            onError={onError}
          />
          <When
            title="Togli dal sito il"
            hint="Per un’offerta o un evento: la pagina torna bozza da sola."
            current={schedule?.unpublish ?? null}
            disabled={!doc?.publishedAt && !schedule?.publish}
            disabledHint="Prima pubblicala, o programma quando esce."
            onSet={async (at) => {
              if (!doc) return
              onChange(await api.schedule(doc.id, 'unpublish', at))
              if (at) toast(`Verrà tolta dal sito ${whenDate(at)}`)
            }}
            onError={onError}
          />
        </div>
      )}
    </Popover>
  )
}

/** A date and time to pick, with quick choices; shared with releases. */
export function When({
  title,
  hint,
  current,
  disabled,
  disabledHint,
  onSet,
  onError,
}: {
  title: string
  hint: string
  current: Pick<Schedule, 'runAt' | 'createdByName'> | null
  disabled?: boolean
  disabledHint?: string
  onSet: (at: Date | null) => Promise<void>
  onError: (error: unknown) => void
}) {
  const [value, setValue] = useState(current ? toInput(new Date(current.runAt)) : '')
  const [busy, setBusy] = useState(false)
  const run = async (at: Date | null) => {
    setBusy(true)
    try {
      await onSet(at)
      if (!at) setValue('')
    } catch (error) {
      onError(error)
    } finally {
      setBusy(false)
    }
  }
  return (
    <section className={cx('space-y-1.5', disabled && 'opacity-55')}>
      <div className="flex items-center justify-between">
        <h3 className="text-[13px] font-medium">{title}</h3>
        {current && (
          <button
            type="button"
            onClick={() => void run(null)}
            className="inline-flex items-center gap-1 text-[12px] text-fg3 hover:text-danger [&_svg]:size-3"
          >
            <X /> Annulla
          </button>
        )}
      </div>
      {current && (
        <p className="text-[12.5px] text-accent">
          {whenDate(current.runAt)} · da {current.createdByName || 'qualcuno'}
        </p>
      )}
      <div className="flex gap-1.5">
        <Input
          type="datetime-local"
          aria-label={title}
          value={value}
          min={toInput(new Date(Date.now() + 60_000))}
          disabled={disabled}
          onChange={(e) => setValue(e.target.value)}
          className="h-8 min-w-0 flex-1"
        />
        <Button size="sm" disabled={disabled || !value} loading={busy} onClick={() => void run(new Date(value))}>
          {current ? 'Cambia' : 'Programma'}
        </Button>
      </div>
      {!disabled && !current && (
        <div className="flex flex-wrap gap-1">
          {quickTimes().map((q) => (
            <button
              key={q.label}
              type="button"
              onClick={() => setValue(toInput(q.at))}
              className="rounded-md border border-line px-1.5 py-0.5 text-[12px] text-fg2 hover:border-accent hover:text-fg"
            >
              {q.label}
            </button>
          ))}
        </div>
      )}
      <p className="text-[12px] leading-snug text-fg3">{disabled ? disabledHint : hint}</p>
    </section>
  )
}
