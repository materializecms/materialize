import { Check, Loader2 } from 'lucide-react'
import {
  type ComponentProps,
  type InputHTMLAttributes,
  type ReactNode,
  type RefObject,
  type TextareaHTMLAttributes,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react'
import { createPortal } from 'react-dom'
import type { DocumentStatus } from '../lib/api.ts'

export const cx = (...classes: (string | false | null | undefined)[]) => classes.filter(Boolean).join(' ')

// ---------- buttons ----------

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'

const variants: Record<Variant, string> = {
  primary: 'bg-fg text-bg hover:opacity-90 disabled:opacity-40',
  secondary: 'bg-panel border border-line2 text-fg hover:bg-hover disabled:opacity-50',
  ghost: 'text-fg2 hover:bg-hover hover:text-fg disabled:opacity-40',
  danger: 'bg-danger text-white hover:opacity-90 disabled:opacity-50',
}

export function Button({
  variant = 'secondary',
  size = 'md',
  loading,
  icon,
  children,
  className,
  ...props
}: ComponentProps<'button'> & {
  variant?: Variant
  size?: 'sm' | 'md'
  loading?: boolean
  icon?: ReactNode
}) {
  return (
    <button
      type="button"
      {...props}
      disabled={props.disabled || loading}
      className={cx(
        'inline-flex shrink-0 items-center justify-center gap-1.5 rounded-md font-medium transition-[background,opacity] select-none disabled:cursor-not-allowed',
        size === 'sm' ? 'h-7 px-2.5 text-[12px]' : 'h-8 px-3 text-[13px]',
        variants[variant],
        className,
      )}
    >
      {loading ? <Loader2 className="size-3.5 animate-spin" /> : icon}
      {children}
    </button>
  )
}

export function IconButton({
  label,
  active,
  children,
  className,
  ...props
}: ComponentProps<'button'> & { label: string; active?: boolean }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      {...props}
      className={cx(
        'inline-flex size-7 shrink-0 items-center justify-center rounded-md text-fg2 transition-colors hover:bg-hover hover:text-fg disabled:pointer-events-none disabled:opacity-35 [&_svg]:size-4',
        active && 'bg-accent/12 text-accent hover:bg-accent/18 hover:text-accent',
        className,
      )}
    >
      {children}
    </button>
  )
}

// ---------- inputs ----------

export const inputClass =
  'w-full rounded-md border border-line2 bg-input px-2.5 text-[13px] text-fg placeholder:text-fg3 transition-colors hover:border-fg3/40 focus:border-accent focus:outline-none focus:ring-3 focus:ring-accent/15 aria-invalid:border-danger aria-invalid:focus:ring-danger/15'

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cx(inputClass, 'h-8', className)} />
}

/** Textarea that grows with its content. */
export function Textarea({ className, value, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const ref = useRef<HTMLTextAreaElement>(null)
  // biome-ignore lint/correctness/useExhaustiveDependencies: resize whenever the value changes
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight + 2}px`
  }, [value])
  return (
    <textarea
      ref={ref}
      rows={2}
      value={value}
      {...props}
      className={cx(inputClass, 'block resize-none py-1.5 leading-relaxed', className)}
    />
  )
}

export function Switch({
  checked,
  onChange,
  label,
}: {
  checked: boolean
  onChange: (value: boolean) => void
  label?: string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cx(
        'relative inline-flex h-[18px] w-[30px] shrink-0 items-center rounded-full transition-colors',
        checked ? 'bg-accent' : 'bg-line2',
      )}
    >
      <span
        className={cx(
          'size-[14px] rounded-full bg-white shadow-sm transition-transform',
          checked ? 'translate-x-[14px]' : 'translate-x-[2px]',
        )}
      />
    </button>
  )
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  size = 'md',
  className,
}: {
  value: T
  options: { value: T; label: ReactNode; title?: string }[]
  onChange: (value: T) => void
  size?: 'sm' | 'md'
  className?: string
}) {
  return (
    <div role="radiogroup" className={cx('inline-flex rounded-md bg-seg p-0.5', className)}>
      {options.map((o) => (
        // biome-ignore lint/a11y/useSemanticElements: segmented control buttons act as radios
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          title={o.title}
          onClick={() => onChange(o.value)}
          className={cx(
            'inline-flex flex-1 items-center justify-center gap-1.5 rounded-[5px] px-2.5 font-medium whitespace-nowrap transition-colors [&_svg]:size-3.5',
            size === 'sm' ? 'h-6 text-[12px]' : 'h-7 text-[13px]',
            value === o.value ? 'bg-panel text-fg shadow-sm' : 'text-fg2 hover:text-fg',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

// ---------- status ----------

const statusInfo: Record<DocumentStatus, { label: string; dot: string }> = {
  draft: { label: 'Bozza', dot: 'bg-fg3' },
  published: { label: 'Pubblicato', dot: 'bg-ok' },
  changed: { label: 'Modifiche non pubblicate', dot: 'bg-warn' },
}

export function StatusBadge({ status, short }: { status: DocumentStatus; short?: boolean }) {
  const info = statusInfo[status]
  return (
    <span className="inline-flex items-center gap-1.5 text-[12px] whitespace-nowrap text-fg2">
      <span className={cx('size-1.5 rounded-full', info.dot)} />
      {short && status === 'changed' ? 'Modificato' : info.label}
    </span>
  )
}

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cx('size-4 animate-spin text-fg3', className)} />
}

export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="inline-flex h-[18px] min-w-[18px] items-center justify-center rounded border border-line2 bg-panel2 px-1 font-sans text-[11px] text-fg3">
      {children}
    </kbd>
  )
}

// ---------- popover & menu ----------

function useDismiss(open: boolean, onClose: () => void, refs: RefObject<HTMLElement | null>[]) {
  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => {
      if (refs.some((r) => r.current?.contains(e.target as Node))) return
      onClose()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
      }
    }
    document.addEventListener('pointerdown', onDown, true)
    document.addEventListener('keydown', onKey, true)
    return () => {
      document.removeEventListener('pointerdown', onDown, true)
      document.removeEventListener('keydown', onKey, true)
    }
  }, [open, onClose, refs])
}

/** A floating panel anchored to its trigger, rendered in a portal so panels never clip it. */
export function Popover({
  trigger,
  children,
  align = 'start',
  side = 'bottom',
  width,
  open: controlled,
  onOpenChange,
}: {
  trigger: (props: { open: boolean; toggle: () => void; ref: RefObject<HTMLButtonElement | null> }) => ReactNode
  children: ReactNode | ((close: () => void) => ReactNode)
  align?: 'start' | 'end' | 'center'
  side?: 'bottom' | 'top' | 'right'
  width?: number
  open?: boolean
  onOpenChange?: (open: boolean) => void
}) {
  const [internal, setInternal] = useState(false)
  const open = controlled ?? internal
  const setOpen = (v: boolean) => {
    setInternal(v)
    onOpenChange?.(v)
  }
  const anchor = useRef<HTMLButtonElement>(null)
  const panel = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)
  const close = () => setOpen(false)
  useDismiss(open, close, [anchor, panel])

  // biome-ignore lint/correctness/useExhaustiveDependencies: position once per open
  useLayoutEffect(() => {
    if (!open || !anchor.current || !panel.current) return setPos(null)
    const a = anchor.current.getBoundingClientRect()
    const p = panel.current.getBoundingClientRect()
    let top = side === 'top' ? a.top - p.height - 6 : side === 'right' ? a.top : a.bottom + 6
    let left =
      side === 'right'
        ? a.right + 6
        : align === 'end'
          ? a.right - p.width
          : align === 'center'
            ? a.left + a.width / 2 - p.width / 2
            : a.left
    left = Math.max(8, Math.min(left, innerWidth - p.width - 8))
    if (top + p.height > innerHeight - 8) top = Math.max(8, a.top - p.height - 6)
    setPos({ top, left })
  }, [open])

  return (
    <>
      {trigger({ open, toggle: () => setOpen(!open), ref: anchor })}
      {open &&
        createPortal(
          <div
            ref={panel}
            style={{ top: pos?.top ?? -9999, left: pos?.left ?? -9999, width }}
            className="mz-pop-in fixed z-50 overflow-hidden rounded-lg border border-line bg-panel shadow-pop"
          >
            {typeof children === 'function' ? children(close) : children}
          </div>,
          document.body,
        )}
    </>
  )
}

export function MenuItem({
  icon,
  children,
  onClick,
  danger,
  checked,
  hint,
  disabled,
}: {
  icon?: ReactNode
  children: ReactNode
  onClick: () => void
  danger?: boolean
  checked?: boolean
  hint?: ReactNode
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cx(
        'flex h-8 w-full items-center gap-2 rounded-md px-2 text-left text-[13px] transition-colors hover:bg-hover disabled:pointer-events-none disabled:opacity-40 [&>svg]:size-4 [&>svg]:shrink-0',
        danger ? 'text-danger' : 'text-fg',
      )}
    >
      {icon}
      <span className="flex-1 truncate">{children}</span>
      {hint && <span className="text-[12px] text-fg3">{hint}</span>}
      {checked && <Check className="text-accent" />}
    </button>
  )
}

export const MenuSeparator = () => <div className="my-1 h-px bg-line" />

// ---------- dialog ----------

export function Dialog({
  open,
  onClose,
  title,
  children,
  footer,
  width = 420,
}: {
  open: boolean
  onClose: () => void
  title: ReactNode
  children?: ReactNode
  footer?: ReactNode
  width?: number
}) {
  const panel = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    panel.current?.querySelector<HTMLElement>('[data-autofocus], input, button')?.focus()
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])
  if (!open) return null
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/30 px-4 pt-[14vh] backdrop-blur-[2px]">
      <button type="button" aria-label="Chiudi" className="absolute inset-0 cursor-default" onClick={onClose} />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        style={{ width }}
        className="mz-pop-in relative max-w-full rounded-xl border border-line bg-panel shadow-pop"
      >
        <div className="px-5 pt-4 pb-1 text-[15px] font-semibold">{title}</div>
        {children && <div className="px-5 pt-1 pb-4 text-fg2">{children}</div>}
        {footer && <div className="flex justify-end gap-2 border-t border-line px-5 py-3">{footer}</div>}
      </div>
    </div>,
    document.body,
  )
}

// ---------- toasts ----------

type Toast = { id: number; text: string; tone: 'ok' | 'error' }
let toasts: Toast[] = []
const toastListeners = new Set<() => void>()
let nextToast = 1

export function toast(text: string, tone: Toast['tone'] = 'ok') {
  const id = nextToast++
  toasts = [...toasts, { id, text, tone }]
  for (const l of toastListeners) l()
  setTimeout(
    () => {
      toasts = toasts.filter((t) => t.id !== id)
      for (const l of toastListeners) l()
    },
    tone === 'error' ? 5000 : 2600,
  )
}

export function Toaster() {
  const list = useSyncExternalStore(
    (cb) => {
      toastListeners.add(cb)
      return () => toastListeners.delete(cb)
    },
    () => toasts,
  )
  return createPortal(
    <div className="pointer-events-none fixed bottom-4 left-1/2 z-[60] flex -translate-x-1/2 flex-col items-center gap-2">
      {list.map((t) => (
        <div
          key={t.id}
          role="status"
          className={cx(
            'mz-pop-in rounded-lg px-3.5 py-2 text-[13px] font-medium shadow-pop',
            t.tone === 'error' ? 'bg-danger text-white' : 'bg-fg text-bg',
          )}
        >
          {t.text}
        </div>
      ))}
    </div>,
    document.body,
  )
}

export function EmptyState({ icon, title, children }: { icon: ReactNode; title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-20 text-center">
      <div className="mb-3 flex size-10 items-center justify-center rounded-xl bg-seg text-fg2 [&_svg]:size-5">
        {icon}
      </div>
      <div className="text-[14px] font-medium">{title}</div>
      {children && <div className="mt-1 max-w-sm text-fg2">{children}</div>}
    </div>
  )
}
