import { LogOut, Menu, X } from 'lucide-react'
import { useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router'
import { navigation } from '@/app/navigation'
import { logout } from '@/features/auth/session'
import { useCan, useSession } from '@/features/auth/use-auth'
import { queryClient } from '@/lib/query-client'
import { cn } from '@/lib/utils'
import { MocksNotice } from './mocks-notice'

export function AppShell() {
  const [open, setOpen] = useState(false)

  return (
    <div className="flex min-h-full">
      {open && (
        <div className="fixed inset-0 z-30 bg-slate-900/40 lg:hidden" onClick={() => setOpen(false)} aria-hidden />
      )}

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 flex w-64 flex-col bg-white ring-1 ring-slate-200 transition-transform lg:translate-x-0',
          open ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="flex h-16 items-center justify-between gap-3 px-5">
          <div className="flex items-center gap-2.5">
            <div className="flex size-8 items-center justify-center rounded-lg bg-brand-700 text-sm font-bold text-white">M</div>
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
        <MocksNotice />
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
          <span className="font-semibold">Magazing</span>
        </header>

        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

function SidebarNav({ onNavigate }: { onNavigate: () => void }) {
  const can = useCan()

  return (
    <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-2">
      {navigation.map((section, i) => {
        const items = section.items.filter((item) => !item.permission || can(item.permission))
        if (items.length === 0) return null
        return (
          <div key={section.title ?? i}>
            {section.title && (
              <p className="mb-1 px-3 text-xs font-semibold tracking-wide text-slate-400 uppercase">{section.title}</p>
            )}
            <ul className="space-y-0.5">
              {items.map((item) => (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    end={item.to === '/'}
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
      <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-sm font-semibold text-slate-600 uppercase">
        {user.username.slice(0, 2)}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-slate-800">{user.username}</p>
        <p className="truncate text-xs text-slate-500">{user.roles.join(', ') || 'Sin rol'}</p>
      </div>
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
