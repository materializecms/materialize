import type { PageNode } from '@materializecms/core/page'

/**
 * <main> around the sections between the leading menus and the trailing footers. Each section's
 * opening tag carries its own class (n-<id>), so the boundaries are found in the HTML without
 * rendering the sections apart (that would change which title is the H1). When a boundary is not
 * found the page is left as it is.
 */
export function withMain(out: string, list: PageNode[]): string {
  // The renderer may one day write its own: never two.
  if (/<main[\s>]/.test(out)) return out
  const isNav = (n: PageNode) => n.type === 'frame' && !!n.section?.startsWith('nav')
  const isFooter = (n: PageNode) => n.type === 'frame' && !!n.section?.startsWith('footer')
  let first = 0
  while (first < list.length && isNav(list[first] as PageNode)) first++
  let last = list.length
  while (last > first && isFooter(list[last - 1] as PageNode)) last--
  if (first >= last) return out
  const openingOf = (n: PageNode | undefined, from: number) => {
    if (!n) return -1
    const at = out.indexOf(` class="mz-n n-${n.id.replace(/[^\w-]/g, '')}"`, from)
    return at === -1 ? -1 : out.lastIndexOf('<', at)
  }
  const start = openingOf(list[first], 0)
  if (start === -1) return out
  // The wrapper's closing </div> ends the page when no footer follows.
  const end = last < list.length ? openingOf(list[last], start) : out.lastIndexOf('</div>')
  if (end === -1 || end < start) return out
  return `${out.slice(0, start)}<main>${out.slice(start, end)}</main>${out.slice(end)}`
}
