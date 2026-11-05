import { describe, expect, it } from 'vitest'
import type { PageNode } from '../src/page.ts'
import {
  accessibilityChecks,
  contrastChecks,
  contrastRatio,
  over,
  parseColor,
  performanceChecks,
} from '../src/quality.ts'

const page = (children: PageNode[]): PageNode[] => [{ id: 's', type: 'frame', children }]
const ids = (checks: { id: string; level: string }[]) => checks.filter((c) => c.level !== 'ok').map((c) => c.id)

describe('accessibility', () => {
  it('finds what a screen reader cannot tell', () => {
    const checks = accessibilityChecks(
      page([
        { id: 'h', type: 'text', style: 'h1', text: 'Casa' },
        { id: 'h3', type: 'text', style: 'h3', text: 'Dettagli' },
        { id: 'i', type: 'image', src: '/media/a.jpg' },
        { id: 'b', type: 'button', text: '' },
        { id: 'more', type: 'button', text: 'Scopri di più', href: '/servizi' },
        { id: 'ig', type: 'icon', icon: 'instagram', href: 'https://instagram.com/x' },
        { id: 'f', type: 'input', text: '' },
        { id: 'v', type: 'video', src: '/media/v.mp4' },
        { id: 't', type: 'text', text: 'Per saperne di più', runs: [{ t: 'clicca qui', href: '/x' }] },
        { id: 'hidden', type: 'image', src: '/media/b.jpg', hidden: true },
      ]),
    )
    expect(ids(checks).sort()).toEqual(
      ['alt:i', 'btn:b', 'icon:ig', 'label:f', 'levels', 'motion:v', 'vague:more', 'vague:t:clicca qui'].sort(),
    )
    expect(checks[0]?.level).toBe('error')
  })

  it('says so when every image is described', () => {
    const checks = accessibilityChecks(page([{ id: 'i', type: 'image', src: '/media/a.jpg', alt: 'La casa' }]))
    expect(checks).toEqual([{ id: 'alt', level: 'ok', label: 'Tutte le immagini hanno una descrizione' }])
  })
})

describe('contrast', () => {
  it('reads computed colours and measures them like WCAG', () => {
    expect(parseColor('rgb(10, 20, 30)')).toEqual([10, 20, 30, 1])
    expect(parseColor('rgba(0, 0, 0, 0.5)')).toEqual([0, 0, 0, 0.5])
    expect(parseColor('rgb(0 0 0 / 50%)')).toEqual([0, 0, 0, 0.5])
    expect(parseColor('#fff')).toEqual([255, 255, 255, 1])
    expect(parseColor('transparent')).toBeNull()
    expect(contrastRatio([0, 0, 0, 1], [255, 255, 255, 1])).toBeCloseTo(21, 0)
    expect(contrastRatio([119, 119, 119, 1], [255, 255, 255, 1])).toBeCloseTo(4.48, 1)
    expect(over([0, 0, 0, 0.5], [255, 255, 255, 1])).toEqual([127.5, 127.5, 127.5, 1])
  })

  it('asks 4.5:1 for normal text, 3:1 for large text, and skips texts over photos', () => {
    const white: [number, number, number, number] = [255, 255, 255, 1]
    const grey: [number, number, number, number] = [130, 130, 130, 1]
    const checks = contrastChecks([
      { nodeId: 'small', sample: 'Piccolo', color: grey, background: white, fontSize: 16, fontWeight: 400 },
      { nodeId: 'big', sample: 'Grande', color: grey, background: white, fontSize: 32, fontWeight: 700 },
      { nodeId: 'pale', sample: 'Chiaro', color: [220, 220, 220, 1], background: white, fontSize: 32, fontWeight: 400 },
      { nodeId: 'photo', sample: 'Su foto', color: white, background: null, fontSize: 16, fontWeight: 400 },
    ])
    expect(checks.map((c) => [c.id, c.level])).toEqual([
      ['contrast:pale', 'error'],
      ['contrast:small', 'warning'],
    ])
    expect(checks[1]?.detail).toContain('ne serve almeno 4,5:1')
  })
})

describe('performance', () => {
  it('weighs files, scenes, scripts, fonts and size', () => {
    const MB = 1024 * 1024
    const checks = performanceChecks(
      page([
        { id: 'ext', type: 'image', src: 'https://cdn.example/x.jpg' },
        { id: 'gif', type: 'image', src: '/media/anim.gif' },
        { id: 'v', type: 'video', src: '/media/v.mp4' },
        { id: 'sc1', type: 'scene' },
        { id: 'sc2', type: 'scene' },
        { id: 'sc3', type: 'frame', scene: { kind: 'gradient' } as never },
        { id: 'e', type: 'embed', html: '<script src="https://widget.example/a.js"></script>' },
        { id: 'f1', type: 'text', text: 'a', font: { family: 'Inter' } },
        { id: 'f2', type: 'text', text: 'b', font: { family: 'Lora' } },
      ]),
      {
        media: {
          '/media/anim.gif': { size: 4 * MB, mime: 'image/gif' },
          '/media/v.mp4': { size: 40 * MB, mime: 'video/mp4' },
        },
        theme: { display: 'Unbounded', body: 'Geist' } as never,
      },
    )
    expect(ids(checks).sort()).toEqual(
      ['external:ext', 'fonts', 'gif:gif', 'poster:v', 'scenes', 'scripts', 'video:v'].sort(),
    )
    expect(checks.find((c) => c.id === 'video:v')?.label).toBe('Video pesante (40,0 MB)')
  })

  it('says so when nothing weighs too much', () => {
    expect(performanceChecks(page([{ id: 't', type: 'text', text: 'Ciao' }]))).toEqual([
      { id: 'perf', level: 'ok', label: 'Nessun peso inutile trovato' },
    ])
  })
})
