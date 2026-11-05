import type { PageNode, Theme } from '@materializecms/core/page'
import {
  accessibilityChecks,
  contrastChecks,
  type MeasuredText,
  type MediaInfo,
  over,
  parseColor,
  performanceChecks,
  type QualityCheck,
  type Rgba,
} from '@materializecms/core/quality'

const WHITE: Rgba = [255, 255, 255, 1]

/**
 * The solid colour behind an element, as the eye sees it: layers blended up to the first opaque
 * one. Null when a photo, a gradient, a video or a 3D scene is behind it (no single colour).
 */
function backgroundOf(el: HTMLElement): Rgba | null {
  const layers: Rgba[] = []
  for (let at: HTMLElement | null = el; at; at = at.parentElement) {
    const style = getComputedStyle(at)
    if (style.backgroundImage && style.backgroundImage !== 'none') return null
    if (at.querySelector(':scope > .mz-bgimg, :scope > canvas.mz-scene, :scope > video')) return null
    const color = parseColor(style.backgroundColor)
    if (color && color[3] > 0) {
      layers.push(color)
      if (color[3] >= 1) break
    }
    if (at.classList.contains('mz-page')) break
  }
  return layers.reduceRight<Rgba>((below, top) => over(top, below), WHITE)
}

/** Every visible text and button label on the canvas, with its colours and size. */
export function measureTexts(root: ParentNode): MeasuredText[] {
  const out: MeasuredText[] = []
  for (const el of root.querySelectorAll<HTMLElement>('[data-mz-type="text"], [data-mz-type="button"]')) {
    const sample = (el.textContent || el.textContent || '').replace(/\s+/g, ' ').trim()
    if (!sample || !el.offsetParent) continue
    const style = getComputedStyle(el)
    // Gradient or clipped text paints its own colours: no single colour to check.
    if (style.backgroundClip === 'text' || style.webkitBackgroundClip === 'text') continue
    const color = parseColor(style.color)
    if (!color || Number(style.opacity) === 0) continue
    out.push({
      nodeId: el.dataset.mzId ?? '',
      sample: sample.length > 40 ? `${sample.slice(0, 38)}…` : sample,
      color,
      background: backgroundOf(el),
      fontSize: Number.parseFloat(style.fontSize) || 16,
      fontWeight: Number(style.fontWeight) || 400,
    })
  }
  return out
}

/** The canvas of the page being edited, if it is on screen. */
export const canvasPage = () => document.querySelector<HTMLElement>('[data-mz-canvas] .mz-page')

/** Accessibility (with the contrast measured on the canvas) and performance of a page. */
export function qualityOf(
  nodes: PageNode[],
  options: { media?: Record<string, MediaInfo>; theme?: Theme; root?: ParentNode | null } = {},
): { accessibility: QualityCheck[]; performance: QualityCheck[] } {
  const root = options.root === undefined ? canvasPage() : options.root
  const contrast = root ? contrastChecks(measureTexts(root)) : []
  const accessibility = [...contrast, ...accessibilityChecks(nodes)]
  const rank = { error: 0, warning: 1, ok: 2 }
  accessibility.sort((a, b) => rank[a.level] - rank[b.level])
  return { accessibility, performance: performanceChecks(nodes, options) }
}
