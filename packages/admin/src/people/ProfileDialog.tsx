import { useQueryClient } from '@tanstack/react-query'
import { type FormEvent, useState } from 'react'
import { useSession } from '../app/context.ts'
import { Button, Dialog, Input, toast } from '../components/ui.tsx'
import { ApiError, api } from '../lib/api.ts'
import { Avatar, ROLES } from './PeopleScreen.tsx'

export function ProfileDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user } = useSession()
  const queryClient = useQueryClient()
  const [name, setName] = useState(user.name)
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
      if (next) await api.changePassword({ current, next })
      await queryClient.invalidateQueries({ queryKey: ['me'] })
      toast(next ? 'Profilo e password aggiornati' : 'Profilo aggiornato')
      setCurrent('')
      setNext('')
      onClose()
    } catch (err) {
      const issues = err instanceof ApiError ? err.issues : []
      setError(
        issues.some((i) => i.path === 'next')
          ? 'La nuova password deve avere almeno 10 caratteri'
          : (err as Error).message,
      )
    } finally {
      setBusy(false)
    }
  }

  const label = 'mb-1.5 block text-[12px] font-medium text-fg2'
  return (
    <Dialog open={open} onClose={onClose} width={420} title="Il tuo profilo">
      <form onSubmit={submit} className="space-y-4 pt-2">
        <div className="flex items-center gap-3">
          <Avatar name={name || user.name} size={40} />
          <div className="min-w-0">
            <div className="truncate text-[13px] text-fg">{user.email}</div>
            <div className="text-[12px] text-fg3">{ROLES[user.role].label}</div>
          </div>
        </div>
        <label className="block">
          <span className={label}>Nome</span>
          <Input value={name} onChange={(e) => setName(e.target.value)} required autoComplete="name" />
        </label>
        <fieldset className="space-y-3 rounded-lg border border-line p-3">
          <legend className="-ml-1 px-1 text-[12px] font-medium text-fg2">Cambia password</legend>
          <Input
            type="password"
            placeholder="Password attuale"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            required={!!next}
            autoComplete="current-password"
          />
          <Input
            type="password"
            placeholder="Nuova password, almeno 10 caratteri"
            value={next}
            onChange={(e) => setNext(e.target.value)}
            minLength={10}
            autoComplete="new-password"
          />
          <p className="text-[12px] text-fg3">Gli altri dispositivi verranno disconnessi.</p>
        </fieldset>
        {error && <p className="text-[13px] text-danger">{error}</p>}
        <div className="-mx-5 flex justify-end gap-2 border-t border-line px-5 pt-3">
          <Button onClick={onClose}>Annulla</Button>
          <Button type="submit" variant="primary" loading={busy}>
            Salva
          </Button>
        </div>
      </form>
    </Dialog>
  )
}
