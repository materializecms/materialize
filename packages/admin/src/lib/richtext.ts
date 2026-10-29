import type { RichText, RichTextBlock, RichTextRun } from '@materialize/core'

/** Minimal shape of Tiptap/ProseMirror JSON that we read and write. */
export interface PMNode {
  type: string
  attrs?: Record<string, unknown>
  content?: PMNode[]
  text?: string
  marks?: { type: string; attrs?: Record<string, unknown> }[]
}

function runsToInline(runs: RichTextRun[]): PMNode[] {
  return runs
    .filter((r) => r.text)
    .map((r) => {
      const marks: NonNullable<PMNode['marks']> = []
      if (r.bold) marks.push({ type: 'bold' })
      if (r.italic) marks.push({ type: 'italic' })
      if (r.href) marks.push({ type: 'link', attrs: { href: r.href } })
      return marks.length ? { type: 'text', text: r.text, marks } : { type: 'text', text: r.text }
    })
}

const paragraph = (runs: RichTextRun[]): PMNode => {
  const content = runsToInline(runs)
  return content.length ? { type: 'paragraph', content } : { type: 'paragraph' }
}

/** Our stored rich text → Tiptap document. Consecutive list items and quotes are grouped. */
export function toTiptap(value: RichText | undefined): PMNode {
  const content: PMNode[] = []
  for (const block of value ?? []) {
    const last = content[content.length - 1]
    if (block.type === 'listItem') {
      const item: PMNode = { type: 'listItem', content: [paragraph(block.children)] }
      if (last?.type === 'bulletList') last.content?.push(item)
      else content.push({ type: 'bulletList', content: [item] })
    } else if (block.type === 'quote') {
      if (last?.type === 'blockquote') last.content?.push(paragraph(block.children))
      else content.push({ type: 'blockquote', content: [paragraph(block.children)] })
    } else if (block.type === 'heading') {
      const inline = runsToInline(block.children)
      content.push({
        type: 'heading',
        attrs: { level: block.level ?? 2 },
        ...(inline.length ? { content: inline } : {}),
      })
    } else {
      content.push(paragraph(block.children))
    }
  }
  return { type: 'doc', content: content.length ? content : [{ type: 'paragraph' }] }
}

function inlineToRuns(nodes: PMNode[] | undefined): RichTextRun[] {
  const runs: RichTextRun[] = []
  for (const node of nodes ?? []) {
    if (node.type === 'hardBreak') {
      const last = runs[runs.length - 1]
      if (last) last.text += '\n'
      else runs.push({ text: '\n' })
      continue
    }
    if (node.type !== 'text' || !node.text) continue
    const run: RichTextRun = { text: node.text }
    for (const mark of node.marks ?? []) {
      if (mark.type === 'bold') run.bold = true
      if (mark.type === 'italic') run.italic = true
      if (mark.type === 'link' && typeof mark.attrs?.href === 'string') run.href = mark.attrs.href
    }
    const last = runs[runs.length - 1]
    if (last && last.bold === run.bold && last.italic === run.italic && last.href === run.href) last.text += run.text
    else runs.push(run)
  }
  return runs
}

/** Tiptap document → our stored rich text. Nesting is flattened to the blocks the schema supports. */
export function fromTiptap(doc: PMNode): RichText {
  const out: RichTextBlock[] = []
  const walk = (nodes: PMNode[] | undefined, as?: RichTextBlock['type']) => {
    for (const node of nodes ?? []) {
      switch (node.type) {
        case 'paragraph':
          out.push({ type: as ?? 'paragraph', children: inlineToRuns(node.content) })
          break
        case 'heading': {
          const level = Number(node.attrs?.level ?? 2)
          out.push({
            type: 'heading',
            level: (level <= 2 ? 2 : level >= 4 ? 4 : 3) as 2 | 3 | 4,
            children: inlineToRuns(node.content),
          })
          break
        }
        case 'blockquote':
          walk(node.content, 'quote')
          break
        case 'bulletList':
        case 'orderedList':
          walk(node.content)
          break
        case 'listItem':
          walk(node.content, 'listItem')
          break
      }
    }
  }
  walk(doc.content)
  // An editor holding only one empty paragraph is empty.
  if (out.length === 1 && out[0]?.type === 'paragraph' && !out[0].children.length) return []
  return out
}

export function plainText(value: RichText | undefined): string {
  return (value ?? []).map((b) => b.children.map((r) => r.text).join('')).join(' ')
}
