import type { NodeProps, PageNode } from '@materializecms/core/page'
import { Row, Section, Select, Toggle } from './controls.tsx'

const input =
  'h-7 min-w-0 flex-1 rounded-md border border-line2 bg-input px-2 text-[12px] outline-none focus:border-accent'

const KINDS: { value: NonNullable<PageNode['inputKind']>; label: string }[] = [
  { value: 'text', label: 'Testo breve' },
  { value: 'email', label: 'Email' },
  { value: 'tel', label: 'Telefono' },
  { value: 'textarea', label: 'Messaggio lungo' },
  { value: 'select', label: 'Scelta da un elenco' },
  { value: 'checkbox', label: 'Casella da spuntare' },
]

/** A container as a contact form: what it sends, and the message shown once sent. */
export function FormSection({
  node,
  isSec,
  onContent,
}: {
  node: PageNode
  isSec: boolean
  onContent: (patch: Partial<PageNode>, group?: string) => void
}) {
  if (node.type !== 'frame' || isSec) return null
  const f = node.form
  return (
    <Section title="Modulo di contatto">
      <Toggle
        label="Questo contenitore è un modulo"
        checked={!!f}
        onChange={(v) => onContent({ form: v ? { subject: 'Richiesta dal sito' } : null })}
      />
      {f ? (
        <>
          <Row label="Oggetto" hint="L’oggetto dell’email che ricevi">
            <input
              aria-label="Oggetto dell’email"
              value={f.subject ?? ''}
              onChange={(e) => onContent({ form: { ...f, subject: e.target.value } }, `fsub:${node.id}`)}
              className={input}
            />
          </Row>
          <Row label="Dopo l’invio">
            <input
              aria-label="Messaggio dopo l’invio"
              value={f.success ?? ''}
              placeholder="Grazie, abbiamo ricevuto il tuo messaggio."
              onChange={(e) => onContent({ form: { ...f, success: e.target.value } }, `fok:${node.id}`)}
              className={input}
            />
          </Row>
          <p className="text-[11px] leading-relaxed text-fg3">
            Aggiungi dentro i campi (Campo · K) e un pulsante con “Invia il modulo”. I messaggi arrivano in Impostazioni
            → Messaggi e, se l’email è configurata, nella tua casella.
          </p>
        </>
      ) : (
        <p className="text-[11px] leading-relaxed text-fg3">
          Trasforma un contenitore in un modulo di contatto, con campi e pulsante di invio.
        </p>
      )}
    </Section>
  )
}

/** A field of a form: kind, the name its value arrives with, label, hint and whether it is required. */
export function InputSection({
  node,
  onContent,
}: {
  node: PageNode
  onContent: (patch: Partial<NodeProps>, group?: string) => void
}) {
  if (node.type !== 'input') return null
  return (
    <Section title="Campo">
      <Row label="Tipo">
        <Select
          label="Tipo di campo"
          value={node.inputKind ?? 'text'}
          options={KINDS}
          onChange={(v) => onContent({ inputKind: v })}
        />
      </Row>
      <Row label="Etichetta">
        <input
          aria-label="Etichetta del campo"
          value={node.text ?? ''}
          onChange={(e) => onContent({ text: e.target.value }, `ftext:${node.id}`)}
          className={input}
        />
      </Row>
      <Row label="Nome" hint="Il nome con cui arriva il valore nei messaggi">
        <input
          aria-label="Nome del campo"
          value={node.fieldName ?? ''}
          placeholder="es. email"
          onChange={(e) =>
            onContent({ fieldName: e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, '-') }, `fname:${node.id}`)
          }
          className={`${input} font-mono`}
        />
      </Row>
      {node.inputKind !== 'checkbox' && node.inputKind !== 'select' && (
        <Row label="Suggerimento">
          <input
            aria-label="Testo di esempio nel campo"
            value={node.placeholder ?? ''}
            onChange={(e) => onContent({ placeholder: e.target.value }, `fph:${node.id}`)}
            className={input}
          />
        </Row>
      )}
      {node.inputKind === 'select' && (
        <label className="block space-y-1">
          <span className="text-[11.5px] font-medium text-fg2">Scelte, una per riga</span>
          <textarea
            aria-label="Scelte dell’elenco"
            value={(node.options ?? []).join('\n')}
            rows={4}
            onChange={(e) => onContent({ options: e.target.value.split('\n') }, `fopt:${node.id}`)}
            className="w-full rounded-md border border-line2 bg-input px-2 py-1.5 text-[12px] outline-none focus:border-accent"
          />
        </label>
      )}
      <Toggle
        label="Obbligatorio"
        checked={!!node.required}
        onChange={(v) => onContent({ required: v || undefined })}
      />
    </Section>
  )
}
