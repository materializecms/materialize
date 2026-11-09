import { describe, expect, it } from 'vitest'
import { listenHost, onlyThisComputer } from '../src/host.ts'

describe('listening address', () => {
  it('keeps dev on this computer, and start on every address', () => {
    expect(listenHost('dev', undefined, undefined)).toBe('127.0.0.1')
    expect(listenHost('start', undefined, undefined)).toBeUndefined()
  })

  it('follows --host first, then MATERIALIZE_HOST', () => {
    expect(listenHost('dev', '0.0.0.0', '127.0.0.1')).toBe('0.0.0.0')
    expect(listenHost('dev', undefined, '0.0.0.0')).toBe('0.0.0.0')
    expect(listenHost('start', undefined, '127.0.0.1')).toBe('127.0.0.1')
  })

  it('tells a local address from an open one', () => {
    expect(onlyThisComputer('127.0.0.1')).toBe(true)
    expect(onlyThisComputer('localhost')).toBe(true)
    expect(onlyThisComputer('0.0.0.0')).toBe(false)
    expect(onlyThisComputer(undefined)).toBe(false)
  })
})
