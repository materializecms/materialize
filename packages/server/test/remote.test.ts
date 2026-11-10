import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { isPrivate, RemoteError, remoteFetch } from '../src/remote.ts'

describe('addresses that are not public', () => {
  it('are found however they are written', () => {
    for (const a of [
      '127.0.0.1',
      '10.1.2.3',
      '172.20.0.1',
      '192.168.1.1',
      '169.254.169.254',
      '100.64.0.1',
      '0.0.0.0',
      '198.18.0.1',
      '192.0.0.8',
      '192.0.2.1',
      '198.51.100.7',
      '203.0.113.9',
      '224.0.0.1',
      '255.255.255.255',
      '::',
      '::1',
      '::ffff:127.0.0.1',
      '::ffff:7f00:1',
      '[::ffff:7f00:1]',
      '::ffff:a9fe:a9fe',
      '::ffff:0:7f00:1',
      '::127.0.0.1',
      '::7f00:1',
      '64:ff9b::7f00:1',
      '64:ff9b::10.0.0.1',
      '64:ff9b:1::1',
      '2002:7f00:1::',
      '2002:c0a8:101::1',
      'fc00::1',
      'fd12:3456::1',
      'fe80::1',
      'fe80::1%eth0',
      'fec0::1',
      'ff02::1',
      '2001:db8::1',
      'not-an-address',
    ])
      expect(isPrivate(a), a).toBe(true)
  })

  it('let public ones through', () => {
    for (const a of [
      '93.184.216.34',
      '8.8.8.8',
      '172.32.0.1',
      '::ffff:5db8:d822',
      '::ffff:93.184.216.34',
      '64:ff9b::808:808',
      '2002:808:808::1',
      '2606:4700:4700::1111',
      '2a00:1450:4001:80b::200e',
    ])
      expect(isPrivate(a), a).toBe(false)
  })
})

describe('fetching from the web', () => {
  let server: Server
  let port: number
  beforeAll(async () => {
    server = createServer((req, res) => {
      if (req.url === '/redirect') {
        res.writeHead(302, { location: `http://127.0.0.1:${port}/file.txt` })
        return res.end()
      }
      if (req.url === '/big') return res.end('x'.repeat(2048))
      res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8' })
      res.end(`ciao ${req.method} ${req.headers['x-test'] ?? ''}`)
    })
    await new Promise<void>((r) => server.listen(0, '127.0.0.1', r))
    port = (server.address() as AddressInfo).port
  })
  afterAll(() => server.close())

  const refused = async (url: string) => {
    const error = await remoteFetch(url, { max: 1024 }).catch((e) => e)
    expect(error, url).toBeInstanceOf(RemoteError)
    expect((error as RemoteError).reason, url).toBe('private')
  }

  it('refuses this machine, written as numbers or by a name that resolves here', async () => {
    await refused(`http://127.0.0.1:${port}/file.txt`)
    await refused(`http://[::ffff:127.0.0.1]:${port}/file.txt`)
    await refused(`http://[::ffff:7f00:1]:${port}/file.txt`)
    // A name is checked when connecting, with the address actually used.
    await refused(`http://localhost:${port}/file.txt`)
  })

  it('reads a server on the network when allowed, with headers, size limit and redirects', async () => {
    const res = await remoteFetch(`http://127.0.0.1:${port}/file.txt`, {
      max: 1024,
      allowPrivate: true,
      headers: { 'x-test': 'si' },
    })
    expect(res.status).toBe(200)
    expect(res.type).toBe('text/plain')
    expect(res.headers.get('content-type')).toContain('text/plain')
    expect(res.bytes.toString()).toBe('ciao GET si')
    expect(res.name).toBe('file.txt')

    const posted = await remoteFetch(`http://127.0.0.1:${port}/`, {
      max: 1024,
      allowPrivate: true,
      method: 'POST',
      body: '{}',
    })
    expect(posted.bytes.toString()).toBe('ciao POST ')

    const moved = await remoteFetch(`http://127.0.0.1:${port}/redirect`, { max: 1024, allowPrivate: true })
    expect(moved.url).toBe(`http://127.0.0.1:${port}/file.txt`)
    const noRedirects = await remoteFetch(`http://127.0.0.1:${port}/redirect`, {
      max: 1024,
      allowPrivate: true,
      maxRedirects: 0,
    }).catch((e) => e)
    expect(noRedirects).toBeInstanceOf(RemoteError)

    const big = await remoteFetch(`http://127.0.0.1:${port}/big`, { max: 1024, allowPrivate: true }).catch((e) => e)
    expect((big as RemoteError).reason).toBe('too_large')
  })
})
