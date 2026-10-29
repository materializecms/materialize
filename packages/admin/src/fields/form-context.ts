import type { ValidationIssue } from '@materializecms/core'
import { createContext, useContext } from 'react'

export interface FormState {
  issues: ValidationIssue[]
  /** Title and public URL of the document, for previews such as the search snippet. */
  docTitle: string
  docUrl: string | null
  siteUrl?: string
}

export const FormContext = createContext<FormState>({ issues: [], docTitle: '', docUrl: null })

export const useForm = () => useContext(FormContext)

export function useIssues(path: string): string[] {
  return useForm()
    .issues.filter((i) => i.path === path)
    .map((i) => i.message)
}
