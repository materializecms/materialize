// biome-ignore-all lint/suspicious/noArrayIndexKey: pieces of a text that never reorders
import type { ReactNode } from 'react'
import { cx } from './ui.tsx'

/** **bold** and `code` inside a line. */
function inline(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4)
      return (
        <strong key={i} className="font-semibold text-fg">
          {part.slice(2, -2)}
        </strong>
      )
    if (part.startsWith('`') && part.endsWith('`') && part.length > 2)
      return (
        <code key={i} className="rounded bg-seg px-1 text-[0.92em]">
          {part.slice(1, -1)}
        </code>
      )
    return part
  })
}

/**
 * A reply from the AI: paragraphs, bulleted and numbered lists, bold. The little Markdown models
 * use in chat, shown as text rather than as stars and dashes.
 */
export function Prose({ text, className }: { text: string; className?: string }) {
  const blocks: ReactNode[] = []
  const lines = text.replace(/\r/g, '').split('\n')
  let list: { ordered: boolean; items: string[] } | null = null
  let para: string[] = []
  const flushPara = () => {
    if (para.length) blocks.push(<p key={blocks.length}>{inline(para.join(' '))}</p>)
    para = []
  }
  const flushList = () => {
    if (!list) return
    const items = list.items.map((it, i) => <li key={i}>{inline(it)}</li>)
    blocks.push(
      list.ordered ? (
        <ol key={blocks.length} className="list-decimal space-y-1 pl-5">
          {items}
        </ol>
      ) : (
        <ul key={blocks.length} className="list-disc space-y-1 pl-5">
          {items}
        </ul>
      ),
    )
    list = null
  }
  for (const raw of lines) {
    const line = raw.trim()
    const bullet = /^[-*•]\s+(.*)$/.exec(line)
    const number = /^\d+[.)]\s+(.*)$/.exec(line)
    if (bullet || number) {
      flushPara()
      const ordered = !!number
      if (list && list.ordered !== ordered) flushList()
      list ??= { ordered, items: [] }
      list.items.push(((bullet ?? number) as RegExpExecArray)[1] ?? '')
    } else if (!line) {
      flushPara()
      flushList()
    } else if (list) {
      // A line that goes on the item above.
      list.items[list.items.length - 1] += ` ${line}`
    } else para.push(line.replace(/^#+\s+/, ''))
  }
  flushPara()
  flushList()
  return <div className={cx('space-y-2', className)}>{blocks}</div>
}
