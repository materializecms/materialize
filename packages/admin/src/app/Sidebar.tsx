import { useQuery } from '@tanstack/react-query'
import {
  ArrowUpRight,
  BookOpen,
  Briefcase,
  FileText,
  Folder,
  Globe,
  Images,
  LayoutGrid,
  Mail,
  Newspaper,
  Rocket,
  Settings,
  SlidersHorizontal,
  UserRound,
  Users,
} from 'lucide-react'
import type { ReactNode } from 'react'
import { cx, MenuItem, Popover, TintIcon, tintOf } from '../components/ui.tsx'
import { api, type CollectionDescription } from '../lib/api.ts'
import { intlLocale, t, tn } from '../lib/i18n.ts'
import { href, navigate, type Route, useRoute } from '../lib/router.ts'
import { useUpdateAvailable } from '../settings/UpdatesSettings.tsx'
import { Logo } from './Auth.tsx'
import { useSession } from './context.ts'
import { useReleases } from './ReleasesScreen.tsx'

export function collectionIcon(c: CollectionDescription): ReactNode {
  const n = c.name
  if (c.singleton) return <SlidersHorizontal />
  if (/page|pagin/.test(n)) return <FileText />
  if (/post|blog|news|artic/.test(n)) return <Newspaper />
  if (/team|people|author|member|persone/.test(n)) return <Users />
  if (/project|work|case|progett/.test(n)) return <Briefcase />
  if (/doc|guide/.test(n)) return <BookOpen />
  return <Folder />
}

/** The hue of a collection, the same everywhere in the panel. */
export function useCollectionTint() {
  const { schema } = useSession()
  return (name: string) => {
    const index = schema.collections.findIndex((c) => c.name === name)
    return tintOf(name, index >= 0 ? index : undefined)
  }
}

/** Counts and recent changes, shared by the sidebar and the home. */
export function useOverview() {
  const { locale } = useSession()
  return useQuery({ queryKey: ['overview', locale], queryFn: () => api.overview(locale), staleTime: 15_000 })
}

export const localeName = (code: string) => {
  try {
    const name = new Intl.DisplayNames([intlLocale()], { type: 'language' }).of(code) ?? code
    return name.charAt(0).toUpperCase() + name.slice(1)
  } catch {
    return code
  }
}

/** Group titles: small capitals, so they never read as one more item. */
const sectionLabel = 'px-2 pt-5 pb-1.5 text-[11px] font-semibold tracking-[0.07em] text-fg uppercase'

export function Sidebar() {
  const { schema, user, locale, setLocale } = useSession()
  const update = useUpdateAvailable()
  const route = useRoute()
  const tint = useCollectionTint()
  const releases = useReleases()
  const overview = useOverview()
  const current = 'collection' in route ? route.collection : null
  // Messages from the site's forms not read yet: the same query as the home's.
  const unread =
    useQuery({
      queryKey: ['submissions', { status: 'unread', limit: 1 }],
      queryFn: () => api.submissions({ status: 'unread', limit: 1 }),
      staleTime: 30_000,
    }).data?.unread ?? 0
  const countOf = (name: string) => overview.data?.counts.find((c) => c.collection === name)?.total

  return (
    <aside className="flex w-[240px] shrink-0 flex-col">
      <div className="flex h-14 items-center gap-2.5 px-4">
        <Logo className="size-7" />
        <div className="min-w-0 flex-1">
          <div className="truncate text-[14px] leading-tight font-semibold tracking-[-0.01em]">{schema.site.name}</div>
          <a
            href="/"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-[12px] text-fg3 hover:text-accent"
          >
            <span className="size-1.5 rounded-full bg-ok" />
            {t('Visita il sito')}
            <ArrowUpRight className="size-3" />
          </a>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 pb-3">
        <div className="pt-3">
          <NavItem route={{ name: 'home' }} active={route.name === 'home'} label={t('Panoramica')}>
            <TintIcon color="var(--text2)" size="sm">
              <LayoutGrid />
            </TintIcon>
          </NavItem>
        </div>
        <div data-tour="nav-content">
          <div className={sectionLabel}>{t('Contenuti')}</div>
          {schema.collections
            .filter((c) => !c.singleton)
            .map((c) => (
              <NavItem
                key={c.name}
                route={{ name: 'collection', collection: c.name }}
                active={current === c.name}
                label={c.label}
                count={countOf(c.name)}
              >
                <TintIcon color={tint(c.name)} size="sm">
                  {collectionIcon(c)}
                </TintIcon>
              </NavItem>
            ))}
        </div>
        <div data-tour="nav-publish">
          <NavItem
            route={{ name: 'releases' }}
            active={route.name === 'releases'}
            label={t('Rilasci')}
            count={releases.data?.releases.length || undefined}
          >
            <TintIcon color="#f97316" size="sm">
              <Rocket />
            </TintIcon>
          </NavItem>
          <NavItem route={{ name: 'newsletter' }} active={route.name === 'newsletter'} label="Newsletter">
            <TintIcon color="#ec4899" size="sm">
              <Mail />
            </TintIcon>
          </NavItem>
        </div>
        <div data-tour="nav-media">
          <div className={sectionLabel}>{t('Libreria')}</div>
          <NavItem
            route={{ name: 'media' }}
            active={route.name === 'media'}
            label={t('Media')}
            count={overview.data?.media}
          >
            <TintIcon color="#0ea5e9" size="sm">
              <Images />
            </TintIcon>
          </NavItem>
        </div>
        <div data-tour="nav-manage">
          <div className={sectionLabel}>{t('Gestione')}</div>
          <NavItem
            route={
              update
                ? { name: 'settings', tab: 'updates' }
                : unread
                  ? { name: 'settings', tab: 'messages' }
                  : { name: 'settings' }
            }
            active={route.name === 'settings'}
            label={t('Impostazioni')}
            badge={unread || undefined}
            badgeLabel={tn(unread, 'un messaggio nuovo', '{n} messaggi nuovi')}
            note={update ? t('È disponibile Materialize {version}', { version: update }) : undefined}
          >
            <TintIcon color="#64748b" size="sm">
              <Settings />
            </TintIcon>
          </NavItem>
          {user.role === 'admin' && (
            <NavItem route={{ name: 'people' }} active={route.name === 'people'} label={t('Persone')}>
              <TintIcon color="#8b5cf6" size="sm">
                <UserRound />
              </TintIcon>
            </NavItem>
          )}
        </div>
      </nav>

      <div className="space-y-1 px-3 pb-3">
        {schema.locales.available.length > 1 && (
          <div className="px-3 pt-1 text-[11px] font-medium text-fg3">{t('Lingua dei contenuti')}</div>
        )}
        {schema.locales.available.length > 1 && (
          <Popover
            side="top"
            width={200}
            trigger={({ toggle, ref }) => (
              <button
                ref={ref}
                type="button"
                onClick={toggle}
                title={t('Lingua dei contenuti')}
                aria-label={t('Lingua dei contenuti: {language}', { language: localeName(locale) })}
                className="flex h-9 w-full items-center gap-2.5 rounded-full bg-panel/60 px-3 text-fg2 hover:bg-panel hover:text-fg [&_svg]:size-4"
              >
                <Globe />
                <span className="flex-1 text-left">{localeName(locale)}</span>
                <span className="font-mono text-[12px] text-fg3 uppercase">{locale}</span>
              </button>
            )}
          >
            {(close) => (
              <div className="p-1">
                {schema.locales.available.map((l) => (
                  <MenuItem
                    key={l}
                    checked={l === locale}
                    hint={l === schema.locales.default ? t('principale') : undefined}
                    onClick={() => {
                      setLocale(l)
                      close()
                    }}
                  >
                    {localeName(l)}
                  </MenuItem>
                ))}
              </div>
            )}
          </Popover>
        )}
      </div>
    </aside>
  )
}

function NavItem({
  route,
  active,
  label,
  count,
  note,
  badge,
  badgeLabel,
  children,
}: {
  route: Route
  active: boolean
  label: string
  count?: number
  /** Something waiting there, shown as a dot (the text is its tooltip and accessible name). */
  note?: string
  /** Something to read there (unread messages), as an accent count. */
  badge?: number
  badgeLabel?: string
  children: ReactNode
}) {
  return (
    <a
      href={href(route)}
      aria-current={active ? 'page' : undefined}
      onClick={(e) => {
        if (e.metaKey || e.ctrlKey) return
        e.preventDefault()
        navigate(route)
      }}
      className={cx(
        'flex h-9 items-center gap-2.5 rounded-full pr-3 pl-1.5 text-[14px] transition-colors',
        active ? 'bg-panel font-medium text-fg' : 'text-fg2 hover:bg-panel/60 hover:text-fg',
      )}
    >
      {children}
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {count !== undefined && count > 0 && <span className="text-[12px] text-fg3 tabular-nums">{count}</span>}
      {!!badge && (
        <span
          title={badgeLabel}
          className="rounded-full bg-accent px-1.5 text-[11px] leading-[18px] font-semibold text-accent-fg tabular-nums"
        >
          {badge}
          {badgeLabel && <span className="sr-only"> · {badgeLabel}</span>}
        </span>
      )}
      {note && (
        <span title={note} className="mr-1 size-2 shrink-0 rounded-full bg-accent">
          <span className="sr-only">{note}</span>
        </span>
      )}
    </a>
  )
}
