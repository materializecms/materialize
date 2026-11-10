/**
 * The English texts of @materializecms/core, by area. Keys are the Italian texts exactly as written
 * in the code (with their {placeholders}); a test checks that every text passed to t() is here.
 */
import { checks } from './checks.ts'
import { library } from './library.ts'

export const en: Record<string, string> = { ...library, ...checks }
