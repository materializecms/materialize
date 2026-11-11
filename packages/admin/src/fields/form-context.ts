import type { ValidationIssue } from '@materializecms/core'
import { createContext, useContext } from 'react'

export interface FormState {
  issues: ValidationIssue[]
  /** Title and public URL of the document, for previews such as the search snippet. */
  docTitle: string
  docUrl: string | null
  siteUrl?: string
  /** What comes before the slug in the document's address (`/articoli/`). */
  urlPrefix?: string
  /** The document's words, for AI that writes from them (an SEO description). */
  docText?: () => string
}

export const FormContext = createContext<FormState>({ issues: [], docTitle: '', docUrl: null })

export const useForm = () => useContext(FormContext)

export function useIssues(path: string): string[] {
  return useForm()
    .issues.filter((i) => i.path === path)
    .map((i) => i.message)
}
