import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { startScenes } from '../src/scene.ts'

// A tiny stand-in for the browser: observers whose reports the test sends by hand (the last
// IntersectionObserver made is the one that waits for scenes to come near).
type Report = (entries: { target: unknown; isIntersecting?: boolean }[]) => void
let intersections: Report[] = []
let resizes: Report[] = []
const g = globalThis as Record<string, unknown>

beforeEach(() => {
  intersections = []
  resizes = []
  g.window = globalThis
  g.matchMedia = () => ({ matches: false })
  g.addEventListener = () => {}
  g.removeEventListener = () => {}
  g.requestAnimationFrame = () => 1
  g.cancelAnimationFrame = () => {}
  g.IntersectionObserver = class {
    constructor(cb: Report) {
      intersections.push(cb)
    }
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  g.ResizeObserver = class {
    constructor(cb: Report) {
      resizes.push(cb)
    }
    observe() {}
    unobserve() {}
    disconnect() {}
  }
})

afterEach(() => {
  for (const k of ['window', 'matchMedia', 'addEventListener', 'removeEventListener', 'requestAnimationFrame'])
    delete g[k]
  for (const k of ['cancelAnimationFrame', 'IntersectionObserver', 'ResizeObserver']) delete g[k]
})

const sceneCanvas = (width: number, height: number) => ({
  dataset: { mzScene: JSON.stringify({ preset: 'grain' }) },
  clientWidth: width,
  clientHeight: height,
  // No 2D context here: asking for one is the sign the scene started.
  getContext: vi.fn(() => null),
})

describe('scenes on the site', () => {
  it('wait until they come near the screen', () => {
    const canvas = sceneCanvas(400, 300)
    startScenes({ querySelectorAll: () => [canvas] } as never)
    expect(canvas.getContext).not.toHaveBeenCalled()
    intersections.at(-1)?.([{ target: canvas, isIntersecting: false }])
    expect(canvas.getContext).not.toHaveBeenCalled()
    intersections.at(-1)?.([{ target: canvas, isIntersecting: true }])
    expect(canvas.getContext).toHaveBeenCalledTimes(1)
  })

  it('do not start while hidden or 0 px tall, and start once a resize shows them', () => {
    const canvas = sceneCanvas(375, 0)
    startScenes({ querySelectorAll: () => [canvas] } as never)
    intersections.at(-1)?.([{ target: canvas, isIntersecting: true }])
    resizes[0]?.([{ target: canvas }])
    expect(canvas.getContext).not.toHaveBeenCalled()
    canvas.clientHeight = 420
    resizes[0]?.([{ target: canvas }])
    expect(canvas.getContext).toHaveBeenCalledTimes(1)
    // Started once only.
    resizes[0]?.([{ target: canvas }])
    intersections.at(-1)?.([{ target: canvas, isIntersecting: true }])
    expect(canvas.getContext).toHaveBeenCalledTimes(1)
  })
})
