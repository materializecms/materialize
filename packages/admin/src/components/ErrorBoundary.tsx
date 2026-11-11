import { Component, type ErrorInfo, type ReactNode } from 'react'
import { t } from '../lib/i18n.ts'

/**
 * A part of the panel that fails shows this instead of an empty page: what happened, and the way
 * back. The error itself goes to the browser's console, for whoever reports it.
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Materialize: the panel stopped', error, info.componentStack)
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div className="mz-backdrop flex min-h-full items-center justify-center px-4 py-12">
        <div role="alert" className="mz-card w-full max-w-[440px]">
          <h1 className="text-[18px] font-semibold tracking-tight">{t('Qualcosa nel pannello si è fermato')}</h1>
          <p className="mt-2 text-[14px] leading-relaxed text-fg2">
            {t(
              'Il lavoro salvato è al sicuro. Ricarica la pagina; se succede di nuovo, segnalalo con quello che stavi facendo.',
            )}
          </p>
          <p className="mt-3 rounded-lg bg-panel2 px-3 py-2 font-mono text-[12px] break-words text-fg3">
            {this.state.error.message}
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => location.reload()}
              className="rounded-full bg-accent px-4 py-2 text-[14px] font-medium text-white"
            >
              {t('Ricarica')}
            </button>
            <a href="/admin/" className="rounded-full border border-line2 px-4 py-2 text-[14px] font-medium">
              {t('Torna alla panoramica')}
            </a>
          </div>
        </div>
      </div>
    )
  }
}
