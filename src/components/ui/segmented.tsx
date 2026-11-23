import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface SegmentedOption<T extends string> {
  value: T
  label: string
  /** Si se define, el botón muestra solo el ícono y `label` queda como texto accesible. */
  icon?: LucideIcon
}

/** Grupo de botones excluyentes (período, tipo de gráfico…). */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
  size = 'md',
}: {
  options: SegmentedOption<T>[]
  value: T
  onChange: (value: T) => void
  label: string
  size?: 'sm' | 'md'
}) {
  return (
    <div role="group" aria-label={label} className="inline-flex flex-wrap rounded-lg bg-slate-100 p-1">
      {options.map((o) => {
        const active = o.value === value
        const Icon = o.icon
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={active}
            title={Icon ? o.label : undefined}
            onClick={() => onChange(o.value)}
            className={cn(
              'inline-flex items-center justify-center rounded-md font-medium transition-colors',
              size === 'sm' ? 'px-2 py-1 text-xs' : 'px-3 py-1.5 text-sm',
              active ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900',
            )}
          >
            {Icon ? (
              <>
                <Icon className="size-4" aria-hidden />
                <span className="sr-only">{o.label}</span>
              </>
            ) : (
              o.label
            )}
          </button>
        )
      })}
    </div>
  )
}
