import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, Copy, Trash2 } from 'lucide-react'
import { type FormEvent, useEffect, useState } from 'react'
import { useSession } from '../app/context.ts'
import { Button, IconButton, Input, Segmented, Spinner, toast } from '../components/ui.tsx'
import { type AiSettings, type AiUsage, api } from '../lib/api.ts'
import { relativeTime } from '../lib/format.ts'
import { intlLocale, t, tn } from '../lib/i18n.ts'
import { SettingsPage, SettingsSection } from './SettingsPage.tsx'

/**
 * Impostazioni → AI e MCP: the model behind the assistant (admins), each person's access tokens,
 * and how to connect an AI client (Claude Code, Claude Desktop…) to the site.
 */
export function AiScreen() {
  const { user } = useSession()
  const [fresh, setFresh] = useState<string | null>(null)
  return (
    <SettingsPage>
      {user.role === 'admin' ? <ModelForm /> : <ModelStatus />}
      <Tokens onCreated={setFresh} fresh={fresh} />
      <Connect token={fresh} />
    </SettingsPage>
  )
}

function Section({
  title,
  description,
  children,
}: {
  title: string
  description?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <SettingsSection title={title} description={description}>
      {children}
    </SettingsSection>
  )
}

function Field({ label, hint, children }: { label: string; hint?: React.ReactNode; children: React.ReactNode }) {
  return (
    // biome-ignore lint/a11y/noLabelWithoutControl: the control is passed in as children
    <label className="block space-y-1.5">
      <span className="block text-[13px] font-medium">{label}</span>
      {children}
      {hint && <span className="block text-[13px] leading-relaxed text-fg3">{hint}</span>}
    </label>
  )
}

function Ready({ ready }: { ready: boolean }) {
  return (
    <span
      className={
        ready
          ? 'rounded-full bg-ok/12 px-2 py-0.5 text-[12px] font-medium text-ok'
          : 'rounded-full bg-hover px-2 py-0.5 text-[12px] font-medium text-fg3'
      }
    >
      {ready ? t('Attiva') : t('Da configurare')}
    </span>
  )
}

function ModelStatus() {
  const ai = useQuery({ queryKey: ['ai'], queryFn: api.ai }).data?.ai
  return (
    <Section title={t('Assistente AI')}>
      <p className="flex items-center gap-2 text-[14px] text-fg2">
        {t('Il modello lo sceglie un amministratore.')} {ai && <Ready ready={ai.ready} />}
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
        fastModel: (ai.fastModel ?? '').trim(),
        apiKey: key || undefined,
      })
      // The month's usage stays: the save answers with the settings only.
      queryClient.setQueryData(['ai'], (old: typeof saved.data) => ({ ...old, ...res }))
      setKey('')
      toast(t('Impostazioni AI salvate'))
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
      toast(t('Il modello risponde: “{reply}”', { reply: res.reply.slice(0, 40) }))
    } catch (error) {
      toast((error as Error).message, 'error')
    } finally {
      setTesting(false)
    }
  }

  if (saved.isLoading) return <Spinner />
  return (
    <Section title={t('Modello AI')}>
      <form onSubmit={save} className="space-y-5">
        <p className="flex flex-wrap items-center gap-2 text-[14px] leading-relaxed text-fg2">
          {t('Scrive e modifica pagine con l’assistente dell’editor, e riscrive, traduce e descrive testi e immagini.')}
          <Ready ready={!!saved.data?.ai.ready} />
        </p>
        <Field label={t('Fornitore')}>
          <Segmented
            value={ai.provider}
            onChange={(provider) => set({ provider, model: '', fastModel: '', baseUrl: '' })}
            options={[
              { value: 'anthropic', label: 'Claude (Anthropic)' },
              { value: 'openai', label: t('Compatibile OpenAI') },
            ]}
          />
        </Field>
        <Field
          label={t('Chiave API')}
          hint={
            ai.hasKey
              ? t('Salvata: lascia vuoto per non cambiarla. Se cambi fornitore o indirizzo, va scritta di nuovo.')
              : claude && ai.envKey
                ? t('Il server ha già ANTHROPIC_API_KEY: puoi lasciare vuoto.')
                : claude
                  ? t('Da console.anthropic.com → API Keys. Resta sul server, il pannello non la rivede.')
                  : t('Facoltativa per i server locali come Ollama.')
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
          <Field
            label={t('Modello principale')}
            hint={claude ? t('Vuoto: Claude Opus 5.5.') : t('Il nome usato dal server.')}
          >
            <Input
              value={ai.model}
              placeholder={claude ? 'claude-opus-5-5' : 'gpt-5 · llama3.3 · qwen3'}
              onChange={(e) => set({ model: e.target.value })}
            />
          </Field>
          <Field
            label={t('Indirizzo del server')}
            hint={
              claude
                ? t('Vuoto: l’API di Anthropic.')
                : t('Vuoto: OpenAI. Ollama: {url}', { url: 'http://localhost:11434/v1' })
            }
          >
            <Input
              value={ai.baseUrl}
              placeholder={claude ? 'https://api.anthropic.com' : 'https://api.openai.com/v1'}
              onChange={(e) => set({ baseUrl: e.target.value })}
            />
          </Field>
        </div>
        <Field
          label={t('Modello per le azioni rapide')}
          hint={
            claude
              ? t(
                  'Per riscrivere e correggere i testi, la SEO e il testo alternativo, che sono brevi: vuoto, Claude Haiku 5.5, molto più economico. L’assistente e le traduzioni delle pagine usano il modello principale.',
                )
              : t('Per riscrivere e correggere i testi, la SEO e il testo alternativo. Vuoto: lo stesso modello.')
          }
        >
          <Input
            value={ai.fastModel ?? ''}
            placeholder={claude ? 'claude-haiku-5-5' : ai.model || t('lo stesso modello')}
            onChange={(e) => set({ fastModel: e.target.value })}
          />
        </Field>
        <div className="flex gap-2">
          <Button type="submit" variant="primary" loading={saving}>
            {t('Salva')}
          </Button>
          <Button onClick={test} loading={testing}>
            {t('Salva e prova')}
          </Button>
        </div>
        {saved.data?.usage && <Usage usage={saved.data.usage} />}
      </form>
    </Section>
  )
}

/** This month's tokens, as the provider counts them: the bill itself is on the provider's site. */
function Usage({ usage }: { usage: AiUsage }) {
  const n = (x: number) => x.toLocaleString(intlLocale())
  const read = usage.input + usage.cacheRead + usage.cacheWrite
  const cached = read ? Math.round((usage.cacheRead / read) * 100) : 0
  return (
    <div className="rounded-2xl bg-panel2 px-3 py-2.5 text-[13px] text-fg2">
      <div className="font-medium text-fg">{t('Uso di questo mese')}</div>
      {usage.requests ? (
        <p className="mt-0.5">
          {tn(usage.requests, '{count} richiesta', '{count} richieste', { count: n(usage.requests) })} ·{' '}
          {t('{count} token letti', { count: n(read) })}
          {usage.cacheRead > 0 && ` ${t('({percent}% dalla cache, a una frazione del prezzo)', { percent: cached })}`} ·{' '}
          {t('{count} token scritti.', { count: n(usage.output) })} {t('Il costo esatto è sul sito del fornitore.')}
        </p>
      ) : (
        <p className="mt-0.5">{t('Nessuna richiesta all’AI questo mese.')}</p>
      )}
    </div>
  )
}

function CopyButton({ text, label }: { text: string; label?: string }) {
  const [done, setDone] = useState(false)
  return (
    <IconButton
      label={label ?? t('Copia')}
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
      const res = await api.createToken(name.trim() || t('Client AI'))
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
    if (!confirm(t('Revocare “{name}”? I client che lo usano non potranno più collegarsi.', { name: label }))) return
    try {
      await api.revokeToken(id)
      void queryClient.invalidateQueries({ queryKey: ['tokens'] })
      toast(t('Token revocato'))
    } catch (error) {
      toast((error as Error).message, 'error')
    }
  }

  return (
    <Section title={t('Token di accesso')}>
      <p className="text-[14px] leading-relaxed text-fg2">
        {t(
          'Un client AI collegato con un tuo token agisce come te: può fare quello che puoi fare tu nel pannello, nulla di più. Creane uno per ogni client, così puoi revocarlo da solo.',
        )}
      </p>
      <form onSubmit={create} className="flex gap-2">
        <Input
          value={name}
          maxLength={80}
          placeholder={t('Nome, per esempio Claude Desktop sul portatile')}
          onChange={(e) => setName(e.target.value)}
        />
        <Button type="submit" variant="primary" loading={creating}>
          {t('Crea token')}
        </Button>
      </form>
      {fresh && (
        <div className="space-y-2 rounded-2xl bg-accent/8 p-3">
          <p className="text-[13px] font-medium">{t('Copialo ora: non lo vedrai più.')}</p>
          <div className="flex items-center gap-1">
            <code className="min-w-0 flex-1 truncate rounded-md bg-input px-2 py-1.5 font-mono text-[13px]">
              {fresh}
            </code>
            <CopyButton text={fresh} label={t('Copia il token')} />
          </div>
        </div>
      )}
      {list.data && list.data.tokens.length > 0 && (
        <ul className="divide-y divide-line overflow-hidden rounded-2xl bg-panel2">
          {list.data.tokens.map((tok) => (
            <li key={tok.id} className="flex items-center gap-3 px-3 py-2">
              <div className="min-w-0 flex-1">
                <div className="truncate text-[14px] font-medium">{tok.name}</div>
                <div className="text-[12px] text-fg3">
                  <span className="font-mono">…{tok.hint}</span> ·{' '}
                  {t('creato {when}', { when: relativeTime(tok.createdAt) })} ·{' '}
                  {tok.lastUsedAt ? t('usato {when}', { when: relativeTime(tok.lastUsedAt) }) : t('mai usato')}
                </div>
              </div>
              <IconButton
                label={t('Revoca {name}', { name: tok.name })}
                onClick={() => revoke(tok.id, tok.name)}
                className="hover:text-danger"
              >
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
        <span className="text-[13px] font-medium">{title}</span>
        <CopyButton text={code} />
      </div>
      <pre className="overflow-x-auto rounded-lg bg-panel2 p-3 font-mono text-[12px] leading-relaxed whitespace-pre text-fg2">
        {code}
      </pre>
      {hint && <p className="text-[13px] leading-relaxed text-fg3">{hint}</p>}
    </div>
  )
}

function Connect({ token }: { token: string | null }) {
  const url = `${location.origin}/mcp`
  const tok = token ?? t('IL_TUO_TOKEN')
  const desktop = JSON.stringify(
    {
      mcpServers: {
        materialize: {
          command: 'npx',
          args: ['-y', '@materializecms/cli', 'mcp', '--url', location.origin],
          env: { MATERIALIZE_TOKEN: tok },
        },
      },
    },
    null,
    2,
  )
  return (
    <Section title={t('Collegare un client AI (MCP)')}>
      <p className="text-[14px] leading-relaxed text-fg2">
        {t(
          'Con il protocollo MCP, Claude e altri assistenti leggono e modificano il sito: contenuti, pagine, tema e immagini. Le modifiche restano bozze finché non chiedi di pubblicarle.',
        )}
        {!token && ` ${t('Crea un token qui sopra: comparirà già negli esempi.')}`}
      </p>
      <Snippet
        title={t('Indirizzo del server')}
        code={url}
        hint={t('Per i client che si collegano via HTTP: intestazione Authorization: Bearer <token>.')}
      />
      <Snippet
        title="Claude Code"
        code={`claude mcp add --transport http materialize ${url} --header "Authorization: Bearer ${tok}"`}
      />
      <Snippet
        title={t('Claude Desktop e client locali (stdio)')}
        code={desktop}
        hint={t('Nel file di configurazione del client. Il CMS deve essere avviato.')}
      />
    </Section>
  )
}
