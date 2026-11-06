import { Resolver } from 'node:dns/promises'
import { connect } from 'node:net'
import { COMMON_DKIM, providerByHost, providerById } from '@materializecms/core/mail'
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
  /** The provider chosen in the panel (core/mail.ts), or empty for "another one". */
  provider?: string
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
  message: {
    to: string
    subject: string
    text: string
    html?: string
    replyTo?: string
    headers?: Record<string, string>
  },
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

// ---------- why sending failed, in words ----------

/** Whether the server answers on a port at all: the way to tell a blocked port from a wrong setting. */
export function portOpen(host: string, port: number, timeout = 4000): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = connect({ host, port, timeout })
    const done = (ok: boolean) => {
      socket.destroy()
      resolve(ok)
    }
    socket.once('connect', () => done(true))
    socket.once('timeout', () => done(false))
    socket.once('error', () => done(false))
  })
}

export interface MailProblem {
  message: string
  /** What to do about it. */
  hint?: string
}

type NodemailerError = Error & {
  code?: string
  responseCode?: number
  response?: string
  command?: string
  /** An AggregateError (a name with both IPv4 and IPv6 addresses): empty message, the causes in here. */
  errors?: { code?: string; message?: string }[]
}

/**
 * A sending error from nodemailer, explained: wrong server name, a port the hosting blocks (then
 * the ports that do answer), security that does not match the port, credentials refused, a sender
 * the provider has not verified, a limit reached.
 */
export async function explainMailError(error: unknown, m: MailSettings): Promise<MailProblem> {
  const e = error as NodemailerError
  const text = [e.message, e.response, ...(e.errors ?? []).flatMap((x) => [x.code, x.message])].join(' ')
  const provider = providerById(m.provider) ?? providerByHost(m.host)
  if (e.code === 'EDNS' || /ENOTFOUND|EAI_AGAIN/.test(text))
    return {
      message: `Il server «${m.host}» non esiste`,
      hint: 'Controlla il nome del server: un errore di battitura basta.',
    }
  if (/wrong version number|ssl3_get_record|packet length too long|unknown protocol/i.test(text))
    return {
      message: 'La sicurezza non corrisponde alla porta',
      hint: 'Di solito: porta 587 con STARTTLS, porta 465 con TLS.',
    }
  if (/certificate|self.signed|CERT_/i.test(text))
    return {
      message: 'Il certificato del server di posta non è valido',
      hint: 'Controlla il nome del server: deve essere esattamente quello indicato dal fornitore.',
    }
  if (
    e.code === 'ETIMEDOUT' ||
    e.code === 'ECONNECTION' ||
    (e.code === 'ESOCKET' && e.command === 'CONN') ||
    /ECONNREFUSED|ETIMEDOUT|ECONNRESET|EHOSTUNREACH|ENETUNREACH|Greeting never received/i.test(text)
  ) {
    const others = [587, 465, 2525].filter((p) => p !== m.port)
    const open: number[] = []
    for (const p of others) if (await portOpen(m.host, p)) open.push(p)
    if (open.length)
      return {
        message: `Il server non risponde sulla porta ${m.port}, ma risponde sulla ${open.join(' e sulla ')}`,
        hint: `Prova la porta ${open[0]}${open[0] === 465 ? ' con TLS' : ' con STARTTLS'}: la ${m.port} potrebbe essere bloccata dal fornitore del server.`,
      }
    return {
      message: `Il server di posta non risponde (porta ${m.port})`,
      hint: 'Molti fornitori di VPS bloccano le porte della posta in uscita, soprattutto per gli account nuovi: chiedi al loro supporto di sbloccarle, oppure usa un servizio che accetta la porta 2525.',
    }
  }
  if (e.code === 'EAUTH' || e.responseCode === 535 || e.responseCode === 534)
    return {
      message: 'Utente o password rifiutati dal server di posta',
      hint: provider ? `${provider.name}: ${provider.userHint} ${provider.passHint}` : 'Controlla utente e password.',
    }
  if (e.code === 'EENVELOPE' || (e.responseCode && e.responseCode >= 550 && e.responseCode <= 554)) {
    const sender = e.command === 'MAIL FROM' || /sender|from address|not verified|not allowed to send/i.test(text)
    return sender
      ? {
          message: 'Il server di posta non accetta questo mittente',
          hint: `${provider?.note ?? 'Il mittente deve essere un indirizzo o un dominio verificato presso il fornitore.'}`,
        }
      : { message: 'Il destinatario è stato rifiutato', hint: 'Controlla l’indirizzo del destinatario dei moduli.' }
  }
  if (e.responseCode && e.responseCode >= 421 && e.responseCode <= 452)
    return {
      message: 'Il server di posta ha rimandato l’invio',
      hint: 'Spesso è un limite di messaggi raggiunto: riprova più tardi o controlla il piano del fornitore.',
    }
  return { message: e.message || text.trim() || 'Invio non riuscito' }
}

// ---------- the sender's domain: SPF, DKIM, DMARC ----------

export interface DomainCheck {
  id: 'spf' | 'dkim' | 'dmarc'
  state: 'ok' | 'warn' | 'bad' | 'info'
  title: string
  detail: string
}

const txt = async (resolver: Resolver, name: string): Promise<string[]> =>
  (await resolver.resolveTxt(name).catch(() => [] as string[][])).map((parts) => parts.join(''))

/**
 * What mail servers check before trusting a message from this domain. Without SPF and DKIM the
 * messages tend to end in spam; Gmail and Yahoo also ask for DMARC from whoever sends a lot.
 */
export async function checkSenderDomain(domain: string, providerId?: string): Promise<DomainCheck[]> {
  const resolver = new Resolver({ timeout: 3000, tries: 2 })
  const provider = providerById(providerId)
  const checks: DomainCheck[] = []

  const spf = (await txt(resolver, domain)).filter((r) => /^v=spf1\b/i.test(r))
  if (!spf.length)
    checks.push({
      id: 'spf',
      state: 'bad',
      title: 'Manca il record SPF',
      detail: `Senza SPF le email da ${domain} finiscono spesso nello spam. ${provider?.spf ? `Aggiungi nel DNS un record TXT su ${domain}: v=spf1 include:${provider.spf[0]} ~all` : 'Il fornitore della posta indica quale record TXT aggiungere nel DNS.'}`,
    })
  else if (spf.length > 1)
    checks.push({
      id: 'spf',
      state: 'bad',
      title: 'Ci sono due record SPF',
      detail: 'I server di posta li scartano entrambi: uniscili in un solo record TXT che inizia con v=spf1.',
    })
  else if (!/\b(include:|a\b|a:|mx\b|mx:|ip4:|ip6:|exists:|redirect=)/i.test(spf[0] as string))
    checks.push({
      id: 'spf',
      state: 'bad',
      title: 'Il record SPF non autorizza nessun server',
      detail: `${spf[0]}: così il dominio dichiara di non inviare email, e i messaggi vengono rifiutati. Aggiungi il server del tuo fornitore${provider?.spf ? ` (include:${provider.spf[0]})` : ''}.`,
    })
  else if (provider?.spf && !provider.spf.some((h) => (spf[0] as string).includes(`include:${h}`)))
    checks.push({
      id: 'spf',
      state: 'warn',
      title: `Il record SPF non autorizza ${provider.name}`,
      detail: `Aggiungi include:${provider.spf[0]} al record attuale, prima di ~all o -all: ${spf[0]}`,
    })
  else checks.push({ id: 'spf', state: 'ok', title: 'Record SPF presente', detail: spf[0] as string })

  const selectors = provider ? provider.dkim : COMMON_DKIM
  if (provider && !selectors.length)
    checks.push({
      id: 'dkim',
      state: 'info',
      title: 'Firma DKIM: da controllare nel pannello del fornitore',
      detail: `${provider.name} dà a ogni account nomi propri per la firma DKIM: nel suo pannello vedi se il dominio è verificato.`,
    })
  else {
    let found: string | null = null
    // An empty key (p=) is a revoked one: it means "no signature".
    for (const s of selectors)
      if ((await txt(resolver, `${s}._domainkey.${domain}`)).some((r) => /\bp=[A-Za-z0-9+/]/.test(r))) {
        found = s
        break
      }
    checks.push(
      found
        ? {
            id: 'dkim',
            state: 'ok',
            title: 'Firma DKIM presente',
            detail: `Trovata con il nome ${found}._domainkey.${domain}.`,
          }
        : {
            id: 'dkim',
            state: 'warn',
            title: 'Firma DKIM non trovata',
            detail: `Non l’ho trovata con i nomi più comuni${provider ? ` di ${provider.name}` : ''}. Nel pannello del fornitore attiva la firma del dominio: ti dà i record da aggiungere nel DNS.`,
          },
    )
  }

  const dmarc = (await txt(resolver, `_dmarc.${domain}`)).find((r) => /^v=DMARC1\b/i.test(r))
  if (!dmarc)
    checks.push({
      id: 'dmarc',
      state: 'warn',
      title: 'Manca il record DMARC',
      detail: `Gmail e Yahoo lo chiedono a chi invia molte email. Un inizio sicuro, che osserva senza bloccare niente: record TXT su _dmarc.${domain} con v=DMARC1; p=none`,
    })
  else {
    const policy = /\bp=(none|quarantine|reject)/i.exec(dmarc)?.[1]?.toLowerCase()
    checks.push({
      id: 'dmarc',
      state: 'ok',
      title: 'Record DMARC presente',
      detail: policy === 'none' ? `Osserva soltanto (p=none): ${dmarc}` : dmarc,
    })
  }
  return checks
}
