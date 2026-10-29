import { fontStack, TEXT_STYLES, type Theme, type ThemeColors } from '@materializecms/core/page'
import { Moon, Sun, Trash2 } from 'lucide-react'
import { NumField, Row, Section, Seg, Toggle } from './controls.tsx'
import { FontPicker } from './FontPicker.tsx'

const COLOR_LABELS: { key: keyof ThemeColors; label: string; hint: string }[] = [
  { key: 'bg', label: 'Sfondo', hint: 'Lo sfondo delle pagine' },
  { key: 'surface', label: 'Superficie', hint: 'Sezioni e schede in evidenza' },
  { key: 'text', label: 'Testo', hint: 'Titoli e testi' },
  { key: 'muted', label: 'Testo tenue', hint: 'Sottotitoli e didascalie' },
  { key: 'accent', label: 'Accento', hint: 'Pulsanti principali e dettagli' },
  { key: 'onAccent', label: 'Su accento', hint: 'Testo sopra il colore di accento' },
  { key: 'inverse', label: 'Inverso', hint: 'Sezioni scure (o chiare, nel tema scuro)' },
  { key: 'onInverse', label: 'Su inverso', hint: 'Testo sopra le sezioni inverse' },
]

/** The site's look, shared by every page: changes show on the canvas at once and are saved for the site. */
export function ThemePanel({
  theme,
  onChange,
  canEdit,
}: {
  theme: Theme
  onChange: (theme: Theme) => void
  canEdit: boolean
}) {
  const colors = theme.colors[theme.mode]
  const set = (patch: Partial<Theme>) => onChange({ ...theme, ...patch })
  const setColor = (key: keyof ThemeColors, value: string) =>
    onChange({ ...theme, colors: { ...theme.colors, [theme.mode]: { ...colors, [key]: value } } })

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <p className="border-b border-line px-3.5 py-3 text-[12px] leading-relaxed text-fg2">
        {canEdit
          ? 'Lo stile vale per tutto il sito: ogni pagina usa questi colori e caratteri.'
          : 'Lo stile del sito lo cambia un amministratore.'}
      </p>
      <fieldset disabled={!canEdit} className="disabled:opacity-60">
        <Section title="Tema">
          <Seg
            value={theme.mode}
            onChange={(mode) => set({ mode })}
            options={[
              {
                value: 'light',
                label: (
                  <>
                    <Sun /> Chiaro
                  </>
                ),
              },
              {
                value: 'dark',
                label: (
                  <>
                    <Moon /> Scuro
                  </>
                ),
              },
            ]}
          />
        </Section>
        <Section title="Colori">
          <div className="grid grid-cols-2 gap-1.5">
            {COLOR_LABELS.map((c) => (
              <label
                key={c.key}
                title={c.hint}
                className="flex h-9 cursor-pointer items-center gap-2 rounded-md border border-line px-1.5 hover:border-line2"
              >
                <input
                  type="color"
                  value={colors[c.key]}
                  onChange={(e) => setColor(c.key, e.target.value)}
                  className="size-6 shrink-0 cursor-pointer rounded border-0 bg-transparent p-0 [&::-webkit-color-swatch]:rounded-[5px] [&::-webkit-color-swatch]:border [&::-webkit-color-swatch]:border-black/15 [&::-webkit-color-swatch-wrapper]:p-0"
                />
                <span className="min-w-0">
                  <span className="block truncate text-[11.5px] font-medium">{c.label}</span>
                  <span className="block font-mono text-[10.5px] text-fg3 uppercase">{colors[c.key]}</span>
                </span>
              </label>
            ))}
          </div>
        </Section>
        <Section title="Caratteri">
          <Row label="Titoli">
            <FontPicker
              label="Carattere dei titoli"
              value={theme.display}
              onChange={(f) => set({ display: f.family, displayCategory: f.category })}
            />
          </Row>
          <Row label="Testo">
            <FontPicker
              label="Carattere del testo"
              value={theme.body}
              onChange={(f) => set({ body: f.family, bodyCategory: f.category })}
            />
          </Row>
          <Row label="Scala" hint="Ingrandisce o riduce tutti i testi">
            <Seg
              value={theme.scale}
              onChange={(scale) => set({ scale })}
              options={[
                { value: 0.9, label: 'S', title: 'Piccola' },
                { value: 1, label: 'M', title: 'Normale' },
                { value: 1.1, label: 'L', title: 'Grande' },
              ]}
            />
          </Row>
          <div
            className="space-y-1 rounded-lg border border-line p-2.5"
            style={{ color: colors.text, background: colors.bg }}
          >
            {(['h2', 'h3', 'body'] as const).map((s) => (
              <div
                key={s}
                style={{
                  fontFamily:
                    TEXT_STYLES[s].f === 'd'
                      ? fontStack(theme.display, theme.displayCategory)
                      : fontStack(theme.body, theme.bodyCategory),
                  fontSize: Math.min(28, TEXT_STYLES[s].d * theme.scale * 0.6),
                  fontWeight: TEXT_STYLES[s].f === 'd' && /Geist|Inter/.test(theme.display) ? 600 : TEXT_STYLES[s].w,
                  lineHeight: 1.2,
                }}
                className="truncate"
              >
                {TEXT_STYLES[s].label} · Aa
              </div>
            ))}
          </div>
        </Section>
        <Section title="Forme">
          <Row label="Pulsanti" hint="Raggio degli angoli dei pulsanti">
            <Seg
              value={theme.btnRadius >= 99 ? 999 : theme.btnRadius}
              onChange={(btnRadius) => set({ btnRadius })}
              options={[
                { value: 0, label: 'Netti' },
                { value: 8, label: 'Morbidi' },
                { value: 999, label: 'Pillola' },
              ]}
            />
          </Row>
          <Row label="Schede" hint="Raggio degli angoli di immagini e schede">
            <NumField value={theme.cardRadius} onChange={(v) => set({ cardRadius: v ?? 0 })} max={48} />
          </Row>
        </Section>
        <Section title="Esperienza">
          <Toggle
            label="Scorrimento morbido"
            checked={!!theme.smoothScroll}
            onChange={(smoothScroll) => set({ smoothScroll })}
          />
          <Row label="Cursore">
            <Seg
              value={theme.cursor ?? 'default'}
              onChange={(cursor) => set({ cursor })}
              options={[
                { value: 'default', label: 'Normale' },
                { value: 'dot', label: 'Punto' },
                { value: 'ring', label: 'Anello' },
              ]}
            />
          </Row>
          <Row label="Tra le pagine" hint="Transizione quando si passa da una pagina all’altra">
            <Seg
              value={theme.transition ?? 'none'}
              onChange={(transition) => set({ transition })}
              options={[
                { value: 'none', label: 'Nessuna' },
                { value: 'fade', label: 'Dissolvi' },
                { value: 'slide', label: 'Scorri' },
              ]}
            />
          </Row>
          <p className="text-[11px] leading-relaxed text-fg3">
            Si vedono sul sito pubblicato. Chi ha chiesto meno movimento al proprio dispositivo non li riceve, e su
            telefoni e tablet restano disattivati scorrimento morbido e cursore.
          </p>
        </Section>
        <Section title="Stili di testo">
          {(theme.textStyles ?? []).length === 0 && (
            <p className="text-[11.5px] leading-relaxed text-fg3">
              Nessuno stile ancora. Seleziona un testo e, nella sezione Testo, scegli “Crea uno stile da questo testo”.
            </p>
          )}
          {(theme.textStyles ?? []).map((ts) => {
            const base = TEXT_STYLES[ts.props.style ?? 'body'] ?? TEXT_STYLES.body
            const family = ts.props.font?.family ?? (base.f === 'd' ? theme.display : theme.body)
            return (
              <div key={ts.id} className="group/ts flex items-center gap-2">
                <span
                  className="w-8 shrink-0 truncate text-center text-[17px] leading-none"
                  style={{ fontFamily: fontStack(family), fontStyle: ts.props.italic ? 'italic' : undefined }}
                >
                  Aa
                </span>
                <input
                  aria-label="Nome dello stile"
                  defaultValue={ts.name}
                  onBlur={(e) => {
                    const name = e.currentTarget.value.trim()
                    if (name && name !== ts.name)
                      set({ textStyles: (theme.textStyles ?? []).map((x) => (x.id === ts.id ? { ...x, name } : x)) })
                  }}
                  onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
                  className="h-7 min-w-0 flex-1 rounded border border-transparent bg-transparent px-1 text-[12.5px] outline-none hover:border-line2 focus:border-accent"
                />
                <button
                  type="button"
                  title="Elimina lo stile: i testi che lo usano tornano al proprio stile"
                  aria-label={`Elimina lo stile ${ts.name}`}
                  onClick={() => set({ textStyles: (theme.textStyles ?? []).filter((x) => x.id !== ts.id) })}
                  className="flex size-6 items-center justify-center rounded text-fg3 opacity-0 group-hover/ts:opacity-100 hover:bg-hover hover:text-danger focus:opacity-100"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            )
          })}
        </Section>
      </fieldset>
    </div>
  )
}
