import { useQuery } from '@tanstack/react-query'
import { Search } from 'lucide-react'
import { useId, useState, type KeyboardEvent } from 'react'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { productsApi, type Product } from '@/features/catalog/api'
import { useDebouncedValue } from '@/hooks/use-debounced-value'
import { formatMoney } from '@/lib/format'
import { cn } from '@/lib/utils'

interface ProductPickerProps {
  onSelect: (product: Product) => void
  placeholder?: string
  /** IDs ya agregados: se muestran deshabilitados. */
  excludeIds?: string[]
  /** Muestra el precio de venta (punto de venta) o el costo promedio (compras). */
  show?: 'price' | 'cost'
  autoFocus?: boolean
  className?: string
}

/**
 * Buscador de productos con teclado (↑ ↓ Enter Esc). Busca en la API real de productos
 * por nombre, SKU o código de barras; con un lector de códigos, el Enter agrega directo.
 */
export function ProductPicker({ onSelect, placeholder, excludeIds = [], show = 'price', autoFocus, className }: ProductPickerProps) {
  const [term, setTerm] = useState('')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const debounced = useDebouncedValue(term.trim(), 200)
  const listId = useId()

  const results = useQuery({
    queryKey: ['products', 'picker', debounced],
    queryFn: () => productsApi.list({ search: debounced, isActive: true, pageSize: 8 }),
    enabled: debounced.length > 0,
    staleTime: 30_000,
  })

  const items = results.data?.items ?? []

  function pick(product: Product) {
    if (excludeIds.includes(product.productId)) return
    onSelect(product)
    setTerm('')
    setOpen(false)
    setActive(0)
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setOpen(true)
      setActive((i) => Math.min(i + 1, items.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      // Código de barras exacto: se agrega aunque la lista no esté abierta.
      const exact = items.find((p) => p.barcode === term.trim() || p.sku.toLowerCase() === term.trim().toLowerCase())
      const chosen = exact ?? items[active]
      if (chosen) pick(chosen)
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  const showList = open && debounced.length > 0

  return (
    <div className={cn('relative', className)}>
      <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" />
      <Input
        value={term}
        autoFocus={autoFocus}
        onChange={(e) => {
          setTerm(e.target.value)
          setOpen(true)
          setActive(0)
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={onKeyDown}
        placeholder={placeholder ?? 'Buscar producto por nombre, SKU o código de barras'}
        className="pl-9"
        role="combobox"
        aria-expanded={showList}
        aria-controls={listId}
        aria-autocomplete="list"
      />
      {results.isFetching && <Spinner className="absolute top-1/2 right-3 size-4 -translate-y-1/2 text-slate-400" />}

      {showList && (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-20 mt-1 max-h-80 w-full overflow-auto rounded-lg bg-white py-1 text-sm shadow-lg ring-1 ring-slate-200"
        >
          {results.isPending ? (
            <li className="px-3 py-2 text-slate-500">Buscando…</li>
          ) : items.length === 0 ? (
            <li className="px-3 py-2 text-slate-500">Sin resultados</li>
          ) : (
            items.map((p, i) => {
              const added = excludeIds.includes(p.productId)
              return (
                <li
                  key={p.productId}
                  role="option"
                  aria-selected={i === active}
                  aria-disabled={added}
                  onMouseDown={(e) => e.preventDefault()}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => pick(p)}
                  className={cn(
                    'flex cursor-pointer items-center justify-between gap-3 px-3 py-2',
                    i === active && 'bg-brand-50',
                    added && 'cursor-not-allowed opacity-50',
                  )}
                >
                  <span className="min-w-0">
                    <span className="block truncate font-medium text-slate-800">{p.name}</span>
                    <span className="block text-xs text-slate-500">
                      {p.sku} · {p.unitCode}
                      {added && ' · ya agregado'}
                    </span>
                  </span>
                  <span className="tabular shrink-0 text-slate-600">
                    {show === 'price' ? formatMoney(p.currentPrice) : formatMoney(p.averageCost)}
                  </span>
                </li>
              )
            })
          )}
        </ul>
      )}
    </div>
  )
}
