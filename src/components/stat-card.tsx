import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'

const tones = {
  brand: 'bg-brand-50 text-brand-700',
  amber: 'bg-amber-50 text-amber-700',
  red: 'bg-red-50 text-red-700',
  sky: 'bg-sky-50 text-sky-700',
  slate: 'bg-slate-100 text-slate-600',
} as const

/** Indicador: etiqueta, valor grande y un detalle opcional. */
export function StatCard({
  label,
  value,
  detail,
  icon: Icon,
  tone = 'brand',
  loading,
}: {
  label: string
  value: ReactNode
  detail?: ReactNode
  icon: LucideIcon
  tone?: keyof typeof tones
  loading?: boolean
}) {
  return (
    <Card className="flex items-start gap-4 p-5">
      <div className={cn('flex size-10 shrink-0 items-center justify-center rounded-lg', tones[tone])}>
        <Icon className="size-5" aria-hidden />
      </div>
      <div className="min-w-0">
        <p className="text-sm text-slate-500">{label}</p>
        {loading ? (
          <div className="mt-1.5 h-7 w-24 animate-pulse rounded bg-slate-100" />
        ) : (
          <p className="tabular mt-0.5 truncate text-2xl font-semibold tracking-tight text-slate-900">{value}</p>
        )}
        {detail && !loading && <p className="mt-0.5 text-xs text-slate-500">{detail}</p>}
      </div>
    </Card>
  )
}
