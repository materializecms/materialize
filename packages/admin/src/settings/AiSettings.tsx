import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, Copy, KeyRound, Plug, Sparkles, Trash2 } from 'lucide-react'
import { type FormEvent, useEffect, useState } from 'react'
import { useSession } from '../app/context.ts'
import { Button, IconButton, Input, Segmented, Spinner, toast } from '../components/ui.tsx'
import { type AiSettings, api } from '../lib/api.ts'
import { relativeTime } from '../lib/format.ts'

/**
 * Impostazioni → AI e MCP: the model behind the assistant (admins), each person's access tokens,
 * and how to connect an AI client (Claude Code, Claude Desktop…) to the site.
 */
export function AiScreen() {
  const { user } = useSession()
  const [fresh, setFresh] = useState<string | null>(null)
  return (
    <div className="mx-auto max-w-2xl space-y-10 px-5 py-8">
      {user.role === 'admin' ? <ModelForm /> : <ModelStatus />}
      <Tokens onCreated={setFresh} fresh={fresh} />
      <Connect token={fresh} />
    </div>
  )
}

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4">
      <h2 className="flex items-center gap-2 text-[16px] font-semibold [&_svg]:size-4 [&_svg]:text-fg3">
        {icon}
        {title}
      </h2>
      {children}
    </section>
  )
}

function Field({ label, hint, children }: { label: string; hint?: React.ReactNode; children: React.ReactNode }) {
  return (
    // biome-ignore lint/a11y/noLabelWithoutControl: the control is passed in as children
    <label className="block space-y-1.5">
      <span className="text-[12.5px] font-medium">{label}</span>
      {children}
      {hint && <span className="block text-[11.5px] leading-relaxed text-fg3">{hint}</span>}
    </label>
  )
}

function Ready({ ready }: { ready: boolean }) {
  return (
    <span
      className={
        ready
          ? 'rounded-full bg-ok/12 px-2 py-0.5 text-[11.5px] font-medium text-ok'
          : 'rounded-full bg-hover px-2 py-0.5 text-[11.5px] font-medium text-fg3'
      }
    >
      {ready ? 'Attiva' : 'Da configurare'}
    </span>
  )
}

function ModelStatus() {
  const ai = useQuery({ queryKey: ['ai'], queryFn: api.ai }).data?.ai
  return (
    <Section icon={<Sparkles />} title="Assistente AI">
      <p className="flex items-center gap-2 text-[13px] text-fg2">
        Il modello lo sceglie un amministratore. {ai && <Ready ready={ai.ready} />}
      </p>
    </Section>
  )
}

const EMPTY: AiSettings = { provider: 'anthropic', baseUrl: '', model: '', ready: false }

function ModelForm() {
  const queryClient = useQueryClient()
  const saved = useQuery({ queryKey: ['ai'], queryFn: api.ai })
  const [ai, setAi] = useState<AiSettings>(EMPTY)
  const [key, setKey] = useState('')
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  useEffect(() => {
    if (saved.data) setAi(saved.data.ai)
  }, [saved.data])
  const set = (patch: Partial<AiSettings>) => setAi((a) => ({ ...a, ...patch }))
  const claude = ai.provider === 'anthropic'

  const save = async (e?: FormEvent) => {
    e?.preventDefault()
    setSaving(true)
    try {
      const res = await api.saveAi({
        provider: ai.provider,
        baseUrl: ai.baseUrl.trim(),
        model: ai.model.trim(),
        apiKey: key || undefined,
      })
      queryClient.setQueryData(['ai'], res)
      setKey('')
      toast('Impostazioni AI salvate')
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
    try {
      if (!(await save())) return
      const res = await api.testAi()
      toast(`Il modello risponde: “${res.reply.slice(0, 40)}”`)
    } catch (error) {
      toast((error as Error).message, 'error')
    } finally {
      setTesting(false)
    }
  }

  if (saved.isLoading) return <Spinner />
  return (
    <Section icon={<Sparkles />} title="Modello AI">
      <form onSubmit={save} className="space-y-5">
        <p className="flex flex-wrap items-center gap-2 text-[13px] leading-relaxed text-fg2">
          Scrive e modifica pagine con l’assistente dell’editor, e riscrive, traduce e descrive testi e immagini.
          <Ready ready={!!saved.data?.ai.ready} />
        </p>
        <Field label="Fornitore">
          <Segmented
            value={ai.provider}
            onChange={(provider) => set({ provider, model: '', baseUrl: '' })}
            options={[
              { value: 'anthropic', label: 'Claude (Anthropic)' },
              { value: 'openai', label: 'Compatibile OpenAI' },
            ]}
          />
        </Field>
        <Field
          label="Chiave API"
          hint={
            ai.hasKey
              ? 'Salvata: lascia vuoto per non cambiarla.'
              : claude && ai.envKey
                ? 'Il server ha già ANTHROPIC_API_KEY: puoi lasciare vuoto.'
                : claude
                  ? 'Da console.anthropic.com → API Keys. Resta sul server, il pannello non la rivede.'
                  : 'Facoltativa per i server locali come Ollama.'
          }
        >
          <Input
            type="password"
            value={key}
            autoComplete="off"
            placeholder={ai.hasKey ? '••••••••' : claude ? 'sk-ant-…' : 'sk-…'}
            onChange={(e) => setKey(e.target.value)}
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Modello" hint={claude ? 'Vuoto: Claude Opus 5.5.' : 'Il nome usato dal server.'}>
            <Input
              value={ai.model}
              placeholder={claude ? 'claude-opus-5-5' : 'gpt-5 · llama3.3 · qwen3'}
              onChange={(e) => set({ model: e.target.value })}
            />
          </Field>
          <Field
            label="Indirizzo del server"
            hint={claude ? 'Vuoto: l’API di Anthropic.' : 'Vuoto: OpenAI. Ollama: http://localhost:11434/v1'}
          >
            <Input
              value={ai.baseUrl}
              placeholder={claude ? 'https://api.anthropic.com' : 'https://api.openai.com/v1'}
              onChange={(e) => set({ baseUrl: e.target.value })}
            />
          </Field>
        </div>
        <div className="flex gap-2">
          <Button type="submit" variant="primary" loading={saving}>
            Salva
          </Button>
          <Button onClick={test} loading={testing}>
            Salva e prova
          </Button>
        </div>
      </form>
    </Section>
  )
}

function CopyButton({ text, label = 'Copia' }: { text: string; label?: string }) {
  const [done, setDone] = useState(false)
  return (
    <IconButton
      label={label}
      onClick={() =>
        void navigator.clipboard?.writeText(text).then(() => {
          setDone(true)
          setTimeout(() => setDone(false), 1500)
        })
      }
    >
      {done ? <Check /> : <Copy />}
    </IconButton>
  )
}

function Tokens({ fresh, onCreated }: { fresh: string | null; onCreated: (token: string) => void }) {
  const queryClient = useQueryClient()
  const list = useQuery({ queryKey: ['tokens'], queryFn: api.tokens })
  const [name, setName] = useState('')
  const [creating, setCreating] = useState(false)

  const create = async (e: FormEvent) => {
    e.preventDefault()
    setCreating(true)
    try {
      const res = await api.createToken(name.trim() || 'Client AI')
      onCreated(res.token)
      setName('')
      void queryClient.invalidateQueries({ queryKey: ['tokens'] })
    } catch (error) {
      toast((error as Error).message, 'error')
    } finally {
      setCreating(false)
    }
  }

  const revoke = async (id: string, label: string) => {
    if (!confirm(`Revocare “${label}”? I client che lo usano non potranno più collegarsi.`)) return
    try {
      await api.revokeToken(id)
      void queryClient.invalidateQueries({ queryKey: ['tokens'] })
      toast('Token revocato')
    } catch (error) {
      toast((error as Error).message, 'error')
    }
  }

  return (
    <Section icon={<KeyRound />} title="Token di accesso">
      <p className="text-[13px] leading-relaxed text-fg2">
        Un client AI collegato con un tuo token agisce come te: può fare quello che puoi fare tu nel pannello, nulla di
        più. Creane uno per ogni client, così puoi revocarlo da solo.
      </p>
      <form onSubmit={create} className="flex gap-2">
        <Input
          value={name}
          maxLength={80}
          placeholder="Nome, per esempio Claude Desktop sul portatile"
          onChange={(e) => setName(e.target.value)}
        />
        <Button type="submit" variant="primary" loading={creating}>
          Crea token
        </Button>
      </form>
      {fresh && (
        <div className="space-y-2 rounded-lg border border-accent/40 bg-accent/6 p-3">
          <p className="text-[12.5px] font-medium">Copialo ora: non lo vedrai più.</p>
          <div className="flex items-center gap-1">
            <code className="min-w-0 flex-1 truncate rounded-md bg-input px-2 py-1.5 font-mono text-[12px]">
              {fresh}
            </code>
            <CopyButton text={fresh} label="Copia il token" />
          </div>
        </div>
      )}
      {list.data && list.data.tokens.length > 0 && (
        <ul className="divide-y divide-line rounded-lg border border-line">
          {list.data.tokens.map((t) => (
            <li key={t.id} className="flex items-center gap-3 px-3 py-2">
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13px] font-medium">{t.name}</div>
                <div className="text-[11.5px] text-fg3">
                  <span className="font-mono">…{t.hint}</span> · creato {relativeTime(t.createdAt)} ·{' '}
                  {t.lastUsedAt ? `usato ${relativeTime(t.lastUsedAt)}` : 'mai usato'}
                </div>
              </div>
              <IconButton label={`Revoca ${t.name}`} onClick={() => revoke(t.id, t.name)} className="hover:text-danger">
                <Trash2 />
              </IconButton>
            </li>
          ))}
        </ul>
      )}
    </Section>
  )
}

function Snippet({ title, hint, code }: { title: string; hint?: string; code: string }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-[12.5px] font-medium">{title}</span>
        <CopyButton text={code} />
      </div>
      <pre className="overflow-x-auto rounded-lg bg-panel2 p-3 font-mono text-[11.5px] leading-relaxed whitespace-pre text-fg2">
        {code}
      </pre>
      {hint && <p className="text-[11.5px] leading-relaxed text-fg3">{hint}</p>}
    </div>
  )
}

function Connect({ token }: { token: string | null }) {
  const url = `${location.origin}/mcp`
  const t = token ?? 'IL_TUO_TOKEN'
  const desktop = JSON.stringify(
    {
      mcpServers: {
        materialize: {
          command: 'npx',
          args: ['-y', '@materializecms/cli', 'mcp', '--url', location.origin],
          env: { MATERIALIZE_TOKEN: t },
        },
      },
    },
    null,
    2,
  )
  return (
    <Section icon={<Plug />} title="Collegare un client AI (MCP)">
      <p className="text-[13px] leading-relaxed text-fg2">
        Con il protocollo MCP, Claude e altri assistenti leggono e modificano il sito: contenuti, pagine, tema e
        immagini. Le modifiche restano bozze finché non chiedi di pubblicarle.
        {!token && ' Crea un token qui sopra: comparirà già negli esempi.'}
      </p>
      <Snippet
        title="Indirizzo del server"
        code={url}
        hint="Per i client che si collegano via HTTP: intestazione Authorization: Bearer <token>."
      />
      <Snippet
        title="Claude Code"
        code={`claude mcp add --transport http materialize ${url} --header "Authorization: Bearer ${t}"`}
      />
      <Snippet
        title="Claude Desktop e client locali (stdio)"
        code={desktop}
        hint="Nel file di configurazione del client. Il CMS deve essere avviato."
      />
    </Section>
  )
}
