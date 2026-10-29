import { FONTS, fontId } from '@materializecms/core/page'

/** Loads a Google Font's stylesheet from the site (self-hosted), once per family. */
export function loadFont(family: string) {
  if (FONTS[family]) return
  const href = `/fonts/${fontId(family)}.css`
  if (document.head.querySelector(`link[href="${href}"]`)) return
  const link = document.createElement('link')
  link.rel = 'stylesheet'
  link.href = href
  document.head.append(link)
}
