import { en } from './en/index.ts'
import { translator } from './lang.ts'

/** Texts of this package in the language of whoever reads them (see core/src/lang.ts). */
export const t = translator(en)
