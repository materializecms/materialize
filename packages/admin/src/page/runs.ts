import type { Run } from '@materializecms/core/page'

/** Reads formatted text back from an element edited in place: bold, italic, links and line breaks. */
export function domToRuns(root: HTMLElement): Run[] {
  const runs: Run[] = []
  const push = (t: string, f: Omit<Run, 't'>) => {
    if (!t) return
    const last = runs[runs.length - 1]
    if (last && !!last.b === !!f.b && !!last.i === !!f.i && (last.href ?? '') === (f.href ?? '')) last.t += t
    else runs.push({ t, ...(f.b ? { b: true } : {}), ...(f.i ? { i: true } : {}), ...(f.href ? { href: f.href } : {}) })
  }
  const visit = (node: Node, f: Omit<Run, 't'>) => {
    if (node.nodeType === Node.TEXT_NODE) {
      push((node.textContent ?? '').replace(/ /g, ' '), f)
      return
    }
    if (!(node instanceof HTMLElement)) return
    const tag = node.tagName
    if (tag === 'BR') {
      push('\n', f)
      return
    }
    const next = { ...f }
    const weight = node.style.fontWeight
    if (tag === 'B' || tag === 'STRONG' || weight === 'bold' || Number(weight) >= 600) next.b = true
    if (tag === 'I' || tag === 'EM' || node.style.fontStyle === 'italic') next.i = true
    if (tag === 'A') next.href = node.getAttribute('href') ?? undefined
    // Browsers wrap new lines in <div> while editing.
    if ((tag === 'DIV' || tag === 'P') && node !== root && runs.length) push('\n', f)
    for (const child of node.childNodes) visit(child, next)
  }
  for (const child of root.childNodes) visit(child, {})
  // A trailing break is how browsers keep the caret on an empty last line.
  const last = runs[runs.length - 1]
  if (last) last.t = last.t.replace(/\n$/, '')
  return runs.filter((r) => r.t)
}

/** Plain text when nothing is formatted, so simple texts stay simple in the data. */
export function simplify(runs: Run[]): { text: string; runs: Run[] | null } {
  const text = runs.map((r) => r.t).join('')
  const formatted = runs.some((r) => r.b || r.i || r.href)
  return { text, runs: formatted ? runs : null }
}
