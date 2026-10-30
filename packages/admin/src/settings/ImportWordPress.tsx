import { useQueryClient } from '@tanstack/react-query'
import { CircleAlert, CircleCheck, FileUp, Globe, Import } from 'lucide-react'
import { type FormEvent, useEffect, useRef, useState } from 'react'
import { useSession } from '../app/context.ts'
import { Button, cx, Input, Segmented, Switch, toast } from '../components/ui.tsx'
import { api, type WpAnalysis, type WpPlan, type WpProgress, type WpSource, type WpTarget } from '../lib/api.ts'
import { navigate } from '../lib/router.ts'

const SOURCES: Record<WpSource, string> = {
  title: 'Titolo',
  slug: 'Indirizzo (slug)',
  content: 'Contenuto',
  excerpt: 'Riassunto',
  date: 'Data',
  featured: 'Immagine in evidenza',
  categories: 'Categorie',
  tags: 'Tag',
  author: 'Autore',
  seo: 'Titolo e descrizione SEO',
}

/**
 * Impostazioni → Importa: a WordPress site into Materialize. Read it (address or export file),
 * choose where posts and pages go and which field takes what, then follow the import.
 */
export function ImportWordPress() {
  const { user } = useSession()
  const [analysis, setAnalysis] = useState<WpAnalysis | null>(null)
  const [job, setJob] = useState<string | null>(null)
  if (user.role !== 'admin')
    return <p className="mx-auto max-w-2xl px-5 py-8 text-[13px] text-fg2">L’importazione la fa un amministratore.</p>
  return (
    <div className="mx-auto max-w-3xl space-y-8 px-5 py-8">
      <header className="space-y-1.5">
        <h2 className="flex items-center gap-2 text-[16px] font-semibold [&_svg]:size-4 [&_svg]:text-fg3">
          <Import /> Importa da WordPress
        </h2>
        <p className="text-[13px] leading-relaxed text-fg2">
          Articoli, pagine, immagini, categorie e SEO di un sito WordPress, qualunque editor lo abbia costruito
          (Gutenberg, Elementor, WPBakery, Divi…). I vecchi indirizzi portano ai nuovi, così i motori di ricerca non
          perdono nulla. Le pagine arrivano con i loro contenuti in ordine: l’impaginazione si rifà poi sul canvas.
        </p>
      </header>
      {job ? (
        <Progress
          id={job}
          onAgain={() => {
            setJob(null)
            setAnalysis(null)
          }}
        />
      ) : analysis ? (
        <Plan analysis={analysis} onBack={() => setAnalysis(null)} onStarted={setJob} />
      ) : (
        <Connect onRead={setAnalysis} />
      )}
    </div>
  )
}

function Connect({ onRead }: { onRead: (a: WpAnalysis) => void }) {
  const [mode, setMode] = useState<'url' | 'file'>('url')
  const [url, setUrl] = useState('')
  const [user, setUser] = useState('')
  const [password, setPassword] = useState('')
  const [limit, setLimit] = useState('all')
  const [file, setFile] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const address = /^https?:\/\//i.test(url.trim()) ? url.trim() : `https://${url.trim()}`
      onRead(
        await api.readWordPress(
          mode === 'file' && file
            ? file
            : {
                url: address,
                user: user.trim() || undefined,
                password: password.trim() || undefined,
                limit: limit === 'all' ? undefined : Number(limit),
              },
        ),
      )
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const label = 'mb-1.5 block text-[12px] font-medium text-fg2'
  return (
    <form onSubmit={submit} className="space-y-4 rounded-lg border border-line bg-panel p-5">
      <Segmented
        value={mode}
        onChange={setMode}
        options={[
          { value: 'url', label: 'Dall’indirizzo del sito' },
          { value: 'file', label: 'Dal file di esportazione' },
        ]}
      />
      {mode === 'url' ? (
        <>
          <label className="block">
            <span className={label}>Indirizzo del sito WordPress</span>
            <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://www.esempio.it" required />
          </label>
          <details className="rounded-md border border-line px-3 py-2 text-[12.5px]">
            <summary className="cursor-pointer font-medium text-fg2">Anche bozze e pagine private</summary>
            <p className="mt-2 leading-relaxed text-fg3">
              In WordPress, Utenti → Profilo → Password per le applicazioni: crea una password per «Materialize» e
              scrivila qui con il tuo nome utente. Serve solo per leggere, non viene salvata.
            </p>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <Input
                value={user}
                onChange={(e) => setUser(e.target.value)}
                placeholder="Nome utente"
                autoComplete="off"
              />
              <Input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="xxxx xxxx xxxx xxxx"
                type="password"
                autoComplete="off"
              />
            </div>
          </details>
          <label className="flex items-center gap-2 text-[12.5px] text-fg2">
            Leggi
            <select
              value={limit}
              onChange={(e) => setLimit(e.target.value)}
              className="h-7 rounded-md border border-line2 bg-input px-1.5 text-[12.5px] text-fg outline-none"
            >
              <option value="all">tutto il sito</option>
              <option value="10">i primi 10 articoli e 10 pagine, per provare</option>
              <option value="50">i primi 50 articoli e 50 pagine</option>
            </select>
          </label>
        </>
      ) : (
        <label className="block">
          <span className={label}>File .xml</span>
          <input
            type="file"
            accept=".xml,text/xml,application/xml"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            required
            className="block w-full text-[12.5px] text-fg2 file:mr-3 file:rounded-md file:border file:border-line2 file:bg-panel file:px-2.5 file:py-1 file:text-[12px] file:font-medium file:text-fg"
          />
          <span className="mt-1.5 block text-[12px] leading-relaxed text-fg3">
            In WordPress: Strumenti → Esporta → Tutti i contenuti. Serve quando il sito non è raggiungibile o la sua API
            è chiusa. Le pagine fatte con un page builder arrivano con i testi, senza i suoi codici.
          </span>
        </label>
      )}
      {error && (
        <p className="flex items-start gap-1.5 text-[13px] text-danger">
          <CircleAlert className="mt-0.5 size-4 shrink-0" /> {error}
        </p>
      )}
      <div className="flex justify-end">
        <Button
          type="submit"
          variant="primary"
          loading={busy}
          icon={mode === 'url' ? <Globe className="size-4" /> : <FileUp className="size-4" />}
        >
          {busy ? 'Leggo il sito…' : 'Leggi il sito'}
        </Button>
      </div>
    </form>
  )
}

function Plan({
  analysis,
  onBack,
  onStarted,
}: {
  analysis: WpAnalysis
  onBack: () => void
  onStarted: (job: string) => void
}) {
  const { schema, locale } = useSession()
  const [posts, setPosts] = useState<WpTarget | null>(analysis.counts.posts ? analysis.suggestions.posts : null)
  const [pages, setPages] = useState<WpTarget | null>(analysis.counts.pages ? analysis.suggestions.pages : null)
  const [publish, setPublish] = useState(true)
  const [redirects, setRedirects] = useState(true)
  const [categories, setCategories] = useState<Record<string, string>>({})
  const [fallback, setFallback] = useState('')
  const [busy, setBusy] = useState(false)

  // A choice field that takes the categories: each WordPress category gets one of its options.
  const choice = (() => {
    for (const t of [posts, pages]) {
      if (!t) continue
      for (const [field, source] of Object.entries(t.fields)) {
        const f = analysis.fields[t.collection]?.[field]
        if (source === 'categories' && f?.options) return { field, label: f.label, options: f.options }
      }
    }
    return null
  })()
  const fold = (s: string) => s.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase()
  const autoMatch = (name: string) =>
    choice?.options.find((o) => fold(o.value) === fold(name) || fold(o.label) === fold(name))?.value ?? ''

  const start = async () => {
    setBusy(true)
    try {
      const plan: WpPlan = {
        posts,
        pages,
        publish,
        redirects,
        locale,
        categories: Object.fromEntries(
          analysis.categories.map((c) => [c, categories[c] ?? autoMatch(c)]).filter(([, v]) => v),
        ),
        fallbackCategory: fallback || undefined,
      }
      onStarted((await api.importWordPress(analysis.token, plan)).job)
    } catch (error) {
      toast((error as Error).message, 'error')
      setBusy(false)
    }
  }

  const collections = schema.collections.filter((c) => !c.singleton && analysis.fields[c.name])
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3 rounded-lg border border-line bg-panel px-4 py-3">
        <CircleCheck className="size-4.5 shrink-0 text-ok" />
        <div className="min-w-0 flex-1">
          <div className="truncate text-[13px] font-medium">{analysis.site.name}</div>
          <div className="text-[12px] text-fg3">
            {analysis.counts.posts} articoli · {analysis.counts.pages} pagine
            {analysis.counts.drafts ? ` · ${analysis.counts.drafts} non pubblicati` : ''} ·{' '}
            <span className="font-mono">{analysis.site.url}</span>
          </div>
        </div>
        <Button size="sm" onClick={onBack}>
          Cambia sito
        </Button>
      </div>

      {(['posts', 'pages'] as const).map((kind) =>
        analysis.counts[kind] ? (
          <TargetCard
            key={kind}
            title={kind === 'posts' ? `Articoli (${analysis.counts.posts})` : `Pagine (${analysis.counts.pages})`}
            samples={analysis.samples[kind]}
            target={kind === 'posts' ? posts : pages}
            suggested={analysis.suggestions[kind]}
            collections={collections.map((c) => ({ name: c.name, label: c.label }))}
            fields={analysis.fields}
            onChange={kind === 'posts' ? setPosts : setPages}
          />
        ) : null,
      )}

      {choice && analysis.categories.length > 0 && (
        <section className="space-y-2 rounded-lg border border-line bg-panel p-4">
          <h3 className="text-[13px] font-medium">Categorie → {choice.label}</h3>
          <div className="grid grid-cols-[1fr_1fr] gap-x-4 gap-y-1.5 text-[12.5px]">
            {analysis.categories.map((c) => (
              <div key={c} className="contents">
                <span className="truncate self-center text-fg2">{c}</span>
                <select
                  value={categories[c] ?? autoMatch(c)}
                  onChange={(e) => setCategories({ ...categories, [c]: e.target.value })}
                  className="h-7 rounded-md border border-line2 bg-input px-1.5 text-fg outline-none"
                >
                  <option value="">— la prima che corrisponde, o quella sotto</option>
                  {choice.options.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
          <label className="flex items-center gap-2 pt-1 text-[12.5px] text-fg2">
            Per gli articoli senza una categoria corrispondente:
            <select
              value={fallback}
              onChange={(e) => setFallback(e.target.value)}
              className="h-7 rounded-md border border-line2 bg-input px-1.5 text-fg outline-none"
            >
              <option value="">{choice.options[0]?.label} (la prima)</option>
              {choice.options.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
        </section>
      )}

      <section className="space-y-3 rounded-lg border border-line bg-panel p-4">
        <label className="flex items-start gap-3">
          <Switch checked={publish} label="Pubblica" onChange={setPublish} />
          <span className="text-[12.5px] leading-relaxed">
            <span className="block font-medium">Pubblica quello che è pubblicato su WordPress</span>
            <span className="text-fg3">Il resto arriva come bozza. Anche ciò che ha campi da completare.</span>
          </span>
        </label>
        <label className="flex items-start gap-3">
          <Switch checked={redirects} label="Reindirizza" onChange={setRedirects} />
          <span className="text-[12.5px] leading-relaxed">
            <span className="block font-medium">I vecchi indirizzi portano ai nuovi</span>
            <span className="text-fg3">
              Un reindirizzamento permanente (301) per ogni contenuto pubblicato che cambia indirizzo: Impostazioni →
              SEO.
            </span>
          </span>
        </label>
      </section>

      <div className="flex justify-end gap-2">
        <Button onClick={onBack}>Indietro</Button>
        <Button variant="primary" loading={busy} disabled={!posts && !pages} onClick={() => void start()}>
          Importa
        </Button>
      </div>
    </div>
  )
}

function TargetCard({
  title,
  samples,
  target,
  suggested,
  collections,
  fields,
  onChange,
}: {
  title: string
  samples: string[]
  target: WpTarget | null
  suggested: WpTarget | null
  collections: { name: string; label: string }[]
  fields: WpAnalysis['fields']
  onChange: (t: WpTarget | null) => void
}) {
  const select = 'h-7 rounded-md border border-line2 bg-input px-1.5 text-[12.5px] text-fg outline-none'
  const pick = (name: string) =>
    onChange(
      !name
        ? null
        : suggested?.collection === name
          ? suggested
          : {
              collection: name,
              // A first guess by kind: the title, the address, the content…
              fields: Object.fromEntries(
                Object.entries(fields[name] ?? {})
                  .filter(([, f]) => f.sources.length === 1)
                  .map(([field, f]) => [field, f.sources[0] as WpSource]),
              ),
            },
    )
  const own = target ? (fields[target.collection] ?? {}) : {}
  return (
    <section className="space-y-3 rounded-lg border border-line bg-panel p-4">
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="text-[13px] font-medium">{title}</h3>
          <p className="truncate text-[12px] text-fg3">{samples.join(' · ')}</p>
        </div>
        <span className="text-[12px] text-fg3">in</span>
        <select value={target?.collection ?? ''} onChange={(e) => pick(e.target.value)} className={select}>
          <option value="">Non importare</option>
          {collections.map((c) => (
            <option key={c.name} value={c.name}>
              {c.label}
            </option>
          ))}
        </select>
      </div>
      {target && (
        <div className="grid grid-cols-[1fr_1fr] gap-x-4 gap-y-1.5 border-t border-line pt-3 text-[12.5px]">
          {Object.entries(own).map(([field, f]) => (
            <div key={field} className="contents">
              <span className="self-center truncate text-fg2">{f.label}</span>
              <select
                value={target.fields[field] ?? ''}
                onChange={(e) => {
                  const next = { ...target.fields }
                  if (e.target.value) next[field] = e.target.value as WpSource
                  else delete next[field]
                  onChange({ ...target, fields: next })
                }}
                className={cx(select, !target.fields[field] && 'text-fg3')}
              >
                <option value="">— niente</option>
                {f.sources.map((s) => (
                  <option key={s} value={s}>
                    {SOURCES[s]}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

function Progress({ id, onAgain }: { id: string; onAgain: () => void }) {
  const queryClient = useQueryClient()
  const { schema } = useSession()
  const [p, setP] = useState<WpProgress | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  useEffect(() => {
    let alive = true
    const poll = async () => {
      try {
        const next = await api.importJob(id)
        if (!alive) return
        setP(next)
        if (next.phase === 'done' || next.phase === 'failed') {
          void queryClient.invalidateQueries()
          return
        }
      } catch {}
      timer.current = setTimeout(poll, 800)
    }
    void poll()
    return () => {
      alive = false
      clearTimeout(timer.current)
    }
  }, [id, queryClient])

  if (!p) return null
  const running = p.phase === 'media' || p.phase === 'content'
  const pct = p.total ? Math.round((p.done / p.total) * 100) : 0
  const labelOf = (name: string) => schema.collections.find((c) => c.name === name)?.label ?? name
  return (
    <div className="space-y-5">
      {running ? (
        <section className="space-y-2 rounded-lg border border-line bg-panel p-5">
          <div className="flex justify-between text-[13px]">
            <span className="font-medium">{p.phase === 'media' ? 'Scarico le immagini' : 'Creo i contenuti'}</span>
            <span className="tabular-nums text-fg3">
              {p.done} di {p.total}
            </span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-hover">
            <div className="h-full rounded-full bg-accent transition-[width]" style={{ width: `${pct}%` }} />
          </div>
          <p className="text-[12px] text-fg3">Puoi lasciare questa pagina: l’importazione continua sul server.</p>
        </section>
      ) : p.phase === 'failed' ? (
        <p className="flex items-start gap-1.5 text-[13px] text-danger">
          <CircleAlert className="mt-0.5 size-4 shrink-0" /> L’importazione si è fermata: {p.error}
        </p>
      ) : (
        <section className="space-y-1 rounded-lg border border-line bg-panel p-5">
          <div className="flex items-center gap-2 text-[14px] font-medium">
            <CircleCheck className="size-4.5 text-ok" /> Importazione finita
          </div>
          <p className="text-[12.5px] leading-relaxed text-fg2">
            {p.created.length} contenuti importati ({p.created.filter((d) => d.published).length} pubblicati),{' '}
            {p.media.downloaded} immagini nella libreria
            {p.media.failed ? ` (${p.media.failed} non scaricabili)` : ''}, {p.redirects} reindirizzamenti.
          </p>
        </section>
      )}
      {p.created.length > 0 && (
        <section className="space-y-2">
          <h3 className="text-[12px] font-medium text-fg2">Importati</h3>
          <ul className="max-h-72 divide-y divide-line overflow-y-auto rounded-lg border border-line bg-panel">
            {p.created.map((d) => (
              <li key={d.id}>
                <button
                  type="button"
                  onClick={() => navigate({ name: 'document', collection: d.collection, id: d.id })}
                  className="flex w-full items-center gap-3 px-4 py-2 text-left text-[12.5px] hover:bg-hover"
                >
                  <span className="min-w-0 flex-1 truncate">{d.title}</span>
                  <span className="text-fg3">{labelOf(d.collection)}</span>
                  <span className={d.published ? 'text-ok' : 'text-fg3'}>{d.published ? 'Pubblicato' : 'Bozza'}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
      {Object.keys(p.media.reasons ?? {}).length > 0 && (
        <section className="space-y-2">
          <h3 className="text-[12px] font-medium text-fg2">Immagini non importate</h3>
          <ul className="divide-y divide-line rounded-lg border border-line bg-panel text-[12.5px]">
            {Object.entries(p.media.reasons).map(([reason, n]) => (
              <li key={reason} className="flex gap-3 px-4 py-2">
                <span className="tabular-nums text-fg2">{n}</span>
                <span className="min-w-0 flex-1 text-fg3">{reason}</span>
              </li>
            ))}
          </ul>
          <p className="text-[12px] text-fg3">
            Nei testi quelle immagini mancano: si rimettono a mano, oppure con le icone del canvas.
          </p>
        </section>
      )}
      {[...p.problems, ...p.skipped].length > 0 && (
        <section className="space-y-2">
          <h3 className="text-[12px] font-medium text-fg2">Da guardare</h3>
          <ul className="divide-y divide-line rounded-lg border border-line bg-panel text-[12.5px]">
            {[...p.problems, ...p.skipped].map((x, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: a fixed list, shown once
              <li key={i} className="flex gap-3 px-4 py-2">
                <span className="min-w-0 flex-1 truncate">{x.title}</span>
                <span className="text-fg3">{x.reason}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
      {!running && (
        <div className="flex justify-end">
          <Button onClick={onAgain}>Importa un altro sito</Button>
        </div>
      )}
    </div>
  )
}
