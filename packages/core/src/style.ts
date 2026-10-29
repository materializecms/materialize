/**
 * Presentation settings every block can carry in `_style`, whatever its fields.
 * The values are names, not colors or pixels: each site decides what they look like,
 * so editors stay within the design system.
 */
export const BLOCK_STYLE = {
  background: ['default', 'muted', 'dark', 'accent'],
  spacing: ['none', 'compact', 'normal', 'spacious'],
  animation: ['none', 'fade', 'rise', 'zoom', 'slide'],
} as const

export interface BlockStyle {
  background?: (typeof BLOCK_STYLE.background)[number]
  spacing?: (typeof BLOCK_STYLE.spacing)[number]
  animation?: (typeof BLOCK_STYLE.animation)[number]
  /** Id for links to this block: /page#anchor. */
  anchor?: string
}

export const ANCHOR_PATTERN = /^[a-z][a-z0-9-]*$/
