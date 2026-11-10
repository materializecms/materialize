import { supervisor } from './supervisor.ts'
import { terminal } from './terminal.ts'

/**
 * The English texts of @materializecms/cli, by area. Keys are the Italian texts exactly as written
 * in the code (with their {placeholders}); a test checks that every text passed to t() is here.
 */
export const en: Record<string, string> = { ...terminal, ...supervisor }
