import { ChevronDown, LogOut, Menu, X } from 'lucide-react'
import { useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router'
import { navigationFor, type NavItem } from '@/app/navigation'
import { P } from '@/config/permissions'
import { logout } from '@/features/auth/session'
import { useCan, useSession } from '@/features/auth/use-auth'
import { queryClient } from '@/lib/query-client'
import { cn } from '@/lib/utils'

export function AppShell() {
  const [open, setOpen] = useState(false)

  return (
    <div className="flex min-h-full">
      {open && (
        <div className="fade-in fixed inset-0 z-30 bg-slate-900/40 lg:hidden" onClick={() => setOpen(false)} aria-hidden />
      )}

      <aside
        className={cn(
          'drawer fixed inset-y-0 left-0 z-40 flex w-64 flex-col bg-white ring-1 ring-slate-200 transition-transform duration-250 ease-drawer lg:translate-x-0',
          open ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="flex h-16 items-center justify-between gap-3 px-5">
          <div className="flex items-center gap-2.5">
            <img src="/logo.png" alt="" className="size-8" />
            <span className="font-semibold">Magazing</span>
          </div>
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
        <SidebarNav onNavigate={() => setOpen(false)} />
        <UserFooter />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col lg:pl-64">
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

/**
 * Menú en acordeón: cada sección se despliega con su título y solo una queda abierta a la vez
 * (la de la pantalla actual, al navegar). Así el menú entra sin barra de desplazamiento.
 */
function SidebarNav({ onNavigate }: { onNavigate: () => void }) {
  const can = useCan()
  const { pathname } = useLocation()
  const sections = navigationFor(can(P.UsersManage))
    .map((section) => ({ ...section, items: section.items.filter((item) => !item.permission || can(item.permission)) }))
    .filter((section) => section.items.length > 0)

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
        const { items } = section
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
              {items.map((item) => (
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

function UserFooter() {
  const { user } = useSession()
  const navigate = useNavigate()

  async function handleLogout() {
    await logout()
    queryClient.clear()
    navigate('/login', { replace: true })
  }

  if (!user) return null

  return (
    <div className="flex items-center gap-3 border-t border-slate-200 p-4">
      <Link to="/profile" className="flex min-w-0 flex-1 items-center gap-3 rounded-lg p-1 -m-1 hover:bg-slate-50" title="Mi perfil">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-sm font-semibold text-slate-600 uppercase">
          {user.username.slice(0, 2)}
        </div>
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
