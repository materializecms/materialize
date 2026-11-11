import { randomBytes } from 'node:crypto'
import type { Passkey } from '@materializecms/db'
import {
  type AuthenticationResponseJSON,
  generateAuthenticationOptions,
  generateRegistrationOptions,
  type RegistrationResponseJSON,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from '@simplewebauthn/server'

/**
 * Passkeys (WebAuthn): a key pair made on a phone, a computer or a security key, bound to the
 * site's address. Phishing cannot take it: a passkey made for example.com never signs for a look-
 * alike site. The browser checks the address, then the device asks for Face ID, Touch ID or a PIN.
 */

/** Where passkeys work: the address the browser shows (origin) and its host name (the RP ID). */
export interface PasskeySite {
  origin: string
  rpID: string
  name: string
}

/** A challenge waits a few minutes for the browser's answer, and works once. */
const TTL = 5 * 60_000
/** At most this many waiting at once: past it, the oldest go (sign-in options need no account). */
const MAX_PENDING = 5000

export function createPasskeys() {
  const pending = new Map<string, { challenge: string; userId?: string; until: number }>()

  const keep = (challenge: string, userId?: string) => {
    const now = Date.now()
    for (const [k, v] of pending) if (v.until < now) pending.delete(k)
    // A Map keeps insertion order: the first keys are the oldest.
    for (const k of pending.keys()) {
      if (pending.size < MAX_PENDING) break
      pending.delete(k)
    }
    const id = randomBytes(18).toString('base64url')
    pending.set(id, { challenge, userId, until: now + TTL })
    return id
  }

  const take = (id: string, userId?: string) => {
    const found = pending.get(id)
    pending.delete(id)
    if (!found || found.until < Date.now() || found.userId !== userId) return null
    return found.challenge
  }

  return {
    /** Options for a new passkey on this account; its existing ones are excluded, so a device registers once. */
    async registration(
      site: PasskeySite,
      user: { id: string; email: string; name: string },
      existing: Pick<Passkey, 'credentialId' | 'transports'>[],
    ) {
      const options = await generateRegistrationOptions({
        rpName: site.name,
        rpID: site.rpID,
        userName: user.email,
        userDisplayName: user.name,
        userID: new TextEncoder().encode(user.id),
        attestationType: 'none',
        excludeCredentials: existing.map((p) => ({ id: p.credentialId, transports: p.transports ?? undefined })),
        // A passkey the device remembers: signing in then needs no email.
        authenticatorSelection: { residentKey: 'required', userVerification: 'required' },
      })
      return { options, ticket: keep(options.challenge, user.id) }
    },

    /** The browser's answer to `registration`: the public key to store, or null. */
    async register(site: PasskeySite, userId: string, ticket: string, response: RegistrationResponseJSON) {
      const challenge = take(ticket, userId)
      if (!challenge) return null
      const result = await verifyRegistrationResponse({
        response,
        expectedChallenge: challenge,
        expectedOrigin: site.origin,
        expectedRPID: site.rpID,
        requireUserVerification: true,
      }).catch(() => null)
      if (!result?.verified) return null
      const { credential } = result.registrationInfo
      return {
        credentialId: credential.id,
        publicKey: Buffer.from(credential.publicKey).toString('base64url'),
        counter: credential.counter,
        transports: credential.transports ?? null,
      }
    },

    /** Options to sign in: no account is named, the device offers the passkeys it has for this site. */
    async authentication(site: PasskeySite) {
      const options = await generateAuthenticationOptions({ rpID: site.rpID, userVerification: 'required' })
      return { options, ticket: keep(options.challenge) }
    },

    /** Checks a sign-in with a stored passkey; returns the new counter, or null. */
    async authenticate(site: PasskeySite, ticket: string, response: AuthenticationResponseJSON, passkey: Passkey) {
      const challenge = take(ticket)
      if (!challenge) return null
      const result = await verifyAuthenticationResponse({
        response,
        expectedChallenge: challenge,
        expectedOrigin: site.origin,
        expectedRPID: site.rpID,
        credential: {
          id: passkey.credentialId,
          publicKey: new Uint8Array(Buffer.from(passkey.publicKey, 'base64url')),
          counter: passkey.counter,
          transports: passkey.transports ?? undefined,
        },
        requireUserVerification: true,
      }).catch(() => null)
      return result?.verified ? result.authenticationInfo.newCounter : null
    },
  }
}

export type Passkeys = ReturnType<typeof createPasskeys>
