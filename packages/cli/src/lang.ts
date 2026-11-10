import { setLangSource } from '@materializecms/core/lang'
import { systemLang } from './system-lang.ts'

export { systemLang } from './system-lang.ts'

/**
 * Everything printed by the terminal follows the system's language (system-lang.ts). The server's
 * answers to the panel follow each person instead (server/src/lang.ts).
 */
const lang = systemLang()
setLangSource(() => lang)
