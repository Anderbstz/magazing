import { useQuery } from '@tanstack/react-query'
import { Plus, X } from 'lucide-react'
import { useState } from 'react'
import { useSearchParams } from 'react-router'
import { PageHeader } from '@/components/page-header'
import { ProductPicker } from '@/components/product-picker'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input, Select } from '@/components/ui/input'
import { Pagination } from '@/components/ui/pagination'
import { LoadingBlock } from '@/components/ui/spinner'
import { EmptyState, ErrorState } from '@/components/ui/states'
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table'
import { P } from '@/config/permissions'
import { Can } from '@/features/auth/guards'
import { productsApi } from '@/features/catalog/api'
import { formatDateTime, formatMoney, formatQuantity } from '@/lib/format'
import type { Movement, MovementCode } from '../api'
import { MOVEMENT_LABELS } from '../labels'
import { AdjustDialog } from '../components/adjust-dialog'
import { WarehouseSelect } from '../components/warehouse-select'
import { useMovements } from '../queries'

/** Kardex: historial de movimientos. Con producto + almacén muestra el saldo corrido. */
export function KardexPage() {
  const [params, setParams] = useSearchParams()
  const productId = params.get('productId') ?? ''
  const warehouseId = params.get('warehouseId') ?? ''
  const type = (params.get('type') ?? '') as '' | MovementCode
  const from = params.get('from') ?? ''
  const to = params.get('to') ?? ''
  const page = Number(params.get('page') ?? 1)
  const [adjustOpen, setAdjustOpen] = useState(false)

  const product = useQuery({
    queryKey: ['products', 'detail', productId],
    queryFn: () => productsApi.get(productId),
    enabled: !!productId,
  })

  const movements = useMovements({
    productId: productId || undefined,
    warehouseId: warehouseId || undefined,
    type: type || undefined,
    from: from || undefined,
    to: to || undefined,
    page,
    pageSize: 25,
  })

  function setParam(key: string, value: string) {
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        if (value) next.set(key, value)
        else next.delete(key)
        if (key !== 'page') next.delete('page')
        return next
      },
      { replace: true },
    )
  }

  const single = !!productId

  return (
    <>
      <PageHeader
        title="Kardex"
        description="Cada entrada y salida de inventario. El saldo y el costo promedio se registran en cada movimiento."
        actions={
          <Can permission={P.InventoryAdjust}>
            <Button onClick={() => setAdjustOpen(true)}>
              <Plus className="size-4" /> Ajuste
            </Button>
          </Can>
        }
      />

      <Card>
        <div className="grid gap-3 border-b border-slate-200 p-4 md:grid-cols-2 xl:grid-cols-[2fr_1fr_1fr_auto_auto]">
          {productId ? (
            <div className="flex h-10 items-center justify-between gap-2 rounded-lg bg-brand-50 px-3 text-sm ring-1 ring-brand-200">
              <span className="truncate font-medium text-brand-900">{product.data?.name ?? 'Cargando…'}</span>
              <button type="button" onClick={() => setParam('productId', '')} className="text-brand-700 hover:text-brand-900" aria-label="Quitar filtro de producto">
                <X className="size-4" />
              </button>
            </div>
          ) : (
            <ProductPicker show="cost" placeholder="Filtrar por producto…" onSelect={(p) => setParam('productId', p.productId)} />
          )}
          <WarehouseSelect allowAll value={warehouseId} onChange={(id) => setParam('warehouseId', id)} />
          <Select value={type} onChange={(e) => setParam('type', e.target.value)} aria-label="Tipo de movimiento">
            <option value="">Todos los tipos</option>
            {Object.entries(MOVEMENT_LABELS).map(([code, label]) => (
              <option key={code} value={code}>
                {label}
              </option>
            ))}
          </Select>
          <Input type="date" value={from} max={to || undefined} onChange={(e) => setParam('from', e.target.value)} aria-label="Desde" />
          <Input type="date" value={to} min={from || undefined} onChange={(e) => setParam('to', e.target.value)} aria-label="Hasta" />
        </div>

        {movements.isPending ? (
          <LoadingBlock />
        ) : movements.isError ? (
          <ErrorState error={movements.error} onRetry={() => movements.refetch()} />
        ) : movements.data.items.length === 0 ? (
          <EmptyState title="Sin movimientos" description="Prueba con otro rango de fechas o tipo." />
        ) : (
          <>
            <Table className={movements.isPlaceholderData ? 'opacity-60' : undefined}>
              <THead>
                <tr>
                  <TH>Fecha</TH>
                  {!single && <TH>Producto</TH>}
                  <TH className="hidden sm:table-cell">Almacén</TH>
                  <TH>Movimiento</TH>
                  <TH className="text-right">Entrada</TH>
                  <TH className="text-right">Salida</TH>
                  <TH className="text-right">Saldo</TH>
                  <TH className="hidden text-right lg:table-cell">Costo unit.</TH>
                  <TH className="hidden text-right lg:table-cell">Costo prom.</TH>
                  <TH className="hidden xl:table-cell">Usuario</TH>
                </tr>
              </THead>
              <TBody>
                {movements.data.items.map((m) => (
                  <MovementRow key={m.inventoryMovementId} m={m} showProduct={!single} />
                ))}
              </TBody>
            </Table>
            <Pagination
              page={movements.data.page}
              totalPages={movements.data.totalPages}
              totalCount={movements.data.totalCount}
              onPageChange={(p) => setParam('page', String(p))}
            />
          </>
        )}
      </Card>

      {adjustOpen && (
        <AdjustDialog
          target={
            product.data && warehouseId
              ? { productId: product.data.productId, productName: product.data.name, unitCode: product.data.unitCode, warehouseId }
              : null
          }
          onClose={() => setAdjustOpen(false)}
        />
      )}
    </>
  )
}

function MovementRow({ m, showProduct }: { m: Movement; showProduct: boolean }) {
  const isIn = m.direction === 1
  return (
    <TR>
      <TD className="whitespace-nowrap text-xs">{formatDateTime(m.createdAt)}</TD>
      {showProduct && (
        <TD>
          <div className="font-medium text-slate-900">{m.productName}</div>
          <div className="text-xs text-slate-500">{m.sku}</div>
        </TD>
      )}
      <TD className="hidden sm:table-cell">{m.warehouseCode}</TD>
      <TD>
        <Badge tone={isIn ? 'success' : 'danger'}>{MOVEMENT_LABELS[m.movementTypeCode]}</Badge>
        {m.referenceCode && <div className="mt-0.5 font-mono text-[11px] text-slate-500">{m.referenceCode}</div>}
        {m.notes && <div className="mt-0.5 max-w-56 truncate text-xs text-slate-500" title={m.notes}>{m.notes}</div>}
      </TD>
      <TD className="tabular text-right text-emerald-700">{isIn ? formatQuantity(m.quantity) : ''}</TD>
      <TD className="tabular text-right text-red-700">{isIn ? '' : formatQuantity(m.quantity)}</TD>
      <TD className="tabular text-right font-semibold text-slate-900">{formatQuantity(m.balanceAfter)}</TD>
      <TD className="tabular hidden text-right lg:table-cell">{formatMoney(m.unitCost)}</TD>
      <TD className="tabular hidden text-right lg:table-cell">{formatMoney(m.averageCostAfter)}</TD>
      <TD className="hidden text-xs xl:table-cell">{m.createdByName}</TD>
    </TR>
  )
}
