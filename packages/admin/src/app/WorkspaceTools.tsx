import { useQueryClient } from '@tanstack/react-query'
import { Compass, LogOut, Search, Sparkles, UserRound, X } from 'lucide-react'
import { useState } from 'react'
import { cx, IconButton, Kbd, MenuItem, MenuSeparator, Popover, ThemeSwitch } from '../components/ui.tsx'
import { api } from '../lib/api.ts'
import { t } from '../lib/i18n.ts'
import { href, navigate } from '../lib/router.ts'
import { ProfileDialog } from '../people/ProfileDialog.tsx'
import { hideNotice, noticeHidden, useUpdateNotice } from '../settings/UpdatesSettings.tsx'
import { useSession } from './context.ts'
import { startPanelTour } from './PanelTour.tsx'

/**
 * Search, theme and the profile menu: on a wide screen they sit in the notch at the top right of
 * the work area, on a phone in the top bar. `compact` drops the search label.
 */
export function WorkspaceTools({ compact }: { compact?: boolean }) {
  const { user, openPalette } = useSession()
  const queryClient = useQueryClient()
  const [profile, setProfile] = useState(false)

  const logout = async () => {
    await api.logout().catch(() => {})
    queryClient.clear()
    location.assign('/admin/')
  }

  return (
    <>
      <UpdateNotice compact={compact} />
      <button
        type="button"
        data-tour="search"
        onClick={openPalette}
        aria-label={t('Cerca o vai a…')}
        className={cx(
          'flex h-9 items-center gap-2 rounded-full bg-panel text-fg3 transition-colors hover:text-fg2',
          compact ? 'w-9 justify-center' : 'w-[248px] pr-1.5 pl-3.5',
        )}
      >
        <Search className="size-4 shrink-0" />
        {!compact && (
          <>
            <span className="flex-1 truncate text-left">{t('Cerca o vai a…')}</span>
            <Kbd>⌘K</Kbd>
          </>
        )}
      </button>
      <div data-tour="me" className="mz-pill">
        <ThemeSwitch compact />
        <Popover
          align="end"
          width={232}
          trigger={({ toggle, ref }) => (
            <button
              ref={ref}
              type="button"
              onClick={toggle}
              title={user.name}
              aria-label={t('Il tuo profilo')}
              className="flex size-[30px] items-center justify-center rounded-full bg-gradient-to-br from-accent to-[#8b5cf6] text-[12px] font-semibold text-white"
            >
              {user.name.slice(0, 1).toUpperCase()}
            </button>
          )}
        >
          {(close) => (
            <div className="p-1">
              <div className="px-2 pt-1.5 pb-2">
                <div className="truncate text-[13px] font-medium">{user.name}</div>
                <div className="truncate text-[12px] text-fg3">
                  {user.role === 'admin' ? t('Amministratore') : t('Editor')}
                </div>
              </div>
              <MenuSeparator />
              <MenuItem
                icon={<UserRound />}
                onClick={() => {
                  close()
                  setProfile(true)
                }}
              >
                {t('Il tuo profilo')}
              </MenuItem>
              <MenuItem
                icon={<Compass />}
                onClick={() => {
                  close()
                  startPanelTour()
                }}
              >
                {t('Tour del pannello')}
              </MenuItem>
              <MenuSeparator />
              <MenuItem icon={<LogOut />} onClick={logout}>
                {t('Esci')}
              </MenuItem>
            </div>
          )}
        </Popover>
      </div>
      {profile && <ProfileDialog open onClose={() => setProfile(false)} />}
    </>
  )
}

/**
 * A new Materialize, for administrators: a pill beside the search that opens Settings → Updates,
 * with the first line of what is new as its tooltip. Closed, it stays away until the next version.
 */
function UpdateNotice({ compact }: { compact?: boolean }) {
  const notice = useUpdateNotice()
  const [closed, setClosed] = useState<string | null>(null)
  if (!notice || closed === notice.version || noticeHidden(notice.version)) return null
  const route = { name: 'settings', tab: 'updates' } as const
  const label = t('È disponibile Materialize {version}', { version: notice.version })
  return (
    <div className="mz-pill">
      <a
        href={href(route)}
        onClick={(e) => {
          if (e.metaKey || e.ctrlKey) return
          e.preventDefault()
          navigate(route)
        }}
        title={notice.headline ? `${label} · ${notice.headline}` : label}
        aria-label={label}
        className={cx(
          'flex h-[30px] items-center gap-1.5 rounded-full bg-accent/12 text-[12.5px] font-medium whitespace-nowrap text-accent transition-colors hover:bg-accent/20 [&_svg]:size-3.5',
          compact ? 'w-[30px] justify-center' : 'px-3',
        )}
      >
        <Sparkles />
        {!compact && t('Materialize {version}', { version: notice.version })}
      </a>
      {!compact && (
        <IconButton
          label={t('Nascondi fino alla prossima versione')}
          className="size-[30px] [&_svg]:size-3.5"
          onClick={() => {
            hideNotice(notice.version)
            setClosed(notice.version)
          }}
        >
          <X />
        </IconButton>
      )}
    </div>
  )
}
