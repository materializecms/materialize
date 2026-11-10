import { createHash, createHmac } from 'node:crypto'
import { mkdir, rm, writeFile } from 'node:fs/promises'
import { extname, join } from 'node:path'
import { FILE_TYPES, FORM_FILE_MAX, type FormDefinition } from '@materializecms/core/page'
import type { SubmissionFile } from '@materializecms/db'
import { t } from './t.ts'

/** Settings for every form, kept in the "forms" setting. */
export interface FormsSettings {
  /** Messages older than this many months are deleted with their files; unset keeps them. */
  keepMonths?: number
  /** Signs webhook calls, so the receiver can tell they come from this site. */
  webhookSecret?: string
}

export interface FieldIssue {
  field: string
  message: string
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** A sent file, before it is saved. */
export interface IncomingFile {
  field: string
  name: string
  type: string
  bytes: Uint8Array
}

const isFile = (v: unknown): v is File =>
  typeof v === 'object' && v !== null && 'arrayBuffer' in v && typeof (v as File).name === 'string'

/**
 * What a form sent, checked against the form on the page: only its fields, the required ones
 * filled in, emails that look like emails, choices from the list, files of the right kind and
 * size. Without a definition (a form the site built by hand) the values are taken as they come.
 */
export async function readSubmission(
  raw: Record<string, unknown>,
  def: FormDefinition | null,
): Promise<{ data: Record<string, string>; files: IncomingFile[]; issues: FieldIssue[] }> {
  const data: Record<string, string> = {}
  const files: IncomingFile[] = []
  const issues: FieldIssue[] = []
  if (!def) {
    for (const [k, v] of Object.entries(raw)) {
      if (k.startsWith('_') || typeof v !== 'string' || Object.keys(data).length >= 30) continue
      data[k.slice(0, 80)] = v.slice(0, 5000)
    }
    return { data, files, issues }
  }
  for (const field of def.fields) {
    const value = raw[field.name]
    if (field.kind === 'file') {
      const file = isFile(value) && value.size > 0 ? value : null
      if (!file) {
        if (field.required) issues.push({ field: field.name, message: 'Allega un file' })
        continue
      }
      const allowed = FILE_TYPES[field.accept ?? 'any']
      if (!allowed.includes(extname(file.name).toLowerCase())) {
        issues.push({ field: field.name, message: `Questo tipo di file non è accettato (${allowed.join(', ')})` })
        continue
      }
      if (file.size > FORM_FILE_MAX) {
        issues.push({ field: field.name, message: `Il file supera ${FORM_FILE_MAX / 1024 / 1024} MB` })
        continue
      }
      files.push({
        field: field.name,
        name: file.name,
        type: file.type,
        bytes: new Uint8Array(await file.arrayBuffer()),
      })
      data[field.name] = file.name
      continue
    }
    const text = typeof value === 'string' ? value.trim().slice(0, 5000) : ''
    if (field.kind === 'checkbox') {
      if (text) data[field.name] = 'sì'
      else if (field.required) issues.push({ field: field.name, message: 'Va spuntata per inviare' })
      continue
    }
    if (!text) {
      if (field.required) issues.push({ field: field.name, message: 'Campo obbligatorio' })
      continue
    }
    if (field.kind === 'email' && !EMAIL.test(text)) {
      issues.push({ field: field.name, message: 'Scrivi un indirizzo email valido' })
      continue
    }
    if (field.kind === 'select' && field.options?.length && !field.options.includes(text)) {
      issues.push({ field: field.name, message: 'Scegli una delle voci dell’elenco' })
      continue
    }
    data[field.name] = text
  }
  return { data, files, issues }
}

/** A form filled in faster than this is a bot (people need a few seconds at least). */
const MIN_FILL_MS = 2500

/**
 * Why a message looks like spam, without a CAPTCHA: filled in at once, too many links, links
 * hidden in markup. Null for a message that looks real. Repeats are checked by the caller. The
 * reason is saved with the message and read in the language of whoever opens it (t.keep).
 */
export function spamReason(data: Record<string, string>, elapsedMs: number | null): string | null {
  if (elapsedMs !== null && elapsedMs >= 0 && elapsedMs < MIN_FILL_MS) return t.keep('Compilato in meno di 3 secondi')
  const text = Object.values(data).join('\n')
  if (/\[url=|<a\s+href|\[link=/i.test(text)) return t.keep('Link nascosti nel testo')
  const links = text.match(/https?:\/\/|www\./gi)?.length ?? 0
  if (links > 3) return t.keep('Troppi link ({n})', { n: links })
  return null
}

/** The same words from the same form: two identical messages in a day are a repeat. */
export const fingerprintOf = (form: string, data: Record<string, string>) =>
  createHash('sha256')
    .update(form)
    .update(
      JSON.stringify(
        Object.entries(data)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([k, v]) => [k, v.toLowerCase().replace(/\s+/g, ' ')]),
      ),
    )
    .digest('hex')

/** A file name safe on any disk, keeping its extension. */
const safeName = (name: string) =>
  name
    .normalize('NFKD')
    .replace(/[^\w.-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(-80) || 'file'

/** Saves a message's files in its own folder, out of reach of the public site. */
export async function saveFiles(dir: string, id: string, files: IncomingFile[]): Promise<SubmissionFile[]> {
  if (!files.length) return []
  const folder = join(dir, id)
  await mkdir(folder, { recursive: true })
  const saved: SubmissionFile[] = []
  for (const [i, f] of files.entries()) {
    const path = `${id}/${i + 1}-${safeName(f.name)}`
    await writeFile(join(dir, path), f.bytes)
    saved.push({ field: f.field, name: f.name, size: f.bytes.length, type: f.type, path })
  }
  return saved
}

export const removeFiles = (dir: string, id: string) =>
  rm(join(dir, id), { recursive: true, force: true }).catch(() => {})

/** The signature of a webhook body: `sha256=` and the HMAC of the body with the site's secret. */
export const webhookSignature = (secret: string, body: string) =>
  `sha256=${createHmac('sha256', secret).update(body).digest('hex')}`

/**
 * Posts a message to a webhook (Zapier, Make, n8n…), signed; tries three times, waiting a little
 * longer each time. Resolves with whether it was taken.
 */
export async function sendWebhook(
  url: string,
  payload: unknown,
  secret: string,
  wait: (ms: number) => Promise<void> = (ms) => new Promise((r) => setTimeout(r, ms)),
): Promise<boolean> {
  const body = JSON.stringify(payload)
  for (const delay of [0, 20_000, 120_000]) {
    if (delay) await wait(delay)
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'user-agent': 'Materialize-Webhook',
          'x-materialize-signature': webhookSignature(secret, body),
        },
        body,
        redirect: 'error',
        signal: AbortSignal.timeout(10_000),
      })
      if (res.ok) return true
      // The receiver refused it on purpose: trying again would not help.
      if (res.status >= 400 && res.status < 500 && res.status !== 429) return false
    } catch {}
  }
  return false
}
