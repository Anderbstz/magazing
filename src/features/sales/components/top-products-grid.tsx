import { Flame } from 'lucide-react'
import type { Product } from '@/features/catalog/api'
import { formatMoney, formatQuantity } from '@/lib/format'
import { cn } from '@/lib/utils'
import { usePosTopProducts } from '../queries'

/**
 * Accesos rápidos del punto de venta: los más vendidos de los últimos 30 días, con su stock en el
 * almacén elegido. Un clic agrega una unidad; el resto de productos se busca o se escanea.
 */
export function TopProductsGrid({ warehouseId, inCart, onSelect }: { warehouseId: string; inCart: Map<string, number>; onSelect: (p: Product) => void }) {
  const top = usePosTopProducts(warehouseId)

  if (top.isPending) {
    return (
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4" aria-hidden>
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} className="h-[76px] animate-pulse rounded-lg bg-slate-100" />
        ))}
      </div>
    )
  }

  if (top.isError || !top.data?.length) return null

  const hasSales = top.data.some((p) => p.quantitySold > 0)

  return (
    <section aria-label="Más vendidos">
      <h2 className="mb-2 flex items-center gap-1.5 text-xs font-medium tracking-wide text-slate-500 uppercase">
        <Flame className="size-3.5 text-amber-500" aria-hidden />
        {hasSales ? 'Más vendidos · últimos 30 días' : 'Accesos rápidos'}
      </h2>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
        {top.data.map(({ product, stock }) => {
          const qty = inCart.get(product.productId) ?? 0
          const out = stock <= 0
          return (
            <button
              key={product.productId}
              type="button"
              disabled={out}
              onClick={() => onSelect(product)}
              title={out ? 'Sin stock en este almacén' : `Agregar ${product.name}`}
              className={cn(
                'pressable relative flex min-h-[76px] flex-col justify-between rounded-lg bg-white p-2.5 text-left ring-1 transition-colors',
                out ? 'cursor-not-allowed opacity-50 ring-slate-200' : 'ring-slate-200 hover:bg-brand-50/60 hover:ring-brand-300',
                qty > 0 && 'ring-2 ring-brand-500',
              )}
            >
              <span className="line-clamp-2 pr-5 text-sm leading-snug font-medium text-slate-900">{product.name}</span>
              <span className="mt-1 flex flex-wrap items-end justify-between gap-x-2 text-xs">
                <span className="tabular font-semibold text-slate-800">{formatMoney(product.currentPrice)}</span>
                <span className={cn('tabular whitespace-nowrap', out ? 'text-red-600' : stock <= product.minStock ? 'text-amber-700' : 'text-slate-500')}>
                  {out ? 'Sin stock' : `Stock ${formatQuantity(stock)}`}
                </span>
              </span>
              {qty > 0 && (
                <span className="tabular absolute top-1.5 right-1.5 flex size-5 items-center justify-center rounded-full bg-brand-700 text-[11px] font-semibold text-white">
                  {formatQuantity(qty)}
                </span>
              )}
            </button>
          )
        })}
      </div>
    </section>
  )
}
