import type { BlockStyle } from '@materializecms/core/style'
import { ANCHOR_PATTERN } from '@materializecms/core/style'
import { Hash, Play } from 'lucide-react'
import { cx, IconButton, Input, Segmented } from '../components/ui.tsx'
import { useForm, useIssues } from '../fields/form-context.ts'

const BACKGROUNDS: { value: NonNullable<BlockStyle['background']>; label: string; swatch: string }[] = [
  { value: 'default', label: 'Pagina', swatch: 'bg-white' },
  { value: 'muted', label: 'Tenue', swatch: 'bg-neutral-200' },
  { value: 'dark', label: 'Scuro', swatch: 'bg-neutral-900' },
  { value: 'accent', label: 'Accento', swatch: 'bg-accent' },
]

const ANIMATIONS: { value: NonNullable<BlockStyle['animation']>; label: string }[] = [
  { value: 'none', label: 'Nessuna' },
  { value: 'fade', label: 'Dissolvenza' },
  { value: 'rise', label: 'Salita' },
  { value: 'zoom', label: 'Zoom' },
  { value: 'slide', label: 'Scorrimento' },
]

/**
 * Presentation of the selected block. The choices are names the site's theme defines
 * (what "dark" or "spacious" look like), so pages stay consistent whoever edits them.
 */
export function StylePanel({
  value,
  onChange,
  path,
  onReplay,
}: {
  value: BlockStyle | undefined
  onChange: (value: BlockStyle | undefined, group?: string) => void
  path: string
  onReplay?: () => void
}) {
  const { docUrl } = useForm()
  const style = value ?? {}
  const anchorErrors = useIssues(`${path}._style.anchor`)
  const set = <K extends keyof BlockStyle>(key: K, v: BlockStyle[K], group?: string) => {
    const next: BlockStyle = { ...style, [key]: v }
    if (!v) delete next[key]
    onChange(Object.keys(next).length ? next : undefined, group)
  }
  const anchorValid = !style.anchor || ANCHOR_PATTERN.test(style.anchor)
  const label = 'mb-1.5 block text-[12px] font-medium text-fg2'

  return (
    <div className="space-y-4">
      <div>
        <span className={label}>Sfondo</span>
        <div className="grid grid-cols-4 gap-1.5">
          {BACKGROUNDS.map((b) => {
            const active = (style.background ?? 'default') === b.value
            return (
              <button
                key={b.value}
                type="button"
                aria-pressed={active}
                onClick={() => set('background', b.value === 'default' ? undefined : b.value)}
                className={cx(
                  'flex flex-col items-center gap-1.5 rounded-md border px-1 py-2 text-[11.5px] transition-colors',
                  active
                    ? 'border-accent bg-accent/8 text-fg'
                    : 'border-line text-fg2 hover:border-line2 hover:text-fg',
                )}
              >
                <span className={cx('size-6 rounded-full border border-black/10', b.swatch)} />
                {b.label}
              </button>
            )
          })}
        </div>
      </div>

      <div>
        <span className={label}>Spazio sopra e sotto</span>
        <Segmented
          size="sm"
          className="flex w-full"
          value={style.spacing ?? 'normal'}
          onChange={(v) => set('spacing', v === 'normal' ? undefined : v)}
          options={[
            { value: 'none', label: 'Nessuno' },
            { value: 'compact', label: 'Ridotto' },
            { value: 'normal', label: 'Normale' },
            { value: 'spacious', label: 'Ampio' },
          ]}
        />
      </div>

      <div>
        <span className="mb-1.5 flex items-center justify-between text-[12px] font-medium text-fg2">
          Animazione all’ingresso
          {onReplay && style.animation && style.animation !== 'none' && (
            <IconButton label="Riproduci l’animazione" className="size-6" onClick={onReplay}>
              <Play />
            </IconButton>
          )}
        </span>
        <div className="flex flex-wrap gap-1">
          {ANIMATIONS.map((a) => {
            const active = (style.animation ?? 'none') === a.value
            return (
              <button
                key={a.value}
                type="button"
                aria-pressed={active}
                onClick={() => {
                  set('animation', a.value === 'none' ? undefined : a.value)
                  if (a.value !== 'none') setTimeout(() => onReplay?.(), 600)
                }}
                className={cx(
                  'h-7 rounded-md border px-2.5 text-[12px] transition-colors',
                  active
                    ? 'border-accent bg-accent/8 text-fg'
                    : 'border-line text-fg2 hover:border-line2 hover:text-fg',
                )}
              >
                {a.label}
              </button>
            )
          })}
        </div>
        <p className="mt-1.5 text-[11.5px] text-fg3">
          Parte quando il blocco entra nello schermo, mai per chi ha chiesto meno movimento.
        </p>
      </div>

      <label className="block">
        <span className={label}>Ancora</span>
        <div className="relative">
          <Hash className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-fg3" />
          <Input
            className="pl-7 font-mono text-[12.5px]"
            placeholder="chi-siamo"
            value={style.anchor ?? ''}
            aria-invalid={!anchorValid || anchorErrors.length > 0 || undefined}
            onChange={(e) => set('anchor', e.target.value.toLowerCase().replace(/\s+/g, '-') || undefined, 'anchor')}
          />
        </div>
        <span className={cx('mt-1 block text-[11.5px]', anchorValid ? 'text-fg3' : 'text-danger')}>
          {!anchorValid
            ? 'Usa lettere minuscole, numeri e trattini, iniziando con una lettera'
            : style.anchor
              ? `Link diretto: ${docUrl ?? ''}#${style.anchor}`
              : 'Per collegarsi direttamente a questo blocco, ad esempio dal menu.'}
        </span>
      </label>
    </div>
  )
}
