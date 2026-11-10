import { AlertTriangle, Inbox } from 'lucide-react'
import type { ReactNode } from 'react'
import { Button } from './button'

export function EmptyState({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-16 text-center">
      <Inbox className="size-8 text-slate-300" aria-hidden />
      <p className="font-medium text-slate-700">{title}</p>
      {description && <p className="max-w-sm text-sm text-slate-500">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  )
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const message = error instanceof Error ? error.message : 'Ocurrió un error inesperado.'
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-16 text-center" role="alert">
      <AlertTriangle className="size-8 text-amber-500" aria-hidden />
      <p className="font-medium text-slate-700">No se pudo cargar la información</p>
      <p className="max-w-sm text-sm text-slate-500">{message}</p>
      {onRetry && (
        <Button variant="secondary" size="sm" className="mt-2" onClick={onRetry}>
          Reintentar
        </Button>
      )}
    </div>
  )
}
