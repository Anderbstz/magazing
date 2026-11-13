import { Select } from '@/components/ui/input'
import { useWarehouses } from '../queries'

export function WarehouseSelect({
  value,
  onChange,
  allowAll,
  className,
}: {
  value: string
  onChange: (id: string) => void
  allowAll?: boolean
  className?: string
}) {
  const warehouses = useWarehouses()
  return (
    <Select value={value} onChange={(e) => onChange(e.target.value)} className={className} aria-label="Almacén">
      {allowAll && <option value="">Todos los almacenes</option>}
      {!allowAll && !value && <option value="">Cargando almacenes…</option>}
      {warehouses.data?.map((w) => (
        <option key={w.warehouseId} value={w.warehouseId}>
          {w.code} · {w.name}
        </option>
      ))}
    </Select>
  )
}
