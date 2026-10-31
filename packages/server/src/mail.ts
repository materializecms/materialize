import nodemailer from 'nodemailer'

/** Outgoing email settings, saved in the panel. The password never goes back to the browser. */
export interface MailSettings {
  host: string
  port: number
  /** tls: encrypted from the start (465) · starttls: upgraded after connecting (587) · none: plain (tests). */
  security: 'tls' | 'starttls' | 'none'
  user: string
  pass: string
  /** Sender shown to recipients, e.g. "Studio Rossi <sito@example.com>". */
  from: string
  /** Where messages from the site's forms arrive. */
  to: string
}

export const EMPTY_MAIL: MailSettings = {
  host: '',
  port: 587,
  security: 'starttls',
  user: '',
  pass: '',
  from: '',
  to: '',
}

export function isConfigured(m: MailSettings | null): m is MailSettings {
  return !!m?.host && !!m.from
}

/** What the panel may see: everything but the password, and whether one is saved. */
export function publicMail(m: MailSettings | null) {
  const { pass, ...rest } = { ...EMPTY_MAIL, ...m }
  return { ...rest, hasPassword: !!pass }
}

export async function sendMail(
  m: MailSettings,
  message: { to: string; subject: string; text: string; replyTo?: string },
): Promise<void> {
  const transport = nodemailer.createTransport({
    host: m.host,
    port: m.port,
    secure: m.security === 'tls',
    requireTLS: m.security === 'starttls',
    ignoreTLS: m.security === 'none',
    auth: m.user ? { user: m.user, pass: m.pass } : undefined,
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
  })
  await transport.sendMail({ from: m.from, ...message })
}

/** A message from a site form as plain text: one "Label: value" per field. */
export function submissionText(page: string, data: Record<string, string>): string {
  const lines = Object.entries(data).map(([k, v]) => `${k}:\n${v}\n`)
  return `Nuovo messaggio dal modulo del sito${page ? ` (pagina ${page})` : ''}.\n\n${lines.join('\n')}`
}
