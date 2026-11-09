import { useQueryClient } from '@tanstack/react-query'
import { Compass, LogOut, Search, UserRound } from 'lucide-react'
import { useState } from 'react'
import { cx, Kbd, MenuItem, MenuSeparator, Popover, ThemeSwitch } from '../components/ui.tsx'
import { api } from '../lib/api.ts'
import { t } from '../lib/i18n.ts'
import { ProfileDialog } from '../people/ProfileDialog.tsx'
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
                Tour del pannello
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
