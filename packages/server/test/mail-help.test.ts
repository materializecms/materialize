import { providerByHost, senderDomain } from '@materializecms/core/mail'
import { describe, expect, it, vi } from 'vitest'

// A DNS in memory: each name with its TXT records.
const records: Record<string, string[]> = {}
vi.mock('node:dns/promises', () => ({
  Resolver: class {
    async resolveTxt(name: string) {
      const found = records[name]
      if (!found) throw Object.assign(new Error('not found'), { code: 'ENOTFOUND' })
      return found.map((r) => [r])
    }
  },
}))

const { checkSenderDomain, explainMailError } = await import('../src/mail.ts')
const settings = {
  host: 'smtp-relay.brevo.com',
  port: 587,
  security: 'starttls' as const,
  user: 'u',
  pass: 'p',
  from: 'sito@example.com',
  to: '',
}
const state = (checks: { id: string; state: string }[], id: string) => checks.find((c) => c.id === id)?.state

describe('the sender', () => {
  it('reads the domain from the usual ways of writing a sender', () => {
    expect(senderDomain('Studio Rossi <sito@Example.COM>')).toBe('example.com')
    expect(senderDomain('sito@posta.example.com')).toBe('posta.example.com')
    expect(senderDomain('Studio Rossi')).toBeNull()
  })

  it('recognizes the provider from a server saved before the list', () => {
    expect(providerByHost('smtp-relay.brevo.com')?.id).toBe('brevo')
    expect(providerByHost('email-smtp.eu-central-1.amazonaws.com')?.id).toBe('ses')
    expect(providerByHost('smtp.example.com')).toBeUndefined()
  })
})

describe('the sender domain check', () => {
  it('says SPF, DKIM and DMARC are missing on an empty domain', async () => {
    for (const k of Object.keys(records)) delete records[k]
    const checks = await checkSenderDomain('example.com', 'brevo')
    expect(state(checks, 'spf')).toBe('bad')
    expect(checks.find((c) => c.id === 'spf')?.detail).toContain('include:spf.brevo.com')
    expect(state(checks, 'dkim')).toBe('warn')
    expect(state(checks, 'dmarc')).toBe('warn')
  })

  it('finds a domain set up for the provider', async () => {
    records['example.com'] = ['v=spf1 include:spf.brevo.com ~all', 'google-site-verification=abc']
    records['brevo1._domainkey.example.com'] = ['k=rsa; p=MIGfMA0']
    records['_dmarc.example.com'] = ['v=DMARC1; p=quarantine']
    const checks = await checkSenderDomain('example.com', 'brevo')
    expect(checks.map((c) => c.state)).toEqual(['ok', 'ok', 'ok'])
  })

  it('spots an SPF that leaves the provider out, and two SPF records', async () => {
    records['example.com'] = ['v=spf1 include:_spf.google.com ~all']
    expect(state(await checkSenderDomain('example.com', 'brevo'), 'spf')).toBe('warn')
    records['example.com'] = ['v=spf1 include:spf.brevo.com ~all', 'v=spf1 mx ~all']
    const checks = await checkSenderDomain('example.com', 'brevo')
    expect(checks.find((c) => c.id === 'spf')?.title).toBe('Ci sono due record SPF')
  })

  it('takes "v=spf1 -all" and an empty DKIM key for what they are: no sending, no signature', async () => {
    records['example.com'] = ['v=spf1 -all']
    records['default._domainkey.example.com'] = ['v=DKIM1; p=']
    const checks = await checkSenderDomain('example.com')
    expect(checks.find((c) => c.id === 'spf')?.title).toBe('Il record SPF non autorizza nessun server')
    expect(state(checks, 'spf')).toBe('bad')
    expect(state(checks, 'dkim')).toBe('warn')
    delete records['default._domainkey.example.com']
  })

  it('does not guess DKIM names for providers that give each account its own', async () => {
    expect(state(await checkSenderDomain('example.com', 'postmark'), 'dkim')).toBe('info')
  })
})

describe('why sending failed', () => {
  const failure = (fields: Record<string, unknown>) => Object.assign(new Error(String(fields.message ?? '')), fields)

  it('explains a refused password with where to find the right one', async () => {
    const p = await explainMailError(failure({ code: 'EAUTH', responseCode: 535, message: 'Invalid login' }), settings)
    expect(p.message).toBe('Utente o password rifiutati dal server di posta')
    expect(p.hint).toContain('chiave SMTP')
  })

  it('explains a sender the provider has not verified', async () => {
    const p = await explainMailError(
      failure({ responseCode: 550, command: 'MAIL FROM', message: 'Sender not verified' }),
      settings,
    )
    expect(p.message).toBe('Il server di posta non accetta questo mittente')
    expect(p.hint).toContain('Mittenti e domini')
  })

  it('explains a server name that does not exist, and security that does not match the port', async () => {
    expect(
      (await explainMailError(failure({ code: 'EDNS', message: 'getaddrinfo ENOTFOUND' }), settings)).message,
    ).toContain('non esiste')
    expect(
      (await explainMailError(failure({ code: 'ESOCKET', message: 'ssl3_get_record:wrong version number' }), settings))
        .message,
    ).toBe('La sicurezza non corrisponde alla porta')
  })

  it('reads the causes inside an AggregateError, which has no message of its own', async () => {
    const aggregate = Object.assign(new AggregateError([], ''), {
      code: 'ESOCKET',
      command: 'CONN',
      errors: [
        { code: 'ECONNREFUSED', message: 'connect ECONNREFUSED ::1:1' },
        { code: 'ECONNREFUSED', message: 'connect ECONNREFUSED 127.0.0.1:1' },
      ],
    })
    const p = await explainMailError(aggregate, { ...settings, host: '127.0.0.1', port: 1 })
    expect(p.message).toBe('Il server di posta non risponde (porta 1)')
  })

  it('tells a port nobody answers on, after trying the others', async () => {
    const p = await explainMailError(failure({ code: 'ECONNECTION', message: 'connect ECONNREFUSED' }), {
      ...settings,
      host: '127.0.0.1',
      port: 1,
    })
    expect(p.message).toBe('Il server di posta non risponde (porta 1)')
    expect(p.hint).toContain('bloccano le porte')
  })
})
