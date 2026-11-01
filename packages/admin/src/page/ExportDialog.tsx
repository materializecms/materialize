import type { Breakpoint, renderPage } from '@materializecms/core/page'
import { useState } from 'react'
import { Button, Dialog, Segmented, Switch, toast } from '../components/ui.tsx'
import { captureDevices, DEVICE_LABEL, download, type ExportFormat, fileSlug, pdfOf, pngOf } from './exportPage.ts'

type RenderInput = Parameters<typeof renderPage>
const DEVICES = ['desktop', 'tablet', 'mobile'] as const
const day = new Intl.DateTimeFormat('it', { day: 'numeric', month: 'long', year: 'numeric' })

/**
 * The page as a file to send to whoever has to approve it: as it is now, published or not, on the
 * chosen devices. A PDF with one long page per device, or one PNG per device.
 */
export function ExportDialog({
  open,
  onClose,
  title,
  nodes,
  theme,
  options,
  widths,
}: {
  open: boolean
  onClose: () => void
  title: string
  nodes: RenderInput[0]
  theme: RenderInput[1]
  options: RenderInput[2]
  widths: Record<Breakpoint, number>
}) {
  const [devices, setDevices] = useState<Record<Breakpoint, boolean>>({ desktop: true, tablet: true, mobile: true })
  const [format, setFormat] = useState<ExportFormat>('pdf')
  const [step, setStep] = useState<Breakpoint | null>(null)
  const chosen = DEVICES.filter((d) => devices[d])
  const name = title.trim() || 'Pagina'

  const run = async () => {
    try {
      const shots = await captureDevices(
        nodes,
        theme,
        options,
        chosen.map((device) => ({ device, width: widths[device] })),
        setStep,
      )
      const date = day.format(new Date())
      const slug = fileSlug(name)
      if (format === 'pdf') {
        const pdf = await pdfOf(
          shots,
          name,
          (s) => `${name}  ·  ${DEVICE_LABEL[s.device]}, ${s.width} px  ·  Anteprima del ${date}`,
        )
        download(pdf, `${slug}.pdf`)
      } else {
        for (const s of shots) download(await pngOf(s.canvas), `${slug}-${s.device}.png`)
      }
      toast(format === 'pdf' ? 'PDF pronto' : shots.length === 1 ? 'Immagine pronta' : 'Immagini pronte')
      onClose()
    } catch (error) {
      toast(`Esportazione non riuscita: ${(error as Error).message}`, 'error')
    } finally {
      setStep(null)
    }
  }

  return (
    <Dialog
      open={open}
      onClose={() => !step && onClose()}
      title="Esporta la pagina"
      footer={
        <>
          <Button onClick={onClose} disabled={!!step}>
            Annulla
          </Button>
          <Button variant="primary" loading={!!step} disabled={!chosen.length} onClick={run}>
            {step ? `Preparo ${DEVICE_LABEL[step]}…` : 'Esporta'}
          </Button>
        </>
      }
    >
      <p className="text-[14px] leading-relaxed text-fg2">
        La pagina com’è adesso, anche se non è ancora pubblicata: per mostrarla a chi deve approvarla. Ogni dispositivo
        è un’unica immagine lunga, senza tagli.
      </p>
      <div className="mt-4 space-y-3">
        <div>
          <div className="mb-1.5 text-[13px] font-medium text-fg2">Formato</div>
          <Segmented
            value={format}
            onChange={setFormat}
            options={[
              { value: 'pdf', label: 'PDF', title: 'Un file, una pagina per dispositivo' },
              { value: 'png', label: 'PNG', title: 'Un’immagine per dispositivo' },
            ]}
          />
        </div>
        <div>
          <div className="mb-1.5 text-[13px] font-medium text-fg2">Dispositivi</div>
          <div className="space-y-2">
            {DEVICES.map((d) => (
              <span key={d} className="flex items-center gap-3 text-[14px]">
                <Switch
                  checked={devices[d]}
                  label={DEVICE_LABEL[d]}
                  onChange={(on) => setDevices({ ...devices, [d]: on })}
                />
                {DEVICE_LABEL[d]} <span className="font-mono text-[12px] text-fg3">{widths[d]} px</span>
              </span>
            ))}
          </div>
        </div>
      </div>
    </Dialog>
  )
}
