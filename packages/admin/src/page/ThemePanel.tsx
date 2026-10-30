import {
  breakpointsOf,
  fontStack,
  type Swatch,
  TEXT_STYLES,
  type Theme,
  type ThemeColors,
} from '@materializecms/core/page'
import { Moon, Plus, Sun, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
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
  const swatches = theme.swatches ?? []
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
      <fieldset disabled={!canEdit} className="min-w-0 disabled:opacity-60">
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
              <div
                key={c.key}
                title={c.hint}
                className="flex h-9 items-center gap-2 rounded-md border border-line px-1.5 hover:border-line2"
              >
                <input
                  type="color"
                  aria-label={c.label}
                  value={colors[c.key]}
                  onChange={(e) => setColor(c.key, e.target.value)}
                  className="size-6 shrink-0 cursor-pointer rounded border-0 bg-transparent p-0 [&::-webkit-color-swatch]:rounded-[5px] [&::-webkit-color-swatch]:border [&::-webkit-color-swatch]:border-black/15 [&::-webkit-color-swatch-wrapper]:p-0"
                />
                <span className="min-w-0">
                  <span className="block truncate text-[11.5px] font-medium">{c.label}</span>
                  <HexInput label={`${c.label}: codice`} value={colors[c.key]} onChange={(v) => setColor(c.key, v)} />
                </span>
              </div>
            ))}
          </div>
        </Section>
        <Section
          title="Colori personalizzati"
          action={
            <button
              type="button"
              title="Aggiungi un colore"
              aria-label="Aggiungi un colore"
              onClick={() =>
                set({
                  swatches: [
                    ...swatches,
                    {
                      id: `sw-${Date.now().toString(36)}`,
                      name: `Colore ${swatches.length + 1}`,
                      light: '#7a8b6f',
                      dark: '#9fb08f',
                    },
                  ],
                })
              }
              className="flex size-6 items-center justify-center rounded text-fg3 hover:bg-hover hover:text-fg [&_svg]:size-3.5"
            >
              <Plus />
            </button>
          }
        >
          {swatches.length === 0 && (
            <p className="text-[11.5px] leading-relaxed text-fg3">
              Colori del marchio con un nome, da usare in ogni campo colore. Hanno una tinta per il tema chiaro e una
              per quello scuro.
            </p>
          )}
          {swatches.map((sw) => {
            const update = (patch: Partial<Swatch>) =>
              set({ swatches: swatches.map((x) => (x.id === sw.id ? { ...x, ...patch } : x)) })
            return (
              <div key={sw.id} className="group/sw flex flex-wrap items-center gap-1.5">
                {(['light', 'dark'] as const).map((m) => (
                  <input
                    key={m}
                    type="color"
                    title={m === 'light' ? 'Nel tema chiaro' : 'Nel tema scuro'}
                    aria-label={`${sw.name}: ${m === 'light' ? 'tema chiaro' : 'tema scuro'}`}
                    value={sw[m]}
                    onChange={(e) => update({ [m]: e.target.value })}
                    className="size-6 shrink-0 cursor-pointer rounded border-0 bg-transparent p-0 [&::-webkit-color-swatch]:rounded-[5px] [&::-webkit-color-swatch]:border [&::-webkit-color-swatch]:border-black/15 [&::-webkit-color-swatch-wrapper]:p-0"
                  />
                ))}
                <input
                  aria-label="Nome del colore"
                  defaultValue={sw.name}
                  onBlur={(e) => e.currentTarget.value.trim() && update({ name: e.currentTarget.value.trim() })}
                  onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
                  className="h-7 min-w-0 flex-1 rounded border border-transparent bg-transparent px-1 text-[12.5px] outline-none hover:border-line2 focus:border-accent"
                />
                <button
                  type="button"
                  title="Elimina il colore: gli elementi che lo usano tornano al colore del contenitore"
                  aria-label={`Elimina ${sw.name}`}
                  onClick={() => set({ swatches: swatches.filter((x) => x.id !== sw.id) })}
                  className="flex size-6 items-center justify-center rounded text-fg3 opacity-0 group-hover/sw:opacity-100 hover:bg-hover hover:text-danger focus:opacity-100"
                >
                  <Trash2 className="size-3.5" />
                </button>
                <div className="flex basis-full gap-3 pl-1">
                  {(['light', 'dark'] as const).map((m) => (
                    <span key={m} className="flex items-center gap-1 text-[10.5px] text-fg3">
                      {m === 'light' ? 'Chiaro' : 'Scuro'}
                      <HexInput
                        label={`${sw.name}: codice ${m === 'light' ? 'tema chiaro' : 'tema scuro'}`}
                        value={sw[m]}
                        onChange={(v) => update({ [m]: v })}
                      />
                    </span>
                  ))}
                </div>
              </div>
            )
          })}
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
        <Section title="Punti di rottura">
          <p className="text-[11px] leading-relaxed text-fg3">
            Sotto queste larghezze il sito usa le modifiche fatte per tablet e per mobile.
          </p>
          <Row label="Tablet sotto">
            <NumField
              value={breakpointsOf(theme).tablet + 1}
              min={601}
              max={1601}
              onChange={(v) => v && set({ breakpoints: { ...breakpointsOf(theme), tablet: v - 1 } })}
            />
          </Row>
          <Row label="Mobile sotto">
            <NumField
              value={breakpointsOf(theme).mobile + 1}
              min={321}
              max={1200}
              onChange={(v) => v && set({ breakpoints: { ...breakpointsOf(theme), mobile: v - 1 } })}
            />
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

/** A color as a code: type or paste #7c5cff (or 7c5cff, #fff); applied on Enter or leaving the field. */
function HexInput({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const [text, setText] = useState(value)
  useEffect(() => setText(value), [value])
  const commit = () => {
    let v = text.trim().replace(/^#?/, '#').toLowerCase()
    if (/^#[0-9a-f]{3}$/.test(v)) v = `#${[...v.slice(1)].map((c) => c + c).join('')}`
    if (/^#[0-9a-f]{6}$/.test(v)) {
      if (v !== value) onChange(v)
      setText(v)
    } else setText(value)
  }
  return (
    <input
      aria-label={label}
      value={text.toUpperCase()}
      spellCheck={false}
      onChange={(e) => setText(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur()
        if (e.key === 'Escape') {
          setText(value)
          e.currentTarget.blur()
        }
      }}
      className="block w-[68px] rounded border border-transparent bg-transparent font-mono text-[10.5px] text-fg3 outline-none hover:border-line2 focus:border-accent focus:text-fg"
    />
  )
}
