/**
 * The address the server listens on. `dev` stays on this computer unless asked otherwise: a new site
 * in development has no installation code, so on a shared Wi-Fi whoever opened it first could create
 * the administrator. `start` listens everywhere (Docker, a VPS behind a proxy), protected by that code.
 */
export function listenHost(mode: string, flag: string | undefined, env: string | undefined): string | undefined {
  return flag ?? env ?? (mode === 'dev' ? '127.0.0.1' : undefined)
}

/** Whether only this computer can reach the server at that address. */
export function onlyThisComputer(host: string | undefined): boolean {
  return host === '127.0.0.1' || host === 'localhost' || host === '::1'
}
