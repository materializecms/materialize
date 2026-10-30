import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowUpRight,
  BookOpen,
  Briefcase,
  FileText,
  Folder,
  Globe,
  Images,
  LayoutGrid,
  LogOut,
  Newspaper,
  Search,
  Settings,
  SlidersHorizontal,
  UserRound,
  Users,
} from 'lucide-react'
import { type ReactNode, useState } from 'react'
import { cx, Kbd, MenuItem, MenuSeparator, Popover, ThemeSwitch, TintIcon, tintOf } from '../components/ui.tsx'
import { api, type CollectionDescription } from '../lib/api.ts'
import { href, navigate, type Route, useRoute } from '../lib/router.ts'
import { ProfileDialog } from '../people/ProfileDialog.tsx'
import { useUpdateAvailable } from '../settings/UpdatesSettings.tsx'
import { Logo } from './Auth.tsx'
import { useSession } from './context.ts'

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
    const name = new Intl.DisplayNames(['it'], { type: 'language' }).of(code) ?? code
    return name.charAt(0).toUpperCase() + name.slice(1)
  } catch {
    return code
  }
}

const sectionLabel = 'px-2 pt-5 pb-1.5 text-[12px] font-medium text-fg3'

export function Sidebar() {
  const { schema, user, locale, setLocale, openPalette } = useSession()
  const update = useUpdateAvailable()
  const route = useRoute()
  const queryClient = useQueryClient()
  const tint = useCollectionTint()
  const overview = useOverview()
  const current = 'collection' in route ? route.collection : null
  const [profile, setProfile] = useState(false)
  const countOf = (name: string) => overview.data?.counts.find((c) => c.collection === name)?.total

  const logout = async () => {
    await api.logout().catch(() => {})
    queryClient.clear()
    location.assign('/admin/')
  }

  return (
    <aside className="flex w-[236px] shrink-0 flex-col">
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
            Visita il sito
            <ArrowUpRight className="size-3" />
          </a>
        </div>
      </div>

      <div className="px-3 pt-1 pb-1">
        <button
          type="button"
          onClick={openPalette}
          className="flex h-8 w-full items-center gap-2 rounded-lg border border-line bg-panel px-2.5 text-fg3 shadow-[0_1px_2px_rgb(10_10_11/0.04)] transition-colors hover:border-line2 hover:text-fg2"
        >
          <Search className="size-3.5" />
          <span className="flex-1 text-left">Cerca o vai a…</span>
          <Kbd>⌘K</Kbd>
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 pb-3">
        <div className="pt-3">
          <NavItem route={{ name: 'home' }} active={route.name === 'home'} label="Panoramica">
            <TintIcon color="var(--text2)" size="sm">
              <LayoutGrid />
            </TintIcon>
          </NavItem>
        </div>
        <div className={sectionLabel}>Contenuti</div>
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
        <div className={sectionLabel}>Libreria</div>
        <NavItem route={{ name: 'media' }} active={route.name === 'media'} label="Media" count={overview.data?.media}>
          <TintIcon color="#0ea5e9" size="sm">
            <Images />
          </TintIcon>
        </NavItem>
        <div className={sectionLabel}>Gestione</div>
        <NavItem
          route={update ? { name: 'settings', tab: 'updates' } : { name: 'settings' }}
          active={route.name === 'settings'}
          label="Impostazioni"
          note={update ? `È disponibile Materialize ${update}` : undefined}
        >
          <TintIcon color="#64748b" size="sm">
            <Settings />
          </TintIcon>
        </NavItem>
        {user.role === 'admin' && (
          <NavItem route={{ name: 'people' }} active={route.name === 'people'} label="Persone">
            <TintIcon color="#8b5cf6" size="sm">
              <UserRound />
            </TintIcon>
          </NavItem>
        )}
      </nav>

      <div className="space-y-1 px-3 pb-3">
        {schema.locales.available.length > 1 && (
          <Popover
            side="top"
            width={200}
            trigger={({ toggle, ref }) => (
              <button
                ref={ref}
                type="button"
                onClick={toggle}
                className="flex h-8 w-full items-center gap-2.5 rounded-md px-2 text-fg2 hover:bg-hover hover:text-fg [&_svg]:size-4"
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
                    hint={l === schema.locales.default ? 'principale' : undefined}
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

        <div className="flex items-center gap-1 rounded-lg border border-line bg-panel p-1 shadow-[0_1px_2px_rgb(10_10_11/0.04)]">
          <Popover
            side="top"
            width={216}
            trigger={({ toggle, ref }) => (
              <button
                ref={ref}
                type="button"
                onClick={toggle}
                className="flex h-9 min-w-0 flex-1 items-center gap-2 rounded-md px-1.5 text-left hover:bg-hover"
              >
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-accent to-[#8b5cf6] text-[12px] font-semibold text-white">
                  {user.name.slice(0, 1).toUpperCase()}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] leading-tight font-medium">{user.name}</span>
                  <span className="block truncate text-[12px] text-fg3">
                    {user.role === 'admin' ? 'Amministratore' : 'Editor'}
                  </span>
                </span>
              </button>
            )}
          >
            {(close) => (
              <div className="p-1">
                <MenuItem
                  icon={<UserRound />}
                  onClick={() => {
                    close()
                    setProfile(true)
                  }}
                >
                  Il tuo profilo
                </MenuItem>
                <MenuSeparator />
                <MenuItem icon={<LogOut />} onClick={logout}>
                  Esci
                </MenuItem>
              </div>
            )}
          </Popover>
          <ThemeSwitch compact />
        </div>
      </div>
      {profile && <ProfileDialog open onClose={() => setProfile(false)} />}
    </aside>
  )
}

function NavItem({
  route,
  active,
  label,
  count,
  note,
  children,
}: {
  route: Route
  active: boolean
  label: string
  count?: number
  /** Something waiting there, shown as a dot (the text is its tooltip and accessible name). */
  note?: string
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
        'flex h-8 items-center gap-2.5 rounded-lg px-1.5 text-[14px] transition-colors',
        active
          ? 'bg-panel font-medium text-fg shadow-[0_0_0_1px_var(--border),0_1px_2px_rgb(10_10_11/0.05)]'
          : 'text-fg2 hover:bg-hover hover:text-fg',
      )}
    >
      {children}
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {count !== undefined && count > 0 && <span className="text-[12px] text-fg3 tabular-nums">{count}</span>}
      {note && (
        <span title={note} className="mr-1 size-2 shrink-0 rounded-full bg-accent">
          <span className="sr-only">{note}</span>
        </span>
      )}
    </a>
  )
}
