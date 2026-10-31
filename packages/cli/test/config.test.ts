import { defineConfig } from '@materializecms/core'
import { describe, expect, it } from 'vitest'
import { withEnvironment } from '../src/load-config.ts'

const config = defineConfig({ site: { name: 'Prova' }, collections: [] })

describe('the server environment', () => {
  it('sets the address, port and proxy the VPS installer chose', () => {
    const next = withEnvironment(config, {
      MATERIALIZE_SITE_URL: 'https://example.com',
      MATERIALIZE_PORT: '4400',
      MATERIALIZE_TRUST_PROXY: '1',
    })
    expect(next.site.url).toBe('https://example.com')
    expect(next.server).toEqual({ port: 4400, trustProxy: true })
  })

  it('leaves the config as it is without them, and keeps an address the site sets itself', () => {
    expect(withEnvironment(config, {})).toEqual(config)
    const own = defineConfig({ site: { name: 'Prova', url: 'https://mio.example' }, collections: [] })
    expect(withEnvironment(own, { MATERIALIZE_SITE_URL: 'https://altro.example' }).site.url).toBe('https://mio.example')
  })

  it('ignores values that make no sense', () => {
    const next = withEnvironment(config, { MATERIALIZE_PORT: 'abc', MATERIALIZE_TRUST_PROXY: 'forse' })
    expect(next.server).toEqual({ port: 4321, trustProxy: false })
  })
})
