import { join } from 'node:path'
import { describe } from 'vitest'
import { en } from '../src/en/index.ts'
import { langChecks } from './lang-texts.ts'

describe('core in English', () => langChecks(join(import.meta.dirname, '../src'), en))
