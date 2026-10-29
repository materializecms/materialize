import type { RichText } from '@materializecms/core'
import { EditorContent, useEditor, useEditorState } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { Bold, Heading2, Heading3, Italic, Link2, List, Quote, Unlink } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Button, cx, IconButton, Input, Popover } from '../components/ui.tsx'
import { fromTiptap, toTiptap } from '../lib/richtext.ts'

export function RichTextEditor({
  value,
  onChange,
  invalid,
  compact,
}: {
  value: RichText | undefined
  onChange: (value: RichText) => void
  invalid?: boolean
  compact?: boolean
}) {
  // The last value we emitted: lets us tell our own updates from external ones (undo, restore).
  const emitted = useRef(JSON.stringify(value ?? []))
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3, 4] },
        code: false,
        codeBlock: false,
        strike: false,
        underline: false,
        horizontalRule: false,
        orderedList: false,
        link: { openOnClick: false, autolink: true, defaultProtocol: 'https' },
      }),
    ],
    content: toTiptap(value),
    editorProps: { attributes: { class: cx('mz-prose px-3 py-2.5', compact ? 'min-h-16' : 'min-h-28') } },
    onUpdate: ({ editor }) => {
      const next = fromTiptap(editor.getJSON())
      emitted.current = JSON.stringify(next)
      onChange(next)
    },
  })

  useEffect(() => {
    if (!editor) return
    const incoming = JSON.stringify(value ?? [])
    if (incoming === emitted.current) return
    emitted.current = incoming
    editor.commands.setContent(toTiptap(value), { emitUpdate: false })
  }, [editor, value])

  const state = useEditorState({
    editor,
    selector: ({ editor: e }) =>
      e
        ? {
            bold: e.isActive('bold'),
            italic: e.isActive('italic'),
            link: e.isActive('link'),
            h2: e.isActive('heading', { level: 2 }),
            h3: e.isActive('heading', { level: 3 }),
            quote: e.isActive('blockquote'),
            list: e.isActive('bulletList'),
            href: (e.getAttributes('link').href as string | undefined) ?? '',
          }
        : null,
  })

  if (!editor || !state) return null
  const chain = () => editor.chain().focus()

  return (
    <div
      className={cx(
        'rounded-md border bg-input transition-colors focus-within:border-accent focus-within:ring-3 focus-within:ring-accent/15',
        invalid ? 'border-danger' : 'border-line2 hover:border-fg3/40',
      )}
    >
      <div className="flex items-center gap-0.5 border-b border-line px-1.5 py-1">
        <IconButton label="Grassetto (⌘B)" active={state.bold} onClick={() => chain().toggleBold().run()}>
          <Bold />
        </IconButton>
        <IconButton label="Corsivo (⌘I)" active={state.italic} onClick={() => chain().toggleItalic().run()}>
          <Italic />
        </IconButton>
        <LinkButton
          active={state.link}
          href={state.href}
          onApply={(href) =>
            href
              ? chain().extendMarkRange('link').setLink({ href }).run()
              : chain().extendMarkRange('link').unsetLink().run()
          }
        />
        <span className="mx-1 h-4 w-px bg-line" />
        <IconButton label="Titolo" active={state.h2} onClick={() => chain().toggleHeading({ level: 2 }).run()}>
          <Heading2 />
        </IconButton>
        <IconButton label="Sottotitolo" active={state.h3} onClick={() => chain().toggleHeading({ level: 3 }).run()}>
          <Heading3 />
        </IconButton>
        <IconButton label="Citazione" active={state.quote} onClick={() => chain().toggleBlockquote().run()}>
          <Quote />
        </IconButton>
        <IconButton label="Elenco puntato" active={state.list} onClick={() => chain().toggleBulletList().run()}>
          <List />
        </IconButton>
      </div>
      <EditorContent editor={editor} />
    </div>
  )
}

function LinkButton({ active, href, onApply }: { active: boolean; href: string; onApply: (href: string) => void }) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState('')
  return (
    <Popover
      width={300}
      open={open}
      onOpenChange={(o) => {
        setOpen(o)
        if (o) setDraft(href)
      }}
      trigger={({ toggle, ref }) => (
        <IconButton ref={ref} label="Collegamento (⌘K)" active={active} onClick={toggle}>
          <Link2 />
        </IconButton>
      )}
    >
      {(close) => (
        <form
          className="flex items-center gap-1.5 p-2"
          onSubmit={(e) => {
            e.preventDefault()
            onApply(draft.trim())
            close()
          }}
        >
          <Input autoFocus value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="https://… o /pagina" />
          {active && (
            <IconButton
              label="Rimuovi collegamento"
              onClick={() => {
                onApply('')
                close()
              }}
            >
              <Unlink />
            </IconButton>
          )}
          <Button type="submit" size="sm" variant="primary">
            OK
          </Button>
        </form>
      )}
    </Popover>
  )
}
