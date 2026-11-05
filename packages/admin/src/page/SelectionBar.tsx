import type { PageNode } from '@materializecms/core/page'
import { ArrowDown, ArrowUp, Copy, ImagePlus, MoreHorizontal, Smartphone, Trash2 } from 'lucide-react'
import type { ReactNode } from 'react'
import { CanvasTextMenu } from '../components/AiMenu.tsx'
import { cx } from '../components/ui.tsx'

/**
 * The few actions people reach for most, right above the selected element on the canvas: the
 * AI on its text, change the picture, duplicate, move, how it looks on mobile, more, delete.
 */
export function SelectionBar({
  node,
  first,
  last,
  onMobile,
  onText,
  onPickImage,
  onDuplicate,
  onMove,
  onMore,
  onDelete,
}: {
  node: PageNode
  first: boolean
  last: boolean
  /** Shown when not already on mobile. */
  onMobile?: () => void
  onText: (patch: Partial<PageNode>) => void
  onPickImage: () => void
  onDuplicate: () => void
  onMove: (dir: -1 | 1) => void
  onMore: (x: number, y: number) => void
  onDelete: () => void
}) {
  const hasText = (node.type === 'text' && !node.langs) || node.type === 'button'
  return (
    <div
      role="toolbar"
      aria-label="Azioni sull’elemento"
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
      className="flex items-center gap-0.5 rounded-lg border border-line bg-panel p-0.5 whitespace-nowrap shadow-pop"
    >
      {hasText && (
        <span className="px-0.5">
          <CanvasTextMenu node={node} onResult={onText} />
        </span>
      )}
      {node.type === 'image' && (
        <Tool label="Cambia immagine" onClick={onPickImage}>
          <ImagePlus />
        </Tool>
      )}
      <Tool label="Duplica · ⌘D" onClick={onDuplicate}>
        <Copy />
      </Tool>
      <Tool label="Sposta su · ⌥↑" disabled={first} onClick={() => onMove(-1)}>
        <ArrowUp />
      </Tool>
      <Tool label="Sposta giù · ⌥↓" disabled={last} onClick={() => onMove(1)}>
        <ArrowDown />
      </Tool>
      {onMobile && (
        <Tool label="Com’è su mobile" onClick={onMobile}>
          <Smartphone />
        </Tool>
      )}
      <Tool
        label="Altre azioni"
        onClick={(e) => {
          const r = e.currentTarget.getBoundingClientRect()
          onMore(r.left, r.bottom + 4)
        }}
      >
        <MoreHorizontal />
      </Tool>
      <span className="mx-0.5 h-4 w-px bg-line" />
      <Tool label="Elimina · ⌫" danger onClick={onDelete}>
        <Trash2 />
      </Tool>
    </div>
  )
}

function Tool({
  label,
  children,
  onClick,
  disabled,
  danger,
}: {
  label: string
  children: ReactNode
  onClick: (e: React.MouseEvent<HTMLButtonElement>) => void
  disabled?: boolean
  danger?: boolean
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={cx(
        'inline-flex size-7 items-center justify-center rounded-md text-fg2 transition-colors hover:bg-hover hover:text-fg disabled:pointer-events-none disabled:opacity-35 [&_svg]:size-3.5',
        danger && 'hover:text-danger',
      )}
    >
      {children}
    </button>
  )
}
