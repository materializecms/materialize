/**
 * Prints the notes of one version for its GitHub release: English, then Italian folded below.
 *   node scripts/notes.ts 0.2.0
 */
import { readFileSync } from 'node:fs'
import { CHANGELOGS, parseChangelog } from './changelog.ts'

const version = process.argv[2]?.replace(/^v/, '')
const [en, it] = CHANGELOGS.map((c) => parseChangelog(readFileSync(c.file, 'utf8')).find((r) => r.version === version))
if (!en || !it) {
  console.error(`✗ ${en ? 'CHANGELOG.it.md' : 'CHANGELOG.md'} non ha la ${version}`)
  process.exit(1)
}
console.log(`${en.notes}\n\n<details>\n<summary>Italiano</summary>\n\n${it.notes}\n\n</details>`)
