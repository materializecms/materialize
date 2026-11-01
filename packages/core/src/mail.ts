/**
 * Email providers the panel knows: choosing one fills in server, port and security, says where to
 * find the credentials, and tells the sender-domain check what to look for. The values are the
 * providers' published SMTP settings; "altro" leaves everything to the person.
 */

export type MailSecurity = 'tls' | 'starttls' | 'none'

export interface MailProvider {
  id: string
  name: string
  host: string
  port: number
  security: MailSecurity
  /** A fixed user name, when the provider has one (SendGrid: "apikey"). */
  user?: string
  /** Where to find the user name and the password, in the provider's own words. */
  userHint: string
  passHint: string
  /** Something worth knowing before starting (limits, a setting to turn on). */
  note?: string
  /** The host an SPF record includes to allow this provider, when there is a usual one. */
  spf?: string[]
  /** The usual DKIM selectors; empty when each account gets its own (not checkable from outside). */
  dkim: string[]
}

export const MAIL_PROVIDERS: MailProvider[] = [
  {
    id: 'brevo',
    name: 'Brevo',
    host: 'smtp-relay.brevo.com',
    port: 587,
    security: 'starttls',
    userHint: 'Brevo → SMTP e API → scheda SMTP: il «Login» (un indirizzo che finisce con @smtp-brevo.com).',
    passHint: 'Nella stessa scheda: «Genera una nuova chiave SMTP».',
    note: 'Il mittente deve essere un indirizzo o un dominio verificato in Brevo → Mittenti e domini.',
    spf: ['spf.brevo.com', 'spf.sendinblue.com'],
    dkim: ['brevo1', 'brevo2', 'mail'],
  },
  {
    id: 'postmark',
    name: 'Postmark',
    host: 'smtp.postmarkapp.com',
    port: 587,
    security: 'starttls',
    userHint: 'Il «Server API token» del server Postmark (scheda API Tokens).',
    passHint: 'Lo stesso token: in Postmark utente e password coincidono.',
    note: 'Il dominio del mittente va verificato in Postmark → Sender Signatures.',
    dkim: [],
  },
  {
    id: 'resend',
    name: 'Resend',
    host: 'smtp.resend.com',
    port: 465,
    security: 'tls',
    user: 'resend',
    userHint: 'Sempre «resend».',
    passHint: 'Una chiave API creata in Resend → API Keys.',
    note: 'Il dominio del mittente va verificato in Resend → Domains.',
    dkim: ['resend'],
  },
  {
    id: 'mailgun',
    name: 'Mailgun (Europa)',
    host: 'smtp.eu.mailgun.org',
    port: 587,
    security: 'starttls',
    userHint: 'Mailgun → Domain settings → SMTP credentials: il login, per esempio postmaster@mg.example.com.',
    passHint: 'La password di quel login (si reimposta dalla stessa pagina).',
    note: 'Per un account negli Stati Uniti il server è smtp.mailgun.org.',
    spf: ['mailgun.org'],
    dkim: ['smtp', 'mx', 'k1', 'krs', 'pic'],
  },
  {
    id: 'ses',
    name: 'Amazon SES',
    host: 'email-smtp.eu-west-1.amazonaws.com',
    port: 587,
    security: 'starttls',
    userHint: 'Credenziali SMTP create in Amazon SES → SMTP settings (non sono le chiavi IAM normali).',
    passHint: 'La password SMTP mostrata quando crei quelle credenziali.',
    note: 'Cambia la regione nel server (eu-west-1, eu-central-1…) con quella del tuo account SES.',
    dkim: [],
  },
  {
    id: 'sendgrid',
    name: 'SendGrid',
    host: 'smtp.sendgrid.net',
    port: 587,
    security: 'starttls',
    user: 'apikey',
    userHint: 'Sempre «apikey».',
    passHint: 'Una chiave API creata in SendGrid → Settings → API Keys.',
    spf: ['sendgrid.net'],
    dkim: ['s1', 's2'],
  },
  {
    id: 'mailjet',
    name: 'Mailjet',
    host: 'in-v3.mailjet.com',
    port: 587,
    security: 'starttls',
    userHint: 'La «API Key» (Account settings → API key management).',
    passHint: 'La «Secret Key» della stessa chiave.',
    spf: ['spf.mailjet.com'],
    dkim: ['mailjet'],
  },
  {
    id: 'smtp2go',
    name: 'SMTP2GO',
    host: 'mail.smtp2go.com',
    port: 587,
    security: 'starttls',
    userHint: 'Un «SMTP user» creato in SMTP2GO → Sending → SMTP Users.',
    passHint: 'La password di quell’utente.',
    note: 'Se la porta 587 è bloccata, SMTP2GO accetta anche la 2525.',
    spf: ['spf.smtp2go.com'],
    dkim: [],
  },
  {
    id: 'aruba',
    name: 'Aruba (casella email)',
    host: 'smtps.aruba.it',
    port: 465,
    security: 'tls',
    userHint: 'L’indirizzo email completo della casella.',
    passHint: 'La password della casella.',
    note: 'Una casella normale ha limiti di invio giornalieri: per molti messaggi meglio un servizio dedicato.',
    dkim: [],
  },
  {
    id: 'register',
    name: 'Register.it (casella email)',
    host: 'authsmtp.securemail.pro',
    port: 465,
    security: 'tls',
    userHint: 'L’indirizzo email completo della casella.',
    passHint: 'La password della casella.',
    dkim: [],
  },
  {
    id: 'google',
    name: 'Gmail / Google Workspace',
    host: 'smtp.gmail.com',
    port: 587,
    security: 'starttls',
    userHint: 'L’indirizzo Gmail o Workspace completo.',
    passHint:
      'Una «password per le app» (Account Google → Sicurezza), che richiede la verifica in due passaggi: non la password normale.',
    note: 'Gmail invia solo con il tuo indirizzo, con limiti giornalieri: va bene per pochi messaggi.',
    spf: ['_spf.google.com'],
    dkim: ['google'],
  },
  {
    id: 'microsoft',
    name: 'Microsoft 365 / Outlook',
    host: 'smtp.office365.com',
    port: 587,
    security: 'starttls',
    userHint: 'L’indirizzo email completo.',
    passHint: 'La password della casella.',
    note: 'Microsoft sta disattivando l’accesso SMTP con la sola password: se l’invio fallisce, l’amministratore di Microsoft 365 deve abilitare «SMTP autenticato» per la casella, oppure usa un servizio dedicato.',
    spf: ['spf.protection.outlook.com'],
    dkim: ['selector1', 'selector2'],
  },
]

/** The usual selectors, tried when the provider is unknown. */
export const COMMON_DKIM = ['default', 'mail', 'dkim', 'google', 'selector1', 'selector2', 'k1', 's1', 's2']

export function providerById(id: string | undefined): MailProvider | undefined {
  return MAIL_PROVIDERS.find((p) => p.id === id)
}

/** The provider whose server this is, for settings saved before the list existed. */
export function providerByHost(host: string): MailProvider | undefined {
  const h = host.trim().toLowerCase()
  if (/^email-smtp\.[a-z0-9-]+\.amazonaws\.com$/.test(h)) return providerById('ses')
  if (h === 'smtp.mailgun.org') return providerById('mailgun')
  return MAIL_PROVIDERS.find((p) => p.host === h)
}

/** The domain of a sender like "Studio Rossi <sito@example.com>", or null. */
export function senderDomain(from: string): string | null {
  const address = /<([^>]+)>/.exec(from)?.[1] ?? from
  const domain = /@([a-z0-9.-]+\.[a-z]{2,})\s*$/i.exec(address.trim())?.[1]
  return domain ? domain.toLowerCase() : null
}
