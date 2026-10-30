import Anthropic from '@anthropic-ai/sdk'
import { z } from 'zod'
import { type SiteTool, ToolError } from './tools.ts'

/**
 * The AI behind the panel's assistant and text actions: Claude through Anthropic's API, or any
 * server that speaks OpenAI's Chat Completions (OpenAI itself, Ollama, LM Studio, OpenRouter…).
 * Saved in Impostazioni → AI e MCP; the key never goes back to the browser.
 */
export interface AiSettings {
  provider: 'anthropic' | 'openai'
  apiKey: string
  /** Empty: the provider's own address. For OpenAI-compatible servers, e.g. http://localhost:11434/v1. */
  baseUrl: string
  /** Empty: the default (Claude Opus 5.5 for Anthropic). */
  model: string
}

export const EMPTY_AI: AiSettings = { provider: 'anthropic', apiKey: '', baseUrl: '', model: '' }
export const DEFAULT_CLAUDE = 'claude-opus-5-5'

/** Raised when the AI cannot answer: not set up, refused, or the provider failed. */
export class AiError extends Error {}

/** What the panel may know: everything but the key. */
export function publicAi(s: AiSettings | null) {
  const ai = { ...EMPTY_AI, ...s }
  const { apiKey, ...rest } = ai
  return { ...rest, hasKey: !!apiKey, envKey: !!process.env.ANTHROPIC_API_KEY, ready: isReady(ai) }
}

/** Claude needs a key (saved, or ANTHROPIC_API_KEY); a compatible server needs an address and a model. */
export function isReady(s: AiSettings | null): s is AiSettings {
  if (!s) return !!process.env.ANTHROPIC_API_KEY
  return s.provider === 'anthropic' ? !!(s.apiKey || process.env.ANTHROPIC_API_KEY) : !!(s.baseUrl && s.model)
}

/** Progress of an assistant turn, sent to the panel as it happens. */
export type AiEvent =
  | { type: 'status'; text: string }
  | { type: 'tool'; name: string; title: string }
  | { type: 'text'; text: string }

/** One conversation, kept by the server between turns in the provider's own format. */
export interface Conversation {
  provider: AiSettings['provider']
  messages: unknown[]
}

/** Text in, text out: a rewrite, a translation, an alt text (with an image). */
export async function complete(
  s: AiSettings,
  input: { system: string; prompt: string; image?: { data: string; mime: string } },
): Promise<string> {
  if (s.provider === 'openai') {
    const content = input.image
      ? [
          { type: 'image_url', image_url: { url: `data:${input.image.mime};base64,${input.image.data}` } },
          { type: 'text', text: input.prompt },
        ]
      : input.prompt
    const reply = await openaiChat(s, {
      messages: [
        { role: 'system', content: input.system },
        { role: 'user', content },
      ],
    })
    return (reply.content ?? '').trim()
  }
  const message = await claude(s, {
    max_tokens: 8000,
    output_config: { effort: 'low' },
    system: input.system,
    messages: [
      {
        role: 'user',
        content: input.image
          ? [
              {
                type: 'image',
                source: { type: 'base64', media_type: input.image.mime as 'image/jpeg', data: input.image.data },
              },
              { type: 'text', text: input.prompt },
            ]
          : input.prompt,
      },
    ],
  })
  return textOf(message).trim()
}

/**
 * One turn of the assistant: the person's message, then as many tool calls as the model needs
 * (at most `maxSteps`), then its answer. The conversation keeps everything for the next turn.
 */
export async function runTurn(
  s: AiSettings,
  conv: Conversation,
  input: { system: string; text: string; tools: SiteTool[]; onEvent: (e: AiEvent) => void; maxSteps?: number },
): Promise<string> {
  const byName = new Map(input.tools.map((t) => [t.name, t]))
  const runTool = async (name: string, raw: unknown): Promise<{ text: string; error: boolean }> => {
    const t = byName.get(name)
    if (!t) return { text: `There is no tool "${name}"`, error: true }
    const parsed = t.input.safeParse(raw)
    if (!parsed.success) return { text: `Invalid input: ${z.prettifyError(parsed.error)}`, error: true }
    input.onEvent({ type: 'tool', name, title: t.title })
    try {
      const out = await t.run(parsed.data as never)
      return { text: typeof out === 'string' ? out : JSON.stringify(out), error: false }
    } catch (error) {
      if (!(error instanceof ToolError)) console.error(error)
      return { text: error instanceof Error ? error.message : String(error), error: true }
    }
  }
  const maxSteps = input.maxSteps ?? 24

  if (s.provider === 'openai') {
    const tools = input.tools.map((t) => ({
      type: 'function',
      function: { name: t.name, description: t.description, parameters: schemaOf(t) },
    }))
    const messages = conv.messages as OpenAiMessage[]
    messages.push({ role: 'user', content: input.text })
    for (let step = 0; step < maxSteps; step++) {
      const reply = await openaiChat(s, { messages: [{ role: 'system', content: input.system }, ...messages], tools })
      messages.push(reply)
      if (!reply.tool_calls?.length) return (reply.content ?? '').trim()
      if (reply.content?.trim()) input.onEvent({ type: 'status', text: reply.content.trim() })
      for (const call of reply.tool_calls) {
        let args: unknown
        try {
          args = JSON.parse(call.function.arguments || '{}')
        } catch {
          args = undefined
        }
        const result =
          args === undefined
            ? { text: `INVALID_JSON: ${call.function.arguments}`, error: true }
            : await runTool(call.function.name, args)
        messages.push({ role: 'tool', tool_call_id: call.id, content: result.text })
      }
    }
    return 'Mi sono fermato: servivano troppi passaggi. Dimmi se continuare.'
  }

  const tools = input.tools.map((t) => ({
    name: t.name,
    description: t.description,
    input_schema: schemaOf(t) as Anthropic.Beta.BetaTool.InputSchema,
  }))
  const messages = conv.messages as Anthropic.Beta.BetaMessageParam[]
  messages.push({ role: 'user', content: input.text })
  for (let step = 0; step < maxSteps; step++) {
    const message = await claude(s, {
      max_tokens: 16000,
      output_config: { effort: 'medium' },
      // Progress notes between tool calls, so the panel can say what is happening.
      ...(updatesSupported(s) ? { thinking: { type: 'adaptive', display: 'updates' } } : {}),
      system: input.system,
      tools,
      messages,
    })
    // Kept as returned (thinking blocks included): the next request must carry them unchanged.
    messages.push({ role: 'assistant', content: message.content as Anthropic.Beta.BetaContentBlockParam[] })
    for (const block of message.content)
      if (block.type === 'thinking' && block.thinking.trim())
        input.onEvent({ type: 'status', text: block.thinking.trim() })
    if (message.stop_reason === 'refusal') throw new AiError('La richiesta è stata rifiutata dal modello.')
    if (message.stop_reason !== 'tool_use') return textOf(message).trim()
    const calls = message.content.filter((b) => b.type === 'tool_use')
    const results = await Promise.all(
      calls.map(async (call) => {
        const r = await runTool(call.name, call.input)
        return { type: 'tool_result' as const, tool_use_id: call.id, content: r.text, is_error: r.error }
      }),
    )
    // All results in one message, as the API expects for parallel calls.
    messages.push({ role: 'user', content: results })
  }
  return 'Mi sono fermato: servivano troppi passaggi. Dimmi se continuare.'
}

// ---------- Claude ----------

/** Models that take the server-side fallback on a refusal and progress notes between tool calls. */
const CURRENT = /^claude-(opus-5-5|opus-5|sonnet-5-5|fable-5-1)$/

const modelOf = (s: AiSettings) => s.model.trim() || DEFAULT_CLAUDE
const updatesSupported = (s: AiSettings) => /^claude-(opus-5-5|sonnet-5-5|fable-5-1|fable-5)$/.test(modelOf(s))

async function claude(
  s: AiSettings,
  params: Omit<Anthropic.Beta.MessageCreateParamsNonStreaming, 'model'>,
): Promise<Anthropic.Beta.BetaMessage> {
  const client = new Anthropic({ apiKey: s.apiKey || undefined, baseURL: s.baseUrl || undefined })
  const model = modelOf(s)
  const betas: Anthropic.Beta.AnthropicBeta[] = []
  // A declined request is retried on a suitable model by the API itself (Claude API only).
  const fallback = CURRENT.test(model) && !s.baseUrl
  if (fallback) betas.push('server-side-fallback-2026-07-01')
  if ('thinking' in params && (params.thinking as { display?: string } | undefined)?.display === 'updates')
    betas.push('thinking-display-updates-2026-08-18')
  try {
    return await client.beta.messages.create({
      ...params,
      model,
      ...(betas.length ? { betas } : {}),
      ...(fallback ? { fallbacks: 'default' as const } : {}),
    })
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError) throw new AiError('La chiave API di Anthropic non è valida.')
    if (error instanceof Anthropic.PermissionDeniedError)
      throw new AiError('La chiave non ha accesso a questo modello.')
    if (error instanceof Anthropic.NotFoundError) throw new AiError(`Il modello “${model}” non esiste.`)
    if (error instanceof Anthropic.RateLimitError) throw new AiError('Troppe richieste ad Anthropic: riprova tra poco.')
    if (error instanceof Anthropic.BadRequestError) throw new AiError(`Richiesta non valida: ${error.message}`)
    if (error instanceof Anthropic.APIError) throw new AiError(`Anthropic non risponde (${error.status ?? 'rete'}).`)
    throw error
  }
}

function textOf(message: Anthropic.Beta.BetaMessage): string {
  return message.content
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('\n')
}

/** A tool's input as JSON Schema, without the meta keys providers reject. */
function schemaOf(t: SiteTool): Record<string, unknown> {
  const { $schema: _, ...schema } = z.toJSONSchema(t.input, { io: 'input' }) as Record<string, unknown>
  return schema
}

// ---------- OpenAI-compatible ----------

type OpenAiMessage =
  | { role: 'system' | 'user'; content: unknown }
  | { role: 'tool'; tool_call_id: string; content: string }
  | OpenAiReply
interface OpenAiReply {
  role: 'assistant'
  content: string | null
  tool_calls?: { id: string; type: 'function'; function: { name: string; arguments: string } }[]
}

async function openaiChat(s: AiSettings, body: { messages: unknown[]; tools?: unknown[] }): Promise<OpenAiReply> {
  const base = (s.baseUrl || 'https://api.openai.com/v1').replace(/\/+$/, '')
  let res: Response
  try {
    res = await fetch(`${base}/chat/completions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...(s.apiKey ? { authorization: `Bearer ${s.apiKey}` } : {}) },
      body: JSON.stringify({ model: s.model, ...body }),
      signal: AbortSignal.timeout(300_000),
    })
  } catch {
    throw new AiError(`Il server AI non risponde su ${base}.`)
  }
  const json = (await res.json().catch(() => null)) as {
    choices?: { message?: OpenAiReply }[]
    error?: { message?: string }
  } | null
  if (!res.ok) throw new AiError(json?.error?.message ?? `Il server AI ha risposto ${res.status}.`)
  const message = json?.choices?.[0]?.message
  if (!message) throw new AiError('Il server AI ha dato una risposta vuota.')
  return { role: 'assistant', content: message.content ?? null, tool_calls: message.tool_calls }
}

// ---------- translation ----------

const languageName = (code: string) => {
  try {
    return `${new Intl.DisplayNames(['en'], { type: 'language' }).of(code) ?? code} (${code})`
  } catch {
    return code
  }
}

/**
 * Translates a page's texts in batches, keeping their order: each batch goes out as a JSON list
 * and must come back as a list of the same length. Marks like <b>, <i> and <a1> stay in place.
 */
export async function translateTexts(
  s: AiSettings,
  texts: string[],
  from: string,
  to: string,
  onProgress?: (done: number) => void,
): Promise<string[]> {
  const system = `You translate the texts of a website from ${languageName(from)} to ${languageName(to)}. You receive a JSON array of strings and reply with a JSON array of their translations: same length, same order, nothing else (no code fences, no notes). Keep the tags <b>, </b>, <i>, </i>, <a1>, </a1> and so on around the matching words, keep line breaks, numbers, brand names, e-mail addresses and URLs. Write naturally for native readers, as a professional copywriter would, with the same tone and roughly the same length.`
  const out: string[] = []
  const BATCH = 60
  for (let start = 0; start < texts.length; start += BATCH) {
    const batch = texts.slice(start, start + BATCH)
    let result: string[] | null = null
    for (let attempt = 0; attempt < 2 && !result; attempt++) {
      const reply = await complete(s, { system, prompt: JSON.stringify(batch) })
      result = parseList(reply, batch.length)
    }
    if (!result) throw new AiError('Il modello non ha restituito la traduzione completa: riprova.')
    out.push(...result)
    onProgress?.(out.length)
  }
  return out
}

function parseList(reply: string, length: number): string[] | null {
  const json = reply.slice(reply.indexOf('['), reply.lastIndexOf(']') + 1)
  try {
    const list = JSON.parse(json) as unknown
    if (Array.isArray(list) && list.length === length && list.every((x) => typeof x === 'string')) return list
  } catch {}
  return null
}
