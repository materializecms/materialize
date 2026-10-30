/** Prints the CHANGELOG.md notes of one version: node scripts/notes.ts 0.2.0 */
import { readFileSync } from 'node:fs'
import { parseChangelog } from './changelog.ts'

const version = process.argv[2]?.replace(/^v/, '')
const release = parseChangelog(readFileSync('CHANGELOG.md', 'utf8')).find((r) => r.version === version)
if (!release) {
  console.error(`✗ Il CHANGELOG non ha la ${version}`)
  process.exit(1)
}
console.log(release.notes)
