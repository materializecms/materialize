import { app } from './app.ts'

/**
 * The panel in English, by area. Keys are the Italian texts exactly as written in the code
 * (with their {placeholders}); a test checks that every text passed to t() is here.
 */
export const en: Record<string, string> = { ...app }
