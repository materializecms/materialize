import { app } from './app.ts'
import { editorBlocks } from './editor-blocks.ts'
import { editorCanvas } from './editor-canvas.ts'
import { editorInspector } from './editor-inspector.ts'
import { editorMain } from './editor-main.ts'
import { editorMotion } from './editor-motion.ts'
import { editorPanels } from './editor-panels.ts'

/**
 * The panel in English, by area. Keys are the Italian texts exactly as written in the code
 * (with their {placeholders}); a test checks that every text passed to t() is here, and that
 * a text shared by two areas has one translation.
 */
export const en: Record<string, string> = {
  ...app,
  ...editorMain,
  ...editorCanvas,
  ...editorInspector,
  ...editorMotion,
  ...editorPanels,
  ...editorBlocks,
}
