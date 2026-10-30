/**
 * `npm run dev`: Materialize from the sources, on a site of your own. The first time it creates
 * sito-locale/ from the starter template (the same one `npm create materialize` copies); that folder
 * stays on this computer, never in the repository. Its packages come from the workspace.
 */
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { createProject } from '../packages/create-materialize/src/index.ts'

const ROOT = join(import.meta.dirname, '..')
const SITE = join(ROOT, 'sito-locale')

function run(command: string, args: string[], cwd: string): Promise<number> {
  return new Promise((done) => {
    const child = spawn(command, args, { cwd, stdio: 'inherit' })
    child.on('close', (code) => done(code ?? 1))
    process.on('SIGINT', () => child.kill('SIGINT'))
    process.on('SIGTERM', () => child.kill('SIGTERM'))
  })
}

if (!existsSync(join(SITE, 'materialize.config.ts'))) {
  await createProject(SITE, 'Sito locale')
  console.log('  Creato sito-locale/ dal sito di partenza: è tuo, git non lo vede.')
}
if ((await run('npm', ['run', 'build', '-w', '@materializecms/admin'], ROOT)) !== 0) process.exit(1)
process.exit(
  await run(process.execPath, [join(ROOT, 'packages/cli/src/cli.ts'), 'dev', ...process.argv.slice(2)], SITE),
)
