import { LoaderCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

export function Spinner({ className }: { className?: string }) {
  return <LoaderCircle aria-hidden className={cn('size-5 animate-[spin_0.7s_linear_infinite]', className)} />
}

/** Bloque de carga a ancho completo, para el contenido de una página o tabla. */
export function LoadingBlock({ label = 'Cargando…' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-16 text-sm text-slate-500" role="status">
      <Spinner />
      {label}
    </div>
  )
}
