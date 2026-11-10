import { join } from 'node:path'
import { describe } from 'vitest'
import { langChecks } from '../../core/test/lang-texts.ts'
import { en } from '../src/en/index.ts'

describe('cli in English', () => langChecks(join(import.meta.dirname, '../src'), en))
