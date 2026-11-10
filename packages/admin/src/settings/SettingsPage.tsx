import { ChevronRight } from 'lucide-react'
import type { FormEventHandler, ReactNode } from 'react'
import { cx } from '../components/ui.tsx'

/**
 * The column every settings tab sits in: one fixed, comfortable width, so switching tabs never
 * makes the content jump. A form when `onSubmit` is given.
 */
export function SettingsPage({
  children,
  onSubmit,
  className,
}: {
  children: ReactNode
  onSubmit?: FormEventHandler<HTMLFormElement>
  className?: string
}) {
  const cls = cx('w-full max-w-2xl space-y-10 px-4 pt-6 pb-10 sm:px-8', className)
  return onSubmit ? (
    <form onSubmit={onSubmit} className={cls}>
      {children}
    </form>
  ) : (
    <div className={cls}>{children}</div>
  )
}

/** The standard heading of a settings section: a title, an optional line under it, optional actions. */
export function SettingsHeading({
  title,
  description,
  actions,
  level = 2,
}: {
  title: ReactNode
  description?: ReactNode
  actions?: ReactNode
  level?: 2 | 3
}) {
  const H = level === 2 ? 'h2' : 'h3'
  return (
    <div className="flex flex-wrap items-start gap-x-3 gap-y-2">
      <div className="min-w-0 flex-1">
        <H className={cx('font-semibold tracking-[-0.01em]', level === 2 ? 'text-[16px]' : 'text-[14px]')}>{title}</H>
        {description && <div className="mt-1 text-[13px] leading-relaxed text-fg2">{description}</div>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  )
}

/** A settings section: the standard heading, then its content. */
export function SettingsSection({
  title,
  description,
  actions,
  children,
  className,
  ...rest
}: {
  title: ReactNode
  description?: ReactNode
  actions?: ReactNode
  children?: ReactNode
  className?: string
  'aria-label'?: string
}) {
  return (
    <section className={cx('space-y-4', className)} {...rest}>
      <SettingsHeading title={title} description={description} actions={actions} />
      {children}
    </section>
  )
}

/** A block inside a settings section, on the panel's look: a rounded card, no border line. */
export const settingsCard = 'rounded-2xl bg-panel2'

/** Something folded away: a pill-shaped toggle with a turning chevron, instead of the browser's triangle. */
export function Disclosure({
  summary,
  children,
  className,
}: {
  summary: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <details className={cx('group', className)}>
      <summary className="inline-flex h-7 cursor-pointer list-none items-center gap-1.5 rounded-full px-2.5 -ml-2.5 text-[13px] font-medium text-fg2 select-none hover:bg-hover hover:text-fg [&::-webkit-details-marker]:hidden">
        <ChevronRight className="size-3.5 transition-transform group-open:rotate-90" />
        {summary}
      </summary>
      <div className="mt-2">{children}</div>
    </details>
  )
}

/** A download link that looks like the shared small secondary Button (a pill). */
export const linkButton =
  'inline-flex h-7 shrink-0 items-center justify-center gap-1.5 rounded-full border border-line2 bg-panel px-3 text-[13px] font-medium text-fg transition-colors hover:bg-hover [&_svg]:size-3.5'
