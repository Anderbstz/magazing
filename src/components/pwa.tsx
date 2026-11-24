import { RefreshCw, WifiOff, X } from 'lucide-react'
import { useSyncExternalStore } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { Button } from '@/components/ui/button'

/** Cada cuánto se revisa si hay una versión nueva desplegada (además de al abrir la app). */
const UPDATE_CHECK_MS = 30 * 60 * 1000

/**
 * Registra el service worker y avisa cuando hay una versión nueva. No se actualiza solo: si el
 * usuario está a mitad de una venta, recargar sin avisar le haría perder lo que estaba haciendo.
 */
export function PwaUpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, registration) {
      if (registration) setInterval(() => registration.update(), UPDATE_CHECK_MS)
    },
  })

  if (!needRefresh) return null

  return (
    <div role="status" className="pop-in fixed right-4 bottom-4 z-[60] flex max-w-sm items-center gap-3 rounded-xl bg-white p-4 shadow-lg ring-1 ring-slate-200">
      <RefreshCw className="size-5 shrink-0 text-brand-700" aria-hidden />
      <div className="min-w-0 flex-1 text-sm">
        <p className="font-medium text-slate-900">Hay una versión nueva</p>
        <p className="text-slate-500">Guarda lo que estés haciendo y actualiza.</p>
      </div>
      <Button size="sm" onClick={() => updateServiceWorker(true)}>
        Actualizar
      </Button>
      <button type="button" onClick={() => setNeedRefresh(false)} className="rounded-md p-1 text-slate-400 hover:bg-slate-100" aria-label="Más tarde">
        <X className="size-4" />
      </button>
    </div>
  )
}

function subscribeOnline(listener: () => void) {
  window.addEventListener('online', listener)
  window.addEventListener('offline', listener)
  return () => {
    window.removeEventListener('online', listener)
    window.removeEventListener('offline', listener)
  }
}

/** Aviso fijo mientras no haya conexión: Magazing no registra ventas ni movimientos sin internet. */
export function OfflineBanner() {
  const online = useSyncExternalStore(subscribeOnline, () => navigator.onLine, () => true)
  if (online) return null

  return (
    <div role="alert" className="fixed inset-x-0 top-0 z-[60] flex items-center justify-center gap-2 bg-amber-500 px-4 py-2 text-sm font-medium text-amber-950">
      <WifiOff className="size-4 shrink-0" aria-hidden />
      Sin conexión: Magazing necesita internet para registrar ventas y movimientos.
    </div>
  )
}
