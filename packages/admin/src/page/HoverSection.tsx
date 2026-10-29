import type { HoverStyle, NodeProps, PageNode } from '@materializecms/core/page'
import { ColorField, NumField, Row, Section, Seg } from './controls.tsx'

/** The element's look under the pointer: colors, scale, lift, opacity and shadow. */
export function HoverSection({
  node,
  palette,
  isSec,
  onProps,
}: {
  node: PageNode
  palette: Record<string, string>
  isSec: boolean
  onProps: (patch: Partial<NodeProps>, group?: string) => void
}) {
  if (isSec) return null
  const h = node.hoverStyle
  const set = (patch: Partial<HoverStyle>, group?: string) => onProps({ hoverStyle: { ...h, ...patch } }, group)
  const hasText = node.type === 'text' || node.type === 'button' || node.type === 'icon'

  return (
    <Section title="Al passaggio del mouse">
      {!h ? (
        <>
          <p className="text-[11px] leading-relaxed text-fg3">
            Come cambia quando il puntatore ci passa sopra: colori, dimensione, ombra. Può reagire anche alla scheda che
            lo contiene, per esempio il titolo che cambia colore quando passi sulla scheda.
          </p>
          <button
            type="button"
            onClick={() =>
              onProps({
                hoverStyle: {
                  on: 'self',
                  ...(node.type === 'button' ? { scale: 1.04 } : node.type === 'frame' ? { y: -4, shadow: 'lg' } : {}),
                },
              })
            }
            className="h-7 w-full rounded-md border border-line2 text-[12px] font-medium text-fg2 hover:bg-hover hover:text-fg"
          >
            Aggiungi uno stato al passaggio
          </button>
        </>
      ) : (
        <>
          <Row label="Quando">
            <Seg
              value={h.on ?? 'self'}
              onChange={(on) => set({ on })}
              options={[
                { value: 'self', label: 'Su di lui', title: 'Il puntatore è sull’elemento' },
                { value: 'card', label: 'Sulla scheda', title: 'Il puntatore è sul contenitore che lo racchiude' },
              ]}
            />
          </Row>
          <Row label="Sfondo">
            <ColorField value={h.bg ?? null} palette={palette} none="Invariato" onChange={(bg) => set({ bg })} />
          </Row>
          {hasText && (
            <Row label="Colore">
              <ColorField
                value={h.color ?? null}
                palette={palette}
                none="Invariato"
                onChange={(color) => set({ color })}
              />
            </Row>
          )}
          <Row label="Bordo">
            <ColorField
              value={h.borderColor ?? null}
              palette={palette}
              none="Invariato"
              onChange={(borderColor) => set({ borderColor })}
            />
          </Row>
          <Row label="Scala" hint="1 = come prima, 1.05 = un po’ più grande">
            <NumField
              value={h.scale ?? 1}
              min={0.5}
              max={1.5}
              step={0.01}
              unit="×"
              onChange={(scale) => set({ scale }, `hs:${node.id}`)}
            />
          </Row>
          <Row label="Sposta" hint="In px: negativo verso l’alto">
            <NumField value={h.y ?? 0} min={-60} max={60} unit="px" onChange={(y) => set({ y }, `hy:${node.id}`)} />
          </Row>
          <Row label="Opacità">
            <NumField
              value={Math.round((h.opa ?? 1) * 100)}
              min={0}
              max={100}
              unit="%"
              onChange={(v) => set({ opa: v == null ? null : v / 100 }, `ho:${node.id}`)}
            />
          </Row>
          <Row label="Ombra">
            <Seg
              value={h.shadow ?? 'none'}
              onChange={(shadow) => set({ shadow })}
              options={[
                { value: 'none', label: 'Nessuna' },
                { value: 'sm', label: 'Leggera' },
                { value: 'lg', label: 'Forte' },
              ]}
            />
          </Row>
          <button
            type="button"
            onClick={() => onProps({ hoverStyle: null })}
            className="text-left text-[11.5px] text-fg2 hover:text-danger"
          >
            Togli lo stato al passaggio
          </button>
          <p className="text-[11px] leading-relaxed text-fg3">Si vede nell’anteprima e sul sito, con il mouse.</p>
        </>
      )}
    </Section>
  )
}
