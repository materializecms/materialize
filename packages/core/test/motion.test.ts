import { describe, expect, it } from 'vitest'
import { sampleInteraction, sampleKeys } from '../src/motion.ts'

describe('timelines', () => {
  const keys = [
    { id: 'a', at: 0, props: { y: 100, opacity: 0 } },
    { id: 'b', at: 0.5, props: { y: 0, opacity: 1 }, ease: 'linear' as const },
    { id: 'c', at: 1, props: { y: 0, opacity: 1, scale: 2 }, ease: 'linear' as const },
  ]

  it('passes through every keyframe, with each segment on its own curve', () => {
    expect(sampleKeys(keys, 0).y).toBe(100)
    expect(sampleKeys(keys, 0.25).y).toBeCloseTo(50)
    expect(sampleKeys(keys, 0.5).opacity).toBe(1)
    expect(sampleKeys(keys, 0.75).scale).toBeCloseTo(1.5)
    expect(sampleKeys(keys, 2).scale).toBe(2)
  })

  it('keeps the simple from/to when there is no timeline', () => {
    const v = sampleInteraction({ id: 'x', trigger: 'scroll', from: { x: 0 }, to: { x: 200 } }, 0.5)
    expect(v.x).toBe(100)
    expect(sampleInteraction({ id: 'x', trigger: 'view', keys }, 0.25).y).toBeCloseTo(50)
  })
})
