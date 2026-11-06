import { createHmac, timingSafeEqual } from 'node:crypto'
import { richTextHtml } from '@materializecms/core/page'

/**
 * The newsletter as an email: an HTML version that reads well in every email app (one column,
 * inline styles, absolute addresses) and a plain text one. With statistics on, a tiny picture
 * tells when it is opened and links pass through the site, signed so they cannot be bent to
 * send people elsewhere.
 */

type Lang = 'it' | 'en'

const WORDS: Record<Lang, Record<string, string>> = {
  it: {
    unsubscribe: 'Non vuoi più ricevere queste email? Disiscriviti',
    why: 'Ricevi questa email perché ti sei iscritto alla newsletter di {site}.',
    confirmSubject: 'Conferma l’iscrizione alla newsletter di {site}',
    confirmIntro: 'Ciao! Per ricevere la newsletter di {site} conferma il tuo indirizzo:',
    confirmButton: 'Confermo l’iscrizione',
    confirmIgnore: 'Se non ti sei iscritto tu, ignora questa email: senza conferma non riceverai niente.',
    view: 'Apri nel browser',
  },
  en: {
    unsubscribe: 'Don’t want these emails any more? Unsubscribe',
    why: 'You get this email because you signed up for the {site} newsletter.',
    confirmSubject: 'Confirm your subscription to the {site} newsletter',
    confirmIntro: 'Hi! To get the {site} newsletter, confirm your address:',
    confirmButton: 'Confirm my subscription',
    confirmIgnore: 'If you did not sign up, ignore this email: without confirming you will get nothing.',
    view: 'Open in your browser',
  },
}

export const langOf = (locale: string | null | undefined): Lang =>
  locale?.toLowerCase().startsWith('it') ? 'it' : 'en'
const say = (lang: Lang, key: string, site: string) => (WORDS[lang][key] ?? key).replace('{site}', site)

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/** An address on the site made absolute; others stay as they are. */
const absolute = (href: string, base: string) => {
  try {
    return new URL(href, `${base.replace(/\/$/, '')}/`).toString()
  } catch {
    return href
  }
}

/** Inline styles: email apps drop style sheets. */
const STYLE: Record<string, string> = {
  p: 'margin:0 0 16px;font-size:16px;line-height:1.6;',
  h2: 'margin:28px 0 12px;font-size:22px;line-height:1.3;font-weight:700;',
  h3: 'margin:24px 0 10px;font-size:18px;line-height:1.35;font-weight:700;',
  h4: 'margin:20px 0 8px;font-size:16px;line-height:1.4;font-weight:700;',
  ul: 'margin:0 0 16px;padding-left:22px;font-size:16px;line-height:1.6;',
  li: 'margin:0 0 6px;',
  blockquote: 'margin:0 0 16px;padding:4px 0 4px 16px;border-left:3px solid #d4d4d8;color:#52525b;font-style:italic;',
  figure: 'margin:0 0 16px;',
  img: 'display:block;max-width:100%;height:auto;border:0;border-radius:8px;',
}

export interface NewsletterContent {
  site: string
  /** The site's public address, for links and pictures. */
  siteUrl: string
  subject: string
  preheader: string
  body: unknown[]
  /** The site's accent color, for links and buttons. */
  accent: string
  /** The sender's details, shown at the bottom (often required by law: a postal address). */
  footer: string
  unsubscribeUrl: string
  /** Statistics: the picture that tells the email was opened, and each link through the site. */
  openUrl?: string
  link?: (href: string) => string
  locale?: string | null
}

export function newsletterHtml(c: NewsletterContent): string {
  const lang = langOf(c.locale)
  let body = richTextHtml(c.body)
  body = body.replace(/(src|href)="([^"]*)"/g, (_, attr: string, value: string) => {
    const raw = value.replace(/&amp;/g, '&')
    const abs = absolute(raw, c.siteUrl)
    const out = attr === 'href' && c.link && /^https?:/i.test(abs) ? c.link(abs) : abs
    return `${attr}="${esc(out)}"`
  })
  body = body.replace(/<(p|h2|h3|h4|ul|li|blockquote|figure|img)(\s|>)/g, (_, tag: string, after: string) => {
    return `<${tag} style="${STYLE[tag]}"${after}`
  })
  body = body.replace(/<a /g, `<a style="color:${esc(c.accent)};text-decoration:underline;" `)
  body = body.replace(/ loading="lazy" decoding="async"/g, '')
  const footer = c.footer.trim() ? `<p style="margin:0 0 8px;">${esc(c.footer.trim()).replace(/\n/g, '<br>')}</p>` : ''
  return `<!doctype html>
<html lang="${lang}">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(c.subject)}</title></head>
<body style="margin:0;padding:0;background:#f4f4f5;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(c.preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;">
<tr><td align="center" style="padding:32px 16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:12px;">
<tr><td style="padding:28px 32px 8px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:14px;font-weight:700;color:#18181b;">${esc(c.site)}</td></tr>
<tr><td style="padding:8px 32px 24px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#18181b;">
<h1 style="margin:0 0 20px;font-size:26px;line-height:1.25;font-weight:700;">${esc(c.subject)}</h1>
${body}
</td></tr>
</table>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;">
<tr><td style="padding:20px 32px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:12px;line-height:1.6;color:#71717a;text-align:center;">
${footer}<p style="margin:0 0 8px;">${esc(say(lang, 'why', c.site))}</p>
<p style="margin:0;"><a href="${esc(c.unsubscribeUrl)}" style="color:#71717a;text-decoration:underline;">${esc(say(lang, 'unsubscribe', c.site))}</a></p>
</td></tr>
</table>
</td></tr>
</table>
${c.openUrl ? `<img src="${esc(c.openUrl)}" width="1" height="1" alt="" style="display:block;border:0;width:1px;height:1px;">` : ''}
</body>
</html>`
}

/** The same newsletter as plain text, for email apps that show no HTML. */
export function newsletterText(c: NewsletterContent): string {
  const lang = langOf(c.locale)
  const lines: string[] = [c.subject, '']
  const runs = (b: { children?: { text?: string; href?: string }[] }) =>
    (b.children ?? [])
      .map((r) => (r.href ? `${r.text ?? ''} (${absolute(r.href, c.siteUrl)})` : (r.text ?? '')))
      .join('')
  for (const b of c.body as {
    type?: string
    children?: { text?: string; href?: string }[]
    image?: { alt?: string }
  }[]) {
    if (b.type === 'image') continue
    const text = runs(b).trim()
    if (!text) continue
    if (b.type === 'listItem') lines.push(`- ${text}`)
    else if (b.type === 'heading') lines.push('', text.toUpperCase(), '')
    else lines.push(text, '')
  }
  lines.push('—', ...(c.footer.trim() ? [c.footer.trim()] : []), say(lang, 'why', c.site))
  lines.push(`${say(lang, 'unsubscribe', c.site)}: ${c.unsubscribeUrl}`)
  return lines.join('\n')
}

/** The email that asks a new subscriber to confirm. */
export function confirmEmail(input: { site: string; url: string; accent: string; locale?: string | null }) {
  const lang = langOf(input.locale)
  const subject = say(lang, 'confirmSubject', input.site)
  const text = [say(lang, 'confirmIntro', input.site), '', input.url, '', say(lang, 'confirmIgnore', input.site)].join(
    '\n',
  )
  const html = `<!doctype html><html lang="${lang}"><body style="margin:0;padding:32px 16px;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#18181b;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:12px;"><tr><td style="padding:28px 32px;">
<p style="margin:0 0 20px;font-size:16px;line-height:1.6;">${esc(say(lang, 'confirmIntro', input.site))}</p>
<p style="margin:0 0 24px;"><a href="${esc(input.url)}" style="display:inline-block;padding:12px 20px;border-radius:8px;background:${esc(input.accent)};color:#ffffff;font-weight:600;text-decoration:none;">${esc(say(lang, 'confirmButton', input.site))}</a></p>
<p style="margin:0;font-size:13px;line-height:1.6;color:#71717a;">${esc(say(lang, 'confirmIgnore', input.site))}</p>
</td></tr></table></body></html>`
  return { subject, text, html }
}

/** The signature of a tracked link: without it, the address would redirect anywhere. */
export function linkSignature(sendId: string, url: string, secret: string): string {
  return createHmac('sha256', secret).update(`${sendId}\n${url}`).digest('base64url').slice(0, 22)
}

export function validLink(sendId: string, url: string, signature: string, secret: string): boolean {
  const expected = Buffer.from(linkSignature(sendId, url, secret))
  const given = Buffer.from(signature)
  return expected.length === given.length && timingSafeEqual(expected, given)
}

/** A 1×1 transparent GIF: the "opened" picture. */
export const PIXEL = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64')

/** Addresses out of a CSV export (Mailchimp, Brevo, a spreadsheet): the email column, and a name if there is one. */
export function parseSubscribersCsv(text: string): { email: string; name?: string }[] {
  const lines = text
    .replace(/^﻿/, '')
    .split(/\r?\n/)
    .filter((l) => l.trim())
  if (!lines.length) return []
  const sep =
    [';', ',', '\t'].sort((a, b) => (lines[0]?.split(b).length ?? 0) - (lines[0]?.split(a).length ?? 0))[0] ?? ','
  const cells = (l: string) => {
    const out: string[] = []
    let cur = ''
    let quoted = false
    for (let i = 0; i < l.length; i++) {
      const ch = l[i]
      if (ch === '"') {
        if (quoted && l[i + 1] === '"') {
          cur += '"'
          i++
        } else quoted = !quoted
      } else if (ch === sep && !quoted) {
        out.push(cur)
        cur = ''
      } else cur += ch
    }
    out.push(cur)
    return out.map((c) => c.trim())
  }
  const head = cells(lines[0] ?? '').map((h) => h.toLowerCase())
  const isEmail = (v: string) => /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/.test(v)
  let emailCol = head.findIndex((h) => /e-?mail/.test(h))
  const nameCol = head.findIndex((h) => /^(name|nome|first name|nome e cognome|full name)$/.test(h))
  let rows = lines.slice(1)
  // No header: the column holding addresses, from the first line on.
  if (emailCol < 0) {
    emailCol = cells(lines[0] ?? '').findIndex(isEmail)
    rows = lines
  }
  if (emailCol < 0) return []
  const seen = new Set<string>()
  const out: { email: string; name?: string }[] = []
  for (const l of rows) {
    const c = cells(l)
    const email = (c[emailCol] ?? '').toLowerCase()
    if (!isEmail(email) || seen.has(email)) continue
    seen.add(email)
    out.push({ email, ...(nameCol >= 0 && c[nameCol] ? { name: c[nameCol] } : {}) })
  }
  return out
}
