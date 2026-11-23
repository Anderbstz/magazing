import { ChevronDown, Download, LogOut, Menu, PanelLeftClose, PanelLeftOpen, X } from 'lucide-react'
import { useState, type FocusEvent, type MouseEvent } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router'
import { navigationFor, type NavItem, type NavSection } from '@/app/navigation'
import { P } from '@/config/permissions'
import { logout } from '@/features/auth/session'
import { useCan, useSession } from '@/features/auth/use-auth'
import { useInstallPrompt } from '@/hooks/use-install-prompt'
import { useMediaQuery } from '@/hooks/use-media-query'
import { useStoredState } from '@/hooks/use-stored-state'
import { queryClient } from '@/lib/query-client'
import { cn } from '@/lib/utils'

type SidebarMode = 'expanded' | 'collapsed'

/**
 * Estructura de la app: menú lateral + contenido.
 * - Escritorio: el menú se pliega a una barra de íconos (se recuerda la elección).
 * - Móvil: el menú es un panel que se abre encima del contenido.
 */
export function AppShell() {
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useStoredState<SidebarMode>('magazing.sidebar', 'expanded', ['expanded', 'collapsed'])
  const isDesktop = useMediaQuery('(min-width: 1024px)')
  // En móvil el panel siempre va completo: plegarlo solo tiene sentido en escritorio.
  const collapsed = isDesktop && mode === 'collapsed'
  const toggle = () => setMode(collapsed ? 'expanded' : 'collapsed')

  return (
    <div className="flex min-h-full">
      {open && (
        <div className="fade-in fixed inset-0 z-30 bg-slate-900/40 lg:hidden" onClick={() => setOpen(false)} aria-hidden />
      )}

      <aside
        className={cn(
          'drawer fixed inset-y-0 left-0 z-40 flex w-64 flex-col bg-white ring-1 ring-slate-200 transition-[transform,width] duration-250 ease-drawer lg:translate-x-0',
          open ? 'translate-x-0' : '-translate-x-full',
          collapsed && 'lg:w-[4.5rem]',
        )}
      >
        <div className={cn('flex h-16 shrink-0 items-center gap-3', collapsed ? 'justify-center px-2' : 'justify-between px-5')}>
          {!collapsed && (
            <div className="flex min-w-0 items-center gap-2.5">
              <img src="/logo.png" alt="" className="size-8" />
              <span className="font-semibold">Magazing</span>
            </div>
          )}
          <button
            type="button"
            onClick={toggle}
            className="hidden size-9 items-center justify-center rounded-lg text-slate-500 ring-1 ring-slate-200 hover:bg-slate-50 hover:text-slate-800 lg:flex"
            aria-label={collapsed ? 'Expandir menú' : 'Contraer menú'}
            title={collapsed ? 'Expandir menú' : 'Contraer menú'}
          >
            {collapsed ? <PanelLeftOpen className="size-4.5" /> : <PanelLeftClose className="size-4.5" />}
          </button>
          <button
            type="button"
            className="rounded-md p-1 text-slate-500 hover:bg-slate-100 lg:hidden"
            onClick={() => setOpen(false)}
            aria-label="Cerrar menú"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* En móvil, el menú se cierra al elegir una opción. */}
        {collapsed ? <SidebarRail /> : <SidebarNav onNavigate={() => setOpen(false)} />}
        <InstallAppButton collapsed={collapsed} />
        <UserFooter collapsed={collapsed} />
      </aside>

      <div className={cn('flex min-w-0 flex-1 flex-col transition-[padding] duration-250 ease-drawer', collapsed ? 'lg:pl-[4.5rem]' : 'lg:pl-64')}>
        <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-slate-200 bg-white/90 px-4 backdrop-blur lg:hidden">
          <button
            type="button"
            className="rounded-md p-1.5 text-slate-600 hover:bg-slate-100"
            onClick={() => setOpen(true)}
            aria-label="Abrir menú"
          >
            <Menu className="size-5" />
          </button>
          <img src="/logo.png" alt="" className="size-6" />
          <span className="font-semibold">Magazing</span>
        </header>

        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

/** true si la ruta actual pertenece a este ítem del menú. */
function matches(pathname: string, item: NavItem) {
  return item.end ? pathname === item.to : pathname === item.to || pathname.startsWith(item.to + '/')
}

/** Secciones del menú con solo los ítems que el usuario puede ver. */
function useVisibleSections(): NavSection[] {
  const can = useCan()
  return navigationFor(can(P.UsersManage))
    .map((section) => ({ ...section, items: section.items.filter((item) => !item.permission || can(item.permission)) }))
    .filter((section) => section.items.length > 0)
}

/**
 * Menú desplegado, en acordeón: cada sección se abre con su título y solo una queda abierta
 * a la vez (la de la pantalla actual, al navegar). Así el menú entra sin barra de desplazamiento.
 */
function SidebarNav({ onNavigate }: { onNavigate: () => void }) {
  const { pathname } = useLocation()
  const sections = useVisibleSections()

  const activeTitle = sections.find((s) => s.title && s.items.some((item) => matches(pathname, item)))?.title
  const [open, setOpen] = useState<string | undefined>(activeTitle)
  const [lastActive, setLastActive] = useState(activeTitle)
  // Al cambiar de pantalla se abre la sección que la contiene.
  if (activeTitle !== lastActive) {
    setLastActive(activeTitle)
    if (activeTitle) setOpen(activeTitle)
  }

  return (
    <nav className="scrollbar-none flex-1 space-y-1 overflow-y-auto px-3 py-2">
      {sections.map((section, i) => {
        const expanded = !section.title || open === section.title
        const panelId = `nav-section-${i}`
        return (
          <div key={section.title ?? i}>
            {section.title && (
              <button
                type="button"
                aria-expanded={expanded}
                aria-controls={panelId}
                onClick={() => setOpen(expanded ? undefined : section.title)}
                className="flex w-full items-center justify-between rounded-md px-3 py-2 text-xs font-semibold tracking-wide text-slate-400 uppercase hover:bg-slate-50 hover:text-slate-600"
              >
                {section.title}
                <ChevronDown className={cn('size-3.5 transition-transform duration-200', expanded && 'rotate-180')} aria-hidden />
              </button>
            )}
            <div id={panelId} className={cn('grid transition-[grid-template-rows] duration-200 ease-out', expanded ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]')}>
              <ul className="space-y-0.5 overflow-hidden" inert={!expanded}>
                {section.items.map((item) => (
                  <li key={item.to}>
                    <NavLink
                      to={item.to}
                      end={item.end}
                      onClick={onNavigate}
                      className={({ isActive }) =>
                        cn(
                          'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                          isActive ? 'bg-brand-50 text-brand-800' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
                        )
                      }
                    >
                      <item.icon className="size-4.5 shrink-0" aria-hidden />
                      {item.label}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )
      })}
    </nav>
  )
}

const RAIL_BUTTON = 'flex size-10 items-center justify-center rounded-xl transition-colors'
const RAIL_IDLE = 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'
const RAIL_ACTIVE = 'bg-brand-50 text-brand-700'

/**
 * Menú plegado: un ícono por sección. Al pasar el mouse (o hacer clic / Enter) se abre al costado
 * un panel con las opciones de esa sección. Las secciones de una sola opción van directo, con su
 * nombre en un tooltip. Así entran todas sin desplazamiento, aunque el admin tenga 21 opciones.
 */
function SidebarRail() {
  const sections = useVisibleSections()
  const { pathname } = useLocation()
  const [panel, setPanel] = useState<{ index: number; top: number } | null>(null)
  const [tip, setTip] = useState<{ label: string; top: number } | null>(null)

  const anchor = (e: MouseEvent<HTMLElement> | FocusEvent<HTMLElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    return rect.top
  }
  const close = () => {
    setPanel(null)
    setTip(null)
  }
  const openSection = panel ? sections[panel.index] : null

  return (
    <nav
      className="flex flex-1 flex-col items-center gap-1 px-3 py-2"
      aria-label="Menú principal"
      onMouseLeave={close}
      onKeyDown={(e) => e.key === 'Escape' && close()}
    >
      {sections.map((section, index) => {
        const active = section.items.some((item) => matches(pathname, item))
        const single = section.items.length === 1 ? section.items[0] : null
        const Icon = single?.icon ?? section.icon ?? section.items[0].icon
        const label = single?.label ?? section.title ?? ''

        return (
          <div key={section.title ?? index} className="flex flex-col items-center">
            {index > 0 && <hr className="my-2 w-8 border-slate-200" />}
            {single ? (
              <NavLink
                to={single.to}
                end={single.end}
                aria-label={label}
                onMouseEnter={(e) => {
                  setPanel(null)
                  setTip({ label, top: anchor(e) + 20 })
                }}
                onFocus={(e) => setTip({ label, top: anchor(e) + 20 })}
                onBlur={() => setTip(null)}
                className={cn(RAIL_BUTTON, active ? RAIL_ACTIVE : RAIL_IDLE)}
              >
                <Icon className="size-5" aria-hidden />
              </NavLink>
            ) : (
              <button
                type="button"
                aria-label={label}
                aria-haspopup="menu"
                aria-expanded={panel?.index === index}
                onMouseEnter={(e) => {
                  setTip(null)
                  setPanel({ index, top: anchor(e) })
                }}
                onClick={(e) => setPanel(panel?.index === index ? null : { index, top: anchor(e) })}
                className={cn(RAIL_BUTTON, active ? RAIL_ACTIVE : panel?.index === index ? 'bg-slate-100 text-slate-900' : RAIL_IDLE)}
              >
                <Icon className="size-5" aria-hidden />
              </button>
            )}
          </div>
        )
      })}

      {openSection && panel && (
        // Puente invisible entre el ícono y el panel, para que el mouse no "se caiga" al cruzar.
        <div className="fixed left-[4.5rem] z-50 pl-2" style={{ top: panel.top - 8 }}>
          <div role="menu" aria-label={openSection.title} className="pop-in w-56 rounded-xl bg-white p-1.5 shadow-lg ring-1 ring-slate-200">
            <p className="px-2.5 pt-1.5 pb-1 text-xs font-semibold tracking-wide text-slate-400 uppercase">{openSection.title}</p>
            {openSection.items.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                role="menuitem"
                onClick={close}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors',
                    isActive ? 'bg-brand-50 text-brand-800' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
                  )
                }
              >
                <item.icon className="size-4 shrink-0" aria-hidden />
                {item.label}
              </NavLink>
            ))}
          </div>
        </div>
      )}

      {tip && (
        <div
          role="tooltip"
          className="pointer-events-none fixed left-[4.75rem] z-50 -translate-y-1/2 rounded-md bg-slate-900 px-2.5 py-1.5 text-xs font-medium whitespace-nowrap text-white shadow-lg"
          style={{ top: tip.top }}
        >
          {tip.label}
        </div>
      )}
    </nav>
  )
}

/** "Instalar app": solo aparece cuando el navegador ofrece instalar Magazing (Chrome, Edge, Android). */
function InstallAppButton({ collapsed }: { collapsed: boolean }) {
  const { canInstall, install } = useInstallPrompt()
  if (!canInstall) return null

  return (
    <div className={cn('pb-2', collapsed ? 'flex justify-center' : 'px-3')}>
      <button
        type="button"
        onClick={install}
        title="Instalar Magazing en este equipo"
        aria-label="Instalar app"
        className={cn(
          'flex items-center gap-2.5 rounded-lg text-sm font-medium text-brand-700 ring-1 ring-brand-200 hover:bg-brand-50',
          collapsed ? 'size-10 justify-center' : 'w-full px-3 py-2',
        )}
      >
        <Download className="size-4.5 shrink-0" aria-hidden />
        {!collapsed && 'Instalar app'}
      </button>
    </div>
  )
}

function UserFooter({ collapsed }: { collapsed: boolean }) {
  const { user } = useSession()
  const navigate = useNavigate()

  async function handleLogout() {
    await logout()
    queryClient.clear()
    navigate('/login', { replace: true })
  }

  if (!user) return null

  const avatar = (
    <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-50 text-sm font-semibold text-brand-700 uppercase ring-1 ring-brand-100">
      {user.username.slice(0, 2)}
    </div>
  )

  if (collapsed) {
    return (
      <div className="flex flex-col items-center gap-2 border-t border-slate-200 py-3">
        <Link to="/profile" className="rounded-full" title={`${user.username} · Mi perfil`} aria-label="Mi perfil">
          {avatar}
        </Link>
        <button
          type="button"
          onClick={handleLogout}
          className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          aria-label="Cerrar sesión"
          title="Cerrar sesión"
        >
          <LogOut className="size-4" />
        </button>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-3 border-t border-slate-200 p-4">
      <Link to="/profile" className="-m-1 flex min-w-0 flex-1 items-center gap-3 rounded-lg p-1 hover:bg-slate-50" title="Mi perfil">
        {avatar}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-slate-800">{user.username}</p>
          <p className="truncate text-xs text-slate-500">{user.roles.join(', ') || 'Sin rol'}</p>
        </div>
      </Link>
      <button
        type="button"
        onClick={handleLogout}
        className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
        aria-label="Cerrar sesión"
        title="Cerrar sesión"
      >
        <LogOut className="size-4.5" />
      </button>
    </div>
  )
}
