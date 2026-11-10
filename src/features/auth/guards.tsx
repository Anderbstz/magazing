import { ShieldX } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router'
import { Spinner } from '@/components/ui/spinner'
import type { Permission } from '@/config/permissions'
import { refreshSession } from './session'
import { useCan, useSession } from './use-auth'

/** Protege las rutas privadas: renueva la sesión guardada o manda al login. */
export function RequireAuth() {
  const { status } = useSession()
  const location = useLocation()

  useEffect(() => {
    if (status === 'loading') refreshSession().catch(() => undefined)
  }, [status])

  if (status === 'loading') return <SessionLoading />
  if (status === 'anonymous') {
    const from = location.pathname + location.search
    return <Navigate to="/login" replace state={{ from }} />
  }
  return <Outlet />
}

/** Página que exige permisos: si falta alguno muestra "Sin acceso" en vez de la pantalla. */
export function RequirePermission({ permission, children }: { permission: Permission | Permission[]; children?: ReactNode }) {
  const can = useCan()
  if (!can(permission)) return <Forbidden />
  return children ?? <Outlet />
}

/** Muestra `children` solo si el usuario tiene el permiso (para botones y menús). */
export function Can({ permission, children }: { permission: Permission | Permission[]; children: ReactNode }) {
  const can = useCan()
  return can(permission) ? children : null
}

function Forbidden() {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-24 text-center">
      <ShieldX className="size-10 text-slate-300" aria-hidden />
      <h1 className="text-lg font-semibold text-slate-800">Sin acceso</h1>
      <p className="max-w-sm text-sm text-slate-500">
        Tu rol no tiene permiso para ver esta sección. Pide acceso a un administrador.
      </p>
    </div>
  )
}

/** Render gratis se duerme: después de unos segundos se avisa que está despertando. */
function SessionLoading() {
  const [slow, setSlow] = useState(false)

  useEffect(() => {
    const id = setTimeout(() => setSlow(true), 4000)
    return () => clearTimeout(id)
  }, [])

  return (
    <div className="flex min-h-full flex-col items-center justify-center gap-3 p-6 text-center" role="status">
      <Spinner className="size-6 text-brand-700" />
      <p className="text-sm text-slate-600">Conectando con el servidor…</p>
      {slow && (
        <p className="max-w-xs text-xs text-slate-500">
          El servidor estaba en reposo y está despertando. Puede tardar hasta un minuto la primera vez.
        </p>
      )}
    </div>
  )
}
