/**
 * Visitors' comments under articles. The site stays static: the form is in the HTML (it works
 * without JavaScript too), the approved comments come from the server's public API in the browser,
 * so approving one never rebuilds the site.
 */

/** Impostazioni → Commenti. */
export interface DiscussionSettings {
  /** Collections with comments; unset: those with pages and a date (articles, news). */
  collections?: string[]
  /** Every comment waits for approval (default). Off: the ones that pass the spam checks show at once. */
  moderation?: boolean
  /** An email to the site's owner for each new comment (default on). */
  notify?: boolean
}

export const DISCUSSION_LIMITS = { name: 80, email: 200, text: 3000 }

/** The collections with comments: the chosen ones, or by default every collection with pages and a date. */
export function discussionCollections(
  collections: readonly { name: string; singleton: boolean; url?: unknown; fields: Record<string, { kind: string }> }[],
  chosen?: string[],
): string[] {
  const eligible = collections.filter((c) => c.url && !c.singleton)
  if (chosen) return eligible.filter((c) => chosen.includes(c.name)).map((c) => c.name)
  return eligible.filter((c) => Object.values(c.fields).some((f) => f.kind === 'date')).map((c) => c.name)
}

const TEXTS = {
  it: {
    title: 'Commenti',
    one: '1 commento',
    many: '{n} commenti',
    empty: 'Ancora nessun commento: scrivi il primo.',
    write: 'Lascia un commento',
    name: 'Nome',
    email: 'Email',
    emailHint: 'Facoltativa: non sarà pubblicata.',
    text: 'Commento',
    send: 'Invia',
    privacy: 'Nome e commento saranno pubblici. L’email resta privata e serve solo per risponderti.',
    pending: 'Grazie! Il commento comparirà dopo l’approvazione.',
    published: 'Grazie! Il commento è pubblicato.',
    failed: 'Invio non riuscito: controlla i campi e riprova.',
    tooMany: 'Troppi invii ravvicinati: riprova tra un minuto.',
    noScript: 'Per leggere i commenti serve JavaScript.',
  },
  en: {
    title: 'Comments',
    one: '1 comment',
    many: '{n} comments',
    empty: 'No comments yet: be the first.',
    write: 'Leave a comment',
    name: 'Name',
    email: 'Email',
    emailHint: 'Optional: it won’t be published.',
    text: 'Comment',
    send: 'Send',
    privacy: 'Your name and comment will be public. Your email stays private, only to reply to you.',
    pending: 'Thank you! Your comment will show once it’s approved.',
    published: 'Thank you! Your comment is published.',
    failed: 'Not sent: check the fields and try again.',
    tooMany: 'Too many in a row: try again in a minute.',
    noScript: 'Reading the comments needs JavaScript.',
  },
}

export type DiscussionTexts = (typeof TEXTS)['it']

/** The comments' words in the page's language: Italian, or English for every other language. */
export const discussionTexts = (lang = 'it'): DiscussionTexts => TEXTS[lang.startsWith('it') ? 'it' : 'en']

/** A comment as the site's API gives it. */
interface Shown {
  id: string
  name: string
  text: string
  createdAt: string
}

/**
 * In the browser: fills each `[data-mz-comments]` section with its approved comments and sends
 * its form without leaving the page. Returns a cleanup.
 */
export function startComments(root: ParentNode = document): () => void {
  if (typeof window === 'undefined') return () => {}
  const sections = [...root.querySelectorAll<HTMLElement>('[data-mz-comments]')]
  const opened = Date.now()
  const controller = new AbortController()

  for (const section of sections) {
    const path = section.dataset.mzComments ?? location.pathname
    const texts = JSON.parse(section.dataset.mzTexts ?? '{}') as DiscussionTexts
    const lang = document.documentElement.lang || 'it'
    const list = section.querySelector<HTMLElement>('[data-mz-comment-list]')
    const count = section.querySelector<HTMLElement>('[data-mz-comment-count]')
    const form = section.querySelector<HTMLFormElement>('form')
    const message = section.querySelector<HTMLElement>('[data-mz-comment-message]')
    const say = (text: string, failed = false) => {
      if (!message) return
      message.textContent = text
      message.dataset.failed = failed ? 'true' : 'false'
      message.hidden = false
    }

    const render = (items: Shown[]) => {
      // No count beside the title before the first comment: the empty list says it already.
      if (count)
        count.textContent = !items.length
          ? ''
          : items.length === 1
            ? texts.one
            : texts.many.replace('{n}', String(items.length))
      if (!list) return
      list.replaceChildren()
      if (!items.length) {
        const p = document.createElement('p')
        p.className = 'mz-comments-empty'
        p.textContent = texts.empty
        list.append(p)
        return
      }
      const date = new Intl.DateTimeFormat(lang, { day: 'numeric', month: 'long', year: 'numeric' })
      for (const c of items) {
        const item = document.createElement('article')
        item.className = 'mz-comment'
        const head = document.createElement('header')
        const who = document.createElement('strong')
        who.textContent = c.name
        const when = document.createElement('time')
        when.dateTime = c.createdAt
        when.textContent = date.format(new Date(c.createdAt))
        head.append(who, when)
        item.append(head)
        // Text only, paragraph by paragraph: what visitors write never becomes HTML.
        for (const para of c.text.split(/\n{2,}/)) {
          const p = document.createElement('p')
          p.textContent = para
          item.append(p)
        }
        list.append(item)
      }
    }

    let shown: Shown[] = []
    const load = () =>
      fetch(`/api/discussion?path=${encodeURIComponent(path)}`, { signal: controller.signal })
        .then((res) => (res.ok ? res.json() : { comments: [] }))
        .then((body: { comments: Shown[] }) => {
          shown = body.comments ?? []
          render(shown)
        })
        .catch(() => {})
    void load()

    if (location.hash === '#commento-inviato') say(texts.pending)
    if (location.hash === '#commento-pubblicato') say(texts.published)
    if (location.hash === '#commento-non-inviato') say(texts.failed, true)

    form?.addEventListener(
      'submit',
      async (e) => {
        e.preventDefault()
        for (const el of form.querySelectorAll('[aria-invalid]')) el.removeAttribute('aria-invalid')
        const data = Object.fromEntries(new FormData(form)) as Record<string, string>
        const button = form.querySelector<HTMLButtonElement>('button[type="submit"]')
        if (button) button.disabled = true
        try {
          const res = await fetch('/api/discussion', {
            method: 'POST',
            headers: { accept: 'application/json', 'content-type': 'application/json' },
            body: JSON.stringify({ ...data, path, _t: String(Date.now() - opened) }),
          })
          if (res.status === 422) {
            const body = (await res.json().catch(() => null)) as { error?: { issues?: { field: string }[] } } | null
            for (const issue of body?.error?.issues ?? [])
              form.querySelector(`[name="${issue.field}"]`)?.setAttribute('aria-invalid', 'true')
            say(texts.failed, true)
            return
          }
          if (res.status === 429) return say(texts.tooMany, true)
          if (!res.ok) return say(texts.failed, true)
          const body = (await res.json().catch(() => ({}))) as { comment?: Shown }
          form.reset()
          if (body.comment) {
            shown = [...shown, body.comment]
            render(shown)
            say(texts.published)
          } else say(texts.pending)
        } catch {
          say(texts.failed, true)
        } finally {
          if (button) button.disabled = false
        }
      },
      { signal: controller.signal },
    )
  }
  return () => controller.abort()
}
