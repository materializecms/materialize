import { type Component, type PageNode, plainText } from '@materializecms/core/page'
import { Component as ComponentIcon, Eye, EyeOff, ImagePlus, Plus, RotateCcw, Unlink } from 'lucide-react'
import { useState } from 'react'
import { t, tn } from '../lib/i18n.ts'
import { Row, Section, Select } from './controls.tsx'

export interface ComponentActions {
  make: (id: string) => void
  setVariant: (id: string, variantId: string) => void
  addVariant: (id: string, name: string) => void
  renameVariant: (cid: string, vid: string, name: string) => void
  rename: (cid: string, name: string) => void
  detach: (id: string) => void
  reset: (id: string) => void
  insert: (cid: string) => void
  setHoverVariant: (id: string, variantId: string | null) => void
  /** Content of an element inside this copy (text, visibility). */
  setChild: (childId: string, patch: Partial<PageNode>) => void
  pickChildImage: (childId: string) => void
  /** Selects an element inside the copy, to change it in the inspector. */
  select: (childId: string) => void
}

/** The elements a copy can change for itself, in order: its "properties". */
function properties(node: PageNode): PageNode[] {
  const out: PageNode[] = []
  const visit = (list: PageNode[]) => {
    for (const c of list) {
      if (['text', 'button', 'image', 'icon'].includes(c.type)) out.push(c)
      if (c.children) visit(c.children)
    }
  }
  visit(node.children ?? [])
  return out
}

const btn =
  'flex h-7 items-center justify-center gap-1.5 rounded-md border border-line2 px-2 text-[12px] font-medium text-fg2 hover:bg-hover hover:text-fg [&_svg]:size-3.5'

/** A copy of a component: its variant, its own content, or a way back to a plain element. */
export function ComponentPanel({
  node,
  components,
  actions,
}: {
  node: PageNode
  components: Record<string, Component>
  actions: ComponentActions
}) {
  const [naming, setNaming] = useState<string | null>(null)
  const def = node.component ? components[node.component] : undefined
  // An element inside a copy: its design belongs to the component.
  const owner = node.id.includes('~') ? node.id.split('~')[0] : null

  if (!def) {
    if (owner)
      return (
        <div className="border-b border-line px-3.5 py-2.5">
          <p className="flex items-start gap-2 rounded-lg bg-[#8b5cf6]/10 px-2.5 py-2 text-[12px] leading-relaxed text-[#8b5cf6]">
            <ComponentIcon className="mt-0.5 size-3.5 shrink-0" />
            {t('Fa parte di un componente: testi, immagini e link valgono solo qui, il design per tutte le copie.')}
          </p>
        </div>
      )
    if (node.type !== 'frame') return null
    return (
      <div className="border-b border-line px-3.5 py-2.5">
        <button type="button" className={`${btn} w-full`} onClick={() => actions.make(node.id)}>
          <ComponentIcon /> {t('Crea componente riutilizzabile')}
        </button>
      </div>
    )
  }

  const variant = def.variants.find((v) => v.id === node.componentVariant) ?? def.variants[0]
  const own = Object.keys(node.overrides ?? {}).length
  return (
    <Section title={t('Componente')}>
      <input
        aria-label={t('Nome del componente')}
        value={def.name}
        onChange={(e) => actions.rename(def.id, e.target.value)}
        className="h-7 w-full rounded-md border border-line2 bg-input px-2 text-[13px] font-medium outline-none focus:border-accent"
      />
      <Row label={t('Variante')}>
        <Select
          label={t('Variante')}
          value={variant?.id ?? ''}
          options={def.variants.map((v) => ({ value: v.id, label: v.name }))}
          onChange={(v) => actions.setVariant(node.id, v)}
        />
      </Row>
      {variant && (
        <Row label={t('Nome variante')}>
          <input
            aria-label={t('Nome della variante')}
            value={variant.name}
            onChange={(e) => actions.renameVariant(def.id, variant.id, e.target.value)}
            className="h-7 min-w-0 flex-1 rounded-md border border-line2 bg-input px-2 text-[12.5px] outline-none focus:border-accent"
          />
        </Row>
      )}
      {naming === null ? (
        <button
          type="button"
          className={`${btn} w-full`}
          onClick={() => setNaming(t('Variante {n}', { n: def.variants.length + 1 }))}
        >
          <Plus /> {t('Aggiungi variante')}
        </button>
      ) : (
        <form
          className="flex gap-1.5"
          onSubmit={(e) => {
            e.preventDefault()
            if (naming.trim()) actions.addVariant(node.id, naming.trim())
            setNaming(null)
          }}
        >
          <input
            autoFocus
            aria-label={t('Nome della nuova variante')}
            value={naming}
            onChange={(e) => setNaming(e.target.value)}
            onKeyDown={(e) => e.key === 'Escape' && setNaming(null)}
            className="h-7 min-w-0 flex-1 rounded-md border border-accent bg-input px-2 text-[12.5px] outline-none"
          />
          <button type="submit" className={btn}>
            {t('Crea')}
          </button>
        </form>
      )}
      {def.variants.length > 1 && (
        <Row label={t('Al passaggio')} hint={t('La copia prende i colori di un’altra variante sotto il puntatore')}>
          <Select
            label={t('Variante al passaggio del mouse')}
            value={node.hoverVariant ?? ''}
            options={[
              { value: '', label: t('Nessuna') },
              ...def.variants.filter((v) => v.id !== variant?.id).map((v) => ({ value: v.id, label: v.name })),
            ]}
            onChange={(v) => actions.setHoverVariant(node.id, v || null)}
          />
        </Row>
      )}
      <div className="space-y-1.5 rounded-lg border border-line p-2">
        <div className="text-[11.5px] font-medium text-fg2">{t('Proprietà di questa copia')}</div>
        {properties(node).map((c) => (
          <div key={c.id} className="flex items-center gap-1.5">
            <button
              type="button"
              title={c.hidden ? t('Mostra in questa copia') : t('Nascondi in questa copia')}
              aria-label={
                c.hidden ? t('Mostra {name}', { name: c.name ?? '' }) : t('Nascondi {name}', { name: c.name ?? '' })
              }
              onClick={() => actions.setChild(c.id, { hidden: !c.hidden })}
              className="flex size-6 shrink-0 items-center justify-center rounded text-fg3 hover:bg-hover hover:text-fg [&_svg]:size-3.5"
            >
              {c.hidden ? <EyeOff /> : <Eye />}
            </button>
            {c.type === 'text' || c.type === 'button' ? (
              <input
                aria-label={c.name || t('Testo')}
                title={c.name}
                value={c.type === 'text' ? plainText(c) : (c.text ?? '')}
                onChange={(e) => actions.setChild(c.id, { text: e.target.value, runs: null })}
                className="h-7 min-w-0 flex-1 rounded-md border border-line2 bg-input px-2 text-[12.5px] outline-none focus:border-accent"
              />
            ) : (
              <button
                type="button"
                onClick={() => (c.type === 'image' ? actions.pickChildImage(c.id) : actions.select(c.id))}
                className="flex h-7 min-w-0 flex-1 items-center gap-1.5 rounded-md border border-line2 px-2 text-left text-[12.5px] text-fg2 hover:text-fg [&_svg]:size-3.5"
              >
                <ImagePlus className="shrink-0" />
                <span className="truncate">{c.name || (c.type === 'image' ? t('Immagine') : t('Icona'))}</span>
              </button>
            )}
          </div>
        ))}
      </div>
      <p className="text-[11.5px] leading-relaxed text-fg3">
        {own
          ? t(
              'Il design vale per tutte le copie di questa variante; testi, immagini e link restano di questa copia ({changed}).',
              {
                changed: tn(own, '1 elemento modificato', '{n} elementi modificati'),
              },
            )
          : t('Il design vale per tutte le copie di questa variante; testi, immagini e link restano di questa copia.')}
      </p>
      <div className="grid grid-cols-2 gap-1.5">
        <button type="button" className={btn} disabled={!own} onClick={() => actions.reset(node.id)}>
          <RotateCcw /> {t('Contenuti originali')}
        </button>
        <button type="button" className={btn} onClick={() => actions.detach(node.id)}>
          <Unlink /> {t('Scollega')}
        </button>
      </div>
    </Section>
  )
}
