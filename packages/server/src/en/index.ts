import { api } from './api.ts'
import { services } from './services.ts'

/**
 * The English texts of @materializecms/server, by area. Keys are the Italian texts exactly as written
 * in the code (with their {placeholders}); a test checks that every text passed to t() is here.
 */
export const en: Record<string, string> = { ...api, ...services }
