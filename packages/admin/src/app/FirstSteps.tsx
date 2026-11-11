import { useQuery } from '@tanstack/react-query'
import { Check, X } from 'lucide-react'
import { api, type CollectionDescription } from '../lib/api.ts'
import { t } from '../lib/i18n.ts'
import { usePref } from '../lib/prefs.ts'
import { href, navigate, type Route } from '../lib/router.ts'

type Step = { key: string; title: string; text: string; done: boolean; route: Route }

/**
 * "Primi passi" on the Overview of a new site: what makes it a real site, each step ticked off by
 * itself as it gets done. It goes away once everything is done, or when the admin hides it.
 */
export function FirstSteps({
  lists,
  singletons,
  counts,
  aiReady,
}: {
  lists: CollectionDescription[]
  singletons: CollectionDescription[]
  counts: { collection: string; total: number; drafts: number }[]
  aiReady: boolean
}) {
  const [hidden, setHidden] = usePref<'' | 'hidden'>('mz-first-steps', '')
  const seo = useQuery({ queryKey: ['seo'], queryFn: api.seo, enabled: !hidden })
  const people = useQuery({ queryKey: ['people'], queryFn: api.people, enabled: !hidden })
  if (hidden || !seo.data || !people.data) return null

  const online = (c?: CollectionDescription) => {
    const row = counts.find((r) => r.collection === c?.name)
    return row ? row.total - row.drafts : 0
  }
  const pages = lists.find((c) => /page|pagin/.test(c.name)) ?? lists[0]
  const posts = lists.find((c) => c !== pages)
  const site = singletons.find((c) => c.fields.some((f) => f.name === 'siteName'))

  const steps: Step[] = [
    site && {
      key: 'site',
      title: t('Completa i dati del sito'),
      text: t('Descrizione, logo e contatti: li legge Google e le pagine possono mostrarli.'),
      done: !!seo.data.seo.description?.trim(),
      route: { name: 'settings', tab: site.name } as Route,
    },
    pages && {
      key: 'page',
      title: t('Pubblica la prima pagina'),
      text: t('Con indirizzo «home» diventa la pagina iniziale del sito.'),
      done: online(pages) > 0,
      route: { name: 'new', collection: pages.name } as Route,
    },
    posts && {
      key: 'posts',
      title: /post|artic|blog|news|diar/.test(posts.name)
        ? t('Scrivi il primo articolo')
        : t('Aggiungi il primo contenuto in {collection}', { collection: posts.label }),
      text: t('Compare da solo nel sito, con il suo indirizzo.'),
      done: online(posts) > 0,
      route: { name: 'new', collection: posts.name } as Route,
    },
    {
      key: 'ai',
      title: t('Collega l’AI'),
      text: t('Con una chiave Claude scrive testi, traduce e costruisce pagine da un brief.'),
      done: aiReady,
      route: { name: 'settings', tab: 'ai' } as Route,
    },
    {
      key: 'people',
      title: t('Invita chi lavora con te'),
      text: t('Ognuno con il suo accesso e il suo ruolo.'),
      done: people.data.users.length > 1 || people.data.invites.length > 0,
      route: { name: 'people' } as Route,
    },
  ].filter((s): s is Step => !!s)

  const done = steps.filter((s) => s.done).length
  if (done === steps.length) return null

  return (
    <section
      aria-labelledby="first-steps"
      className="rounded-xl border border-line bg-panel p-4 shadow-[0_1px_2px_rgb(10_10_11/0.04)] sm:p-5"
    >
      <header className="flex items-start gap-4">
        <div className="min-w-0 flex-1">
          <h2 id="first-steps" className="text-[15px] font-semibold">
            {t('Primi passi')}
          </h2>
          <p className="mt-0.5 text-[13px] text-fg2">
            {t('{done} di {total} fatti: si spuntano da soli man mano che il sito prende forma.', {
              done,
              total: steps.length,
            })}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setHidden('hidden')}
          title={t('Nascondi i primi passi')}
          aria-label={t('Nascondi i primi passi')}
          className="flex size-7 shrink-0 items-center justify-center rounded-md text-fg3 hover:bg-hover hover:text-fg"
        >
          <X className="size-4" />
        </button>
      </header>
      <div
        className="mt-3 h-1 overflow-hidden rounded-full bg-seg"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={steps.length}
        aria-valuenow={done}
        aria-label={t('Primi passi')}
      >
        <div
          className="h-full rounded-full bg-accent transition-[width]"
          style={{ width: `${(done / steps.length) * 100}%` }}
        />
      </div>
      <ol className="mt-4 grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-2">
        {steps.map((s) => (
          <li key={s.key}>
            <a
              href={href(s.route)}
              onClick={(e) => {
                if (e.metaKey || e.ctrlKey) return
                e.preventDefault()
                navigate(s.route)
              }}
              className="flex h-full gap-3 rounded-lg border border-line px-3 py-2.5 transition-colors hover:border-line2 hover:bg-hover"
            >
              <span
                className={
                  s.done
                    ? 'mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-[#10b981] text-white'
                    : 'mt-0.5 size-5 shrink-0 rounded-full border-[1.5px] border-line2'
                }
              >
                {s.done && <Check className="size-3.5" strokeWidth={3} />}
                {s.done && <span className="sr-only">{t('Fatto')}</span>}
              </span>
              <span className="min-w-0">
                <span className={s.done ? 'block font-medium text-fg3 line-through' : 'block font-medium'}>
                  {s.title}
                </span>
                {!s.done && <span className="mt-0.5 block text-[12.5px] leading-snug text-fg3">{s.text}</span>}
              </span>
            </a>
          </li>
        ))}
      </ol>
    </section>
  )
}
