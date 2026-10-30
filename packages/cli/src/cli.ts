#!/usr/bin/env node
/**
 * The materialize command. `start` runs under a small supervisor that keeps the server alive and
 * applies updates from the panel; it is loaded on its own, before any Materialize package, so an
 * update can replace those packages under it. Everything else lives in commands.ts.
 */
import { fileURLToPath } from 'node:url'

const [command, ...args] = process.argv.slice(2)
if (command === 'start' && !process.env.MATERIALIZE_SUPERVISED && !args.includes('--no-supervisor')) {
  const { supervise } = await import('./supervisor.ts')
  await supervise(fileURLToPath(import.meta.url), args)
} else {
  await import('./commands.ts')
}
