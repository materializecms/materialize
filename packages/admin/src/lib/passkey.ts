/**
 * Passkeys in the browser: the server sends options as JSON (binary values in base64url), the
 * browser's API wants ArrayBuffers, and its answer goes back as JSON. Written by hand, since
 * `PublicKeyCredential.parseCreationOptionsFromJSON` is missing in older browsers.
 */

type B64 = string

export interface PasskeyCreationJSON {
  challenge: B64
  rp: { id?: string; name: string }
  user: { id: B64; name: string; displayName: string }
  pubKeyCredParams: { type: 'public-key'; alg: number }[]
  timeout?: number
  excludeCredentials?: { id: B64; type: 'public-key'; transports?: string[] }[]
  authenticatorSelection?: AuthenticatorSelectionCriteria
  attestation?: AttestationConveyancePreference
  extensions?: AuthenticationExtensionsClientInputs
}

export interface PasskeyRequestJSON {
  challenge: B64
  rpId?: string
  timeout?: number
  allowCredentials?: { id: B64; type: 'public-key'; transports?: string[] }[]
  userVerification?: UserVerificationRequirement
}

const toBuffer = (value: B64): ArrayBuffer => {
  const base64 = value
    .replace(/-/g, '+')
    .replace(/_/g, '/')
    .padEnd(Math.ceil(value.length / 4) * 4, '=')
  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0))
  return bytes.buffer
}

const toB64 = (buffer: ArrayBuffer): B64 => {
  let text = ''
  for (const byte of new Uint8Array(buffer)) text += String.fromCharCode(byte)
  return btoa(text).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

const descriptors = (list?: { id: B64; type: 'public-key'; transports?: string[] }[]) =>
  list?.map((d) => ({ ...d, id: toBuffer(d.id), transports: d.transports as AuthenticatorTransport[] | undefined }))

/** Whether this browser can use passkeys at all. */
export const passkeysSupported = () => typeof window !== 'undefined' && 'PublicKeyCredential' in window

/** Whether the browser can offer passkeys right in the email field (autofill). */
export async function autofillSupported(): Promise<boolean> {
  if (!passkeysSupported()) return false
  return (await PublicKeyCredential.isConditionalMediationAvailable?.().catch(() => false)) ?? false
}

/** A new passkey: the device asks for Face ID, Touch ID or a PIN, then makes the key. */
export async function createPasskey(options: PasskeyCreationJSON): Promise<unknown> {
  const credential = (await navigator.credentials.create({
    publicKey: {
      ...options,
      challenge: toBuffer(options.challenge),
      user: { ...options.user, id: toBuffer(options.user.id) },
      excludeCredentials: descriptors(options.excludeCredentials),
    },
  })) as PublicKeyCredential | null
  if (!credential) throw new Error('cancelled')
  const response = credential.response as AuthenticatorAttestationResponse
  return {
    id: credential.id,
    rawId: toB64(credential.rawId),
    type: credential.type,
    authenticatorAttachment: credential.authenticatorAttachment ?? undefined,
    clientExtensionResults: credential.getClientExtensionResults(),
    response: {
      clientDataJSON: toB64(response.clientDataJSON),
      attestationObject: toB64(response.attestationObject),
      transports: response.getTransports?.() ?? [],
    },
  }
}

/**
 * Signing in with a passkey. With `autofill`, the request waits quietly for the person to pick a
 * passkey in the email field's suggestions; `signal` cancels it (a click on the button, leaving).
 */
export async function getPasskey(
  options: PasskeyRequestJSON,
  { autofill = false, signal }: { autofill?: boolean; signal?: AbortSignal } = {},
): Promise<unknown> {
  const credential = (await navigator.credentials.get({
    publicKey: {
      ...options,
      challenge: toBuffer(options.challenge),
      allowCredentials: descriptors(options.allowCredentials),
    },
    ...(autofill ? { mediation: 'conditional' as CredentialMediationRequirement } : {}),
    signal,
  })) as PublicKeyCredential | null
  if (!credential) throw new Error('cancelled')
  const response = credential.response as AuthenticatorAssertionResponse
  return {
    id: credential.id,
    rawId: toB64(credential.rawId),
    type: credential.type,
    authenticatorAttachment: credential.authenticatorAttachment ?? undefined,
    clientExtensionResults: credential.getClientExtensionResults(),
    response: {
      clientDataJSON: toB64(response.clientDataJSON),
      authenticatorData: toB64(response.authenticatorData),
      signature: toB64(response.signature),
      userHandle: response.userHandle ? toB64(response.userHandle) : undefined,
    },
  }
}

/** The person closed the device's prompt, or another request took its place: not an error to show. */
export const cancelled = (error: unknown) =>
  error instanceof DOMException
    ? error.name === 'NotAllowedError' || error.name === 'AbortError'
    : (error as Error)?.message === 'cancelled'
