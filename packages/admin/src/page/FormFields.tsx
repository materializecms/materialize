import type { FileAccept, NodeProps, PageNode } from '@materializecms/core/page'
import { useSession } from '../app/context.ts'
import { Row, Section, Select, Toggle } from './controls.tsx'

const input =
  'h-7 min-w-0 flex-1 rounded-md border border-line2 bg-input px-2 text-[12.5px] outline-none focus:border-accent'
const area = 'w-full rounded-md border border-line2 bg-input px-2 py-1.5 text-[12.5px] outline-none focus:border-accent'

const KINDS: { value: NonNullable<PageNode['inputKind']>; label: string }[] = [
  { value: 'text', label: 'Testo breve' },
  { value: 'email', label: 'Email' },
  { value: 'tel', label: 'Telefono' },
  { value: 'textarea', label: 'Messaggio lungo' },
  { value: 'select', label: 'Scelta da un elenco' },
  { value: 'checkbox', label: 'Casella da spuntare' },
  { value: 'file', label: 'File allegato' },
]

const ACCEPT: { value: FileAccept; label: string }[] = [
  { value: 'any', label: 'Documenti e immagini' },
  { value: 'documents', label: 'Solo documenti' },
  { value: 'images', label: 'Solo immagini' },
]

/**
 * A container as a contact form: its name, the email that arrives and who gets it, the message
 * once sent, an automatic answer and a webhook. Where messages go is for administrators only.
 */
export function FormSection({
  node,
  isSec,
  onContent,
}: {
  node: PageNode
  isSec: boolean
  onContent: (patch: Partial<PageNode>, group?: string) => void
}) {
  const { user } = useSession()
  if (node.type !== 'frame' || isSec) return null
  const f = node.form
  const admin = user.role === 'admin'
  const set = (patch: Partial<NonNullable<PageNode['form']>>, group: string) =>
    onContent({ form: { ...f, ...patch } }, `${group}:${node.id}`)
  return (
    <Section title="Modulo di contatto">
      <Toggle
        label="Questo contenitore è un modulo"
        checked={!!f}
        onChange={(v) => onContent({ form: v ? { name: 'Contatti', subject: 'Richiesta dal sito' } : null })}
      />
      {f ? (
        <>
          <Toggle
            label="Iscrive alla newsletter"
            checked={!!f.newsletter}
            onChange={(v) => set({ newsletter: v || undefined }, 'fnews')}
          />
          {f.newsletter && (
            <p className="text-[11.5px] leading-relaxed text-fg3">
              Serve un campo Email. Chi invia riceve un link per confermare e diventa iscritto (Newsletter → Iscritti);
              niente arriva in Messaggi. Aggiungi una casella per il consenso alla privacy.
            </p>
          )}
          <Row label="Nome" hint="Come lo riconosci in Impostazioni → Messaggi">
            <input
              aria-label="Nome del modulo"
              value={f.name ?? ''}
              placeholder="Contatti"
              onChange={(e) => set({ name: e.target.value }, 'fname')}
              className={input}
            />
          </Row>
          {!f.newsletter && (
            <>
              <Row label="Oggetto" hint="L’oggetto dell’email che ricevi">
                <input
                  aria-label="Oggetto dell’email"
                  value={f.subject ?? ''}
                  onChange={(e) => set({ subject: e.target.value }, 'fsub')}
                  className={input}
                />
              </Row>
              <Row label="Invia a" hint="Indirizzi separati da virgole; vuoto, quello di Impostazioni → Email">
                <input
                  aria-label="Chi riceve i messaggi"
                  value={f.to ?? ''}
                  placeholder="Impostazioni → Email"
                  disabled={!admin}
                  title={admin ? undefined : 'Solo un amministratore può cambiarlo'}
                  onChange={(e) => set({ to: e.target.value }, 'fto')}
                  className={`${input} disabled:opacity-60`}
                />
              </Row>
            </>
          )}
          <Row label="Dopo l’invio">
            <input
              aria-label="Messaggio dopo l’invio"
              value={f.success ?? ''}
              placeholder="Grazie, abbiamo ricevuto il tuo messaggio."
              onChange={(e) => set({ success: e.target.value }, 'fok')}
              className={input}
            />
          </Row>
          {!f.newsletter && (
            <>
              <Toggle
                label="Risposta automatica a chi scrive"
                checked={!!f.autoReply}
                onChange={(v) =>
                  set(
                    {
                      autoReply: v
                        ? {
                            subject: 'Abbiamo ricevuto il tuo messaggio',
                            text: 'Grazie per averci scritto: ti rispondiamo il prima possibile.',
                          }
                        : null,
                    },
                    'fauto',
                  )
                }
              />
              {f.autoReply && (
                <div className="space-y-1.5">
                  <input
                    aria-label="Oggetto della risposta automatica"
                    value={f.autoReply.subject ?? ''}
                    onChange={(e) => set({ autoReply: { ...f.autoReply, subject: e.target.value } }, 'fautos')}
                    className={`${input} w-full`}
                  />
                  <textarea
                    aria-label="Testo della risposta automatica"
                    value={f.autoReply.text ?? ''}
                    rows={4}
                    onChange={(e) => set({ autoReply: { ...f.autoReply, text: e.target.value } }, 'fautot')}
                    className={area}
                  />
                  <p className="text-[11.5px] leading-relaxed text-fg3">
                    Arriva all’email scritta nel modulo, con le tue parole soltanto: non ripete ciò che è stato inviato.
                  </p>
                </div>
              )}
              <Row label="Webhook" hint="Ogni messaggio arriva anche qui, in JSON: Zapier, Make, n8n…">
                <input
                  aria-label="Indirizzo del webhook"
                  value={f.webhook ?? ''}
                  placeholder="https://hooks.zapier.com/…"
                  disabled={!admin}
                  title={admin ? undefined : 'Solo un amministratore può cambiarlo'}
                  onChange={(e) => set({ webhook: e.target.value.trim() }, 'fhook')}
                  className={`${input} font-mono disabled:opacity-60`}
                />
              </Row>
              <p className="text-[11.5px] leading-relaxed text-fg3">
                Aggiungi dentro i campi (Campo · K) e un pulsante con “Invia il modulo”. I messaggi arrivano in
                Impostazioni → Messaggi e, se l’email è configurata, nella tua casella. Lo spam si ferma da solo, senza
                CAPTCHA.
              </p>
            </>
          )}
        </>
      ) : (
        <p className="text-[11.5px] leading-relaxed text-fg3">
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
  const kind = node.inputKind ?? 'text'
  return (
    <Section title="Campo">
      <Row label="Tipo">
        <Select label="Tipo di campo" value={kind} options={KINDS} onChange={(v) => onContent({ inputKind: v })} />
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
      {kind !== 'checkbox' && kind !== 'select' && kind !== 'file' && (
        <Row label="Suggerimento">
          <input
            aria-label="Testo di esempio nel campo"
            value={node.placeholder ?? ''}
            onChange={(e) => onContent({ placeholder: e.target.value }, `fph:${node.id}`)}
            className={input}
          />
        </Row>
      )}
      {kind === 'select' && (
        <label className="block space-y-1">
          <span className="text-[12px] font-medium text-fg2">Scelte, una per riga</span>
          <textarea
            aria-label="Scelte dell’elenco"
            value={(node.options ?? []).join('\n')}
            rows={4}
            onChange={(e) => onContent({ options: e.target.value.split('\n') }, `fopt:${node.id}`)}
            className={area}
          />
        </label>
      )}
      {kind === 'file' && (
        <>
          <Row label="Accetta">
            <Select
              label="File accettati"
              value={node.accept ?? 'any'}
              options={ACCEPT}
              onChange={(v) => onContent({ accept: v })}
            />
          </Row>
          <p className="text-[11.5px] leading-relaxed text-fg3">
            Fino a 10 MB. Il file resta privato: lo scarichi da Impostazioni → Messaggi.
          </p>
        </>
      )}
      {kind === 'checkbox' && (
        <Row label="Link" hint="Per il consenso privacy: l’etichetta apre questa pagina">
          <input
            aria-label="Pagina aperta dall’etichetta"
            value={node.href ?? ''}
            placeholder="/privacy"
            onChange={(e) => onContent({ href: e.target.value || undefined }, `fhref:${node.id}`)}
            className={`${input} font-mono`}
          />
        </Row>
      )}
      <Toggle
        label="Obbligatorio"
        checked={!!node.required}
        onChange={(v) => onContent({ required: v || undefined })}
      />
    </Section>
  )
}
