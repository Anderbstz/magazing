import { AlertTriangle, Boxes, PackageX, Plus, ScrollText, Search, SlidersHorizontal, Wallet } from 'lucide-react'
import { useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { PageHeader } from '@/components/page-header'
import { StatCard } from '@/components/stat-card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Pagination } from '@/components/ui/pagination'
import { LoadingBlock } from '@/components/ui/spinner'
import { EmptyState, ErrorState } from '@/components/ui/states'
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table'
import { P } from '@/config/permissions'
import { Can } from '@/features/auth/guards'
import { useDebouncedValue } from '@/hooks/use-debounced-value'
import { formatMoney, formatQuantity } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { StockItem, StockStatus } from '../api'
import { AdjustDialog, type AdjustTarget } from '../components/adjust-dialog'
import { WarehouseSelect } from '../components/warehouse-select'
import { useStocks, useStockSummary, useWarehouses } from '../queries'

const STATUS: Record<StockStatus, { label: string; tone: 'success' | 'warning' | 'danger' }> = {
  OK: { label: 'Normal', tone: 'success' },
  LOW: { label: 'Bajo mínimo', tone: 'warning' },
  OUT: { label: 'Sin stock', tone: 'danger' },
}

const TABS: { value: '' | StockStatus; label: string }[] = [
  { value: '', label: 'Todos' },
  { value: 'LOW', label: 'Bajo mínimo' },
  { value: 'OUT', label: 'Sin stock' },
]

export function StockPage() {
  const [params, setParams] = useSearchParams()
  const warehouses = useWarehouses()
  const warehouseId = params.get('warehouseId') ?? warehouses.data?.[0]?.warehouseId ?? ''
  const status = (params.get('status') ?? '') as '' | StockStatus
  const page = Number(params.get('page') ?? 1)
  const [search, setSearch] = useState('')
  const debounced = useDebouncedValue(search.trim())

  const stocks = useStocks(
    warehouseId ? { warehouseId, status: status || undefined, search: debounced || undefined, page, pageSize: 20 } : null,
  )
  const summary = useStockSummary(warehouseId || undefined)
  const [adjusting, setAdjusting] = useState<AdjustTarget | null>(null)
  const [adjustOpen, setAdjustOpen] = useState(false)

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

  function openAdjust(row: StockItem | null) {
    setAdjusting(
      row
        ? { productId: row.productId, productName: row.productName, unitCode: row.unitCode, warehouseId: row.warehouseId, currentStock: row.quantity }
        : null,
    )
    setAdjustOpen(true)
  }

  return (
    <>
      <PageHeader
        title="Stock"
        description="Existencias por almacén, valorizadas al costo promedio ponderado."
        actions={
          <>
            <WarehouseSelect value={warehouseId} onChange={(id) => setParam('warehouseId', id)} className="w-64" />
            <Can permission={P.InventoryAdjust}>
              <Button onClick={() => openAdjust(null)}>
                <Plus className="size-4" /> Ajuste
              </Button>
            </Can>
          </>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Valor del inventario" icon={Wallet} loading={summary.isPending} value={formatMoney(summary.data?.totalValue)} detail="Al costo promedio, sin IGV" />
        <StatCard label="Productos" icon={Boxes} tone="sky" loading={summary.isPending} value={summary.data?.productCount ?? '—'} detail={`${formatQuantity(summary.data?.totalUnits)} unidades`} />
        <StatCard label="Bajo mínimo" icon={AlertTriangle} tone="amber" loading={summary.isPending} value={summary.data?.lowCount ?? '—'} />
        <StatCard label="Sin stock" icon={PackageX} tone="red" loading={summary.isPending} value={summary.data?.outCount ?? '—'} />
      </div>

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 p-4">
          <div className="flex rounded-lg bg-slate-100 p-1" role="tablist" aria-label="Filtrar por estado">
            {TABS.map((t) => (
              <button
                key={t.value}
                type="button"
                role="tab"
                aria-selected={status === t.value}
                onClick={() => setParam('status', t.value)}
                className={cn(
                  'pressable rounded-md px-3 py-1.5 text-sm font-medium',
                  status === t.value ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900',
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
          <div className="relative w-full max-w-xs">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" />
            <Input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setParam('page', '')
              }}
              placeholder="Buscar producto o SKU"
              className="pl-9"
              aria-label="Buscar producto"
            />
          </div>
        </div>

        {stocks.isPending ? (
          <LoadingBlock />
        ) : stocks.isError ? (
          <ErrorState error={stocks.error} onRetry={() => stocks.refetch()} />
        ) : stocks.data.items.length === 0 ? (
          <EmptyState title="Sin resultados" description={status ? 'Ningún producto en este estado. ¡Bien!' : undefined} />
        ) : (
          <>
            <Table className={stocks.isPlaceholderData ? 'opacity-60' : undefined}>
              <THead>
                <tr>
                  <TH>Producto</TH>
                  <TH className="hidden md:table-cell">Categoría</TH>
                  <TH className="text-right">Stock</TH>
                  <TH className="hidden text-right sm:table-cell">Mínimo</TH>
                  <TH className="hidden text-right lg:table-cell">Costo prom.</TH>
                  <TH className="text-right">Valor</TH>
                  <TH>Estado</TH>
                  <TH className="w-px" />
                </tr>
              </THead>
              <TBody>
                {stocks.data.items.map((s) => (
                  <TR key={s.productId}>
                    <TD>
                      <div className="font-medium text-slate-900">{s.productName}</div>
                      <div className="text-xs text-slate-500">{s.sku}</div>
                    </TD>
                    <TD className="hidden md:table-cell">{s.categoryName}</TD>
                    <TD className="tabular text-right font-semibold text-slate-900">
                      {formatQuantity(s.quantity)} <span className="text-xs font-normal text-slate-500">{s.unitCode}</span>
                    </TD>
                    <TD className="tabular hidden text-right sm:table-cell">{formatQuantity(s.minStock)}</TD>
                    <TD className="tabular hidden text-right lg:table-cell">{formatMoney(s.averageCost)}</TD>
                    <TD className="tabular text-right">{formatMoney(s.stockValue)}</TD>
                    <TD>
                      <Badge tone={STATUS[s.status].tone}>{STATUS[s.status].label}</Badge>
                    </TD>
                    <TD>
                      <div className="flex justify-end gap-1">
                        <Link
                          to={`/inventory/kardex?productId=${s.productId}&warehouseId=${s.warehouseId}`}
                          className="inline-flex size-9 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100"
                          title="Ver kardex"
                          aria-label={`Kardex de ${s.productName}`}
                        >
                          <ScrollText className="size-4" />
                        </Link>
                        <Can permission={P.InventoryAdjust}>
                          <Button variant="ghost" size="icon" title="Ajustar" aria-label={`Ajustar ${s.productName}`} onClick={() => openAdjust(s)}>
                            <SlidersHorizontal className="size-4" />
                          </Button>
                        </Can>
                      </div>
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
            <Pagination
              page={stocks.data.page}
              totalPages={stocks.data.totalPages}
              totalCount={stocks.data.totalCount}
              onPageChange={(p) => setParam('page', String(p))}
            />
          </>
        )}
      </Card>

      {adjustOpen && <AdjustDialog target={adjusting} onClose={() => setAdjustOpen(false)} />}
    </>
  )
}
