import { useQueryClient } from '@tanstack/react-query'
import {
  BookOpen,
  Briefcase,
  ExternalLink,
  FileText,
  Folder,
  Globe,
  LogOut,
  Monitor,
  Moon,
  Newspaper,
  Search,
  SlidersHorizontal,
  Sun,
  Users,
} from 'lucide-react'
import type { ReactNode } from 'react'
import { cx, Kbd, MenuItem, MenuSeparator, Popover } from '../components/ui.tsx'
import { api, type CollectionDescription } from '../lib/api.ts'
import { type Theme, useTheme } from '../lib/prefs.ts'
import { href, navigate, useRoute } from '../lib/router.ts'
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

export const localeName = (code: string) => {
  try {
    const name = new Intl.DisplayNames(['it'], { type: 'language' }).of(code) ?? code
    return name.charAt(0).toUpperCase() + name.slice(1)
  } catch {
    return code
  }
}

export function Sidebar() {
  const { schema, user, locale, setLocale, openPalette } = useSession()
  const route = useRoute()
  const [theme, setTheme] = useTheme()
  const queryClient = useQueryClient()
  const current = route.name === 'home' ? null : route.collection

  const logout = async () => {
    await api.logout().catch(() => {})
    queryClient.clear()
    location.assign('/admin/')
  }

  const themeIcon = { light: <Sun />, dark: <Moon />, system: <Monitor /> }

  return (
    <aside className="flex w-[232px] shrink-0 flex-col border-r border-line bg-panel">
      <div className="flex h-12 items-center gap-2.5 px-3.5">
        <Logo className="size-6" />
        <div className="min-w-0 flex-1">
          <div className="truncate text-[13px] font-semibold">{schema.site.name}</div>
        </div>
      </div>

      <div className="px-2.5 pb-2">
        <button
          type="button"
          onClick={openPalette}
          className="flex h-8 w-full items-center gap-2 rounded-md border border-line bg-panel2 px-2.5 text-fg3 transition-colors hover:border-line2 hover:text-fg2"
        >
          <Search className="size-3.5" />
          <span className="flex-1 text-left">Cerca…</span>
          <Kbd>⌘K</Kbd>
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto px-2.5 py-1">
        <div className="px-2 pt-2 pb-1 text-[11px] font-medium tracking-wide text-fg3 uppercase">Contenuti</div>
        {schema.collections.map((c) => (
          <a
            key={c.name}
            href={href({ name: 'collection', collection: c.name })}
            onClick={(e) => {
              if (e.metaKey || e.ctrlKey) return
              e.preventDefault()
              navigate({ name: 'collection', collection: c.name })
            }}
            className={cx(
              'flex h-8 items-center gap-2.5 rounded-md px-2 text-[13px] transition-colors [&_svg]:size-4 [&_svg]:shrink-0',
              current === c.name ? 'bg-hover font-medium text-fg' : 'text-fg2 hover:bg-hover hover:text-fg',
            )}
          >
            {collectionIcon(c)}
            <span className="truncate">{c.label}</span>
          </a>
        ))}
      </nav>

      <div className="space-y-1 border-t border-line p-2.5">
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
                <span className="font-mono text-[11px] text-fg3 uppercase">{locale}</span>
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

        <Popover
          side="top"
          width={216}
          trigger={({ toggle, ref }) => (
            <button
              ref={ref}
              type="button"
              onClick={toggle}
              className="flex h-10 w-full items-center gap-2.5 rounded-md px-2 text-left hover:bg-hover"
            >
              <span className="flex size-6 items-center justify-center rounded-full bg-accent text-[11px] font-semibold text-accent-fg">
                {user.name.slice(0, 1).toUpperCase()}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-medium">{user.name}</span>
                <span className="block truncate text-[11px] text-fg3">
                  {user.role === 'admin' ? 'Amministratore' : 'Editor'}
                </span>
              </span>
            </button>
          )}
        >
          {(close) => (
            <div className="p-1">
              <div className="px-2 pt-1.5 pb-1 text-[11px] font-medium text-fg3">Tema</div>
              {(['light', 'dark', 'system'] as Theme[]).map((t) => (
                <MenuItem key={t} icon={themeIcon[t]} checked={theme === t} onClick={() => setTheme(t)}>
                  {{ light: 'Chiaro', dark: 'Scuro', system: 'Come il sistema' }[t]}
                </MenuItem>
              ))}
              <MenuSeparator />
              {schema.site.url && (
                <MenuItem
                  icon={<ExternalLink />}
                  onClick={() => {
                    window.open(schema.site.url, '_blank', 'noopener')
                    close()
                  }}
                >
                  Apri il sito
                </MenuItem>
              )}
              <MenuItem icon={<LogOut />} onClick={logout}>
                Esci
              </MenuItem>
            </div>
          )}
        </Popover>
      </div>
    </aside>
  )
}
