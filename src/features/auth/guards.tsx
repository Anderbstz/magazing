import { ShieldX, WifiOff } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import type { Permission } from '@/config/permissions'
import { refreshSession, session } from './session'
import { useCan, useSession } from './use-auth'

/** Protege las rutas privadas: renueva la sesión guardada o manda al login. */
export function RequireAuth() {
  const { status } = useSession()
  const location = useLocation()
  const [failure, setFailure] = useState<{ message: string } | null>(null)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    if (status !== 'loading') return
    let cancelled = false
    refreshSession().catch((error: unknown) => {
      // Si el error fue 401, la sesión ya se limpió y `status` pasa a 'anonymous'.
      if (!cancelled) setFailure({ message: error instanceof Error ? error.message : 'Error desconocido' })
    })
    return () => {
      cancelled = true
    }
  }, [status, attempt])

  if (status === 'loading' && failure) {
    return (
      <SessionError
        message={failure.message}
        onRetry={() => {
          setFailure(null)
          setAttempt((n) => n + 1)
        }}
      />
    )
  }
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

/** El servidor no respondió al renovar la sesión, pero el token sigue guardado: se puede reintentar. */
function SessionError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex min-h-full flex-col items-center justify-center gap-3 p-6 text-center" role="alert">
      <WifiOff className="size-8 text-amber-500" aria-hidden />
      <p className="font-medium text-slate-800">No se pudo conectar con el servidor</p>
      <p className="max-w-sm text-sm text-slate-500">{message}</p>
      <div className="mt-2 flex gap-2">
        <Button onClick={onRetry}>Reintentar</Button>
        <Button
          variant="secondary"
          onClick={() => {
            session.clear()
          }}
        >
          Ir al login
        </Button>
      </div>
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
