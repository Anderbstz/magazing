import { Plus, Search } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { PageHeader } from '@/components/page-header'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Pagination } from '@/components/ui/pagination'
import { LoadingBlock } from '@/components/ui/spinner'
import { EmptyState, ErrorState } from '@/components/ui/states'
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table'
import { P } from '@/config/permissions'
import { Can } from '@/features/auth/guards'
import { useDebouncedValue } from '@/hooks/use-debounced-value'
import { formatDate, formatMoney } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { PurchaseStatus } from '../api'
import { PURCHASE_STATUS } from '../labels'
import { usePurchaseOrders } from '../queries'

const TABS: { value: '' | PurchaseStatus; label: string }[] = [
  { value: '', label: 'Todas' },
  { value: 'DRAFT', label: 'Borrador' },
  { value: 'APPROVED', label: 'Por recibir' },
  { value: 'RECEIVED', label: 'Recibidas' },
  { value: 'CANCELLED', label: 'Canceladas' },
]

export function PurchaseOrdersPage() {
  const [params, setParams] = useSearchParams()
  const status = (params.get('status') ?? '') as '' | PurchaseStatus
  const page = Number(params.get('page') ?? 1)
  const [search, setSearch] = useState('')
  const debounced = useDebouncedValue(search.trim())
  const navigate = useNavigate()
  const orders = usePurchaseOrders({ status: status || undefined, search: debounced || undefined, page, pageSize: 20 })

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

  return (
    <>
      <PageHeader
        title="Órdenes de compra"
        description="Borrador → Aprobada → Recibida. El stock entra recién al recibir."
        actions={
          <Can permission={P.PurchasesCreate}>
            <Link
              to="/purchases/orders/new"
              className="inline-flex h-10 items-center gap-2 rounded-lg bg-brand-700 px-4 text-sm font-medium text-white hover:bg-brand-800"
            >
              <Plus className="size-4" /> Nueva orden
            </Link>
          </Can>
        }
      />

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 p-4">
          <div className="flex flex-wrap rounded-lg bg-slate-100 p-1" role="tablist">
            {TABS.map((t) => (
              <button
                key={t.value}
                type="button"
                role="tab"
                aria-selected={status === t.value}
                onClick={() => setParam('status', t.value)}
                className={cn(
                  'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
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
              placeholder="Código o proveedor"
              className="pl-9"
              aria-label="Buscar órdenes"
            />
          </div>
        </div>

        {orders.isPending ? (
          <LoadingBlock />
        ) : orders.isError ? (
          <ErrorState error={orders.error} onRetry={() => orders.refetch()} />
        ) : orders.data.items.length === 0 ? (
          <EmptyState title="Sin órdenes" />
        ) : (
          <>
            <Table className={orders.isPlaceholderData ? 'opacity-60' : undefined}>
              <THead>
                <tr>
                  <TH>Orden</TH>
                  <TH>Proveedor</TH>
                  <TH className="hidden lg:table-cell">Almacén</TH>
                  <TH className="hidden sm:table-cell">Fecha</TH>
                  <TH className="text-right">Total</TH>
                  <TH>Estado</TH>
                </tr>
              </THead>
              <TBody>
                {orders.data.items.map((po) => (
                  <TR key={po.purchaseOrderId} className="cursor-pointer" onClick={() => navigate(`/purchases/orders/${po.purchaseOrderId}`)}>
                    <TD>
                      <Link to={`/purchases/orders/${po.purchaseOrderId}`} className="font-mono text-sm font-medium text-brand-700 hover:underline">
                        {po.code}
                      </Link>
                      <div className="text-xs text-slate-500">{po.itemCount} productos</div>
                    </TD>
                    <TD className="font-medium text-slate-800">{po.supplierName}</TD>
                    <TD className="hidden lg:table-cell">{po.warehouseName}</TD>
                    <TD className="hidden sm:table-cell">
                      {formatDate(po.orderDate + 'T12:00:00')}
                      {po.expectedDate && po.status === 'APPROVED' && (
                        <div className="text-xs text-slate-500">Llega: {formatDate(po.expectedDate + 'T12:00:00')}</div>
                      )}
                    </TD>
                    <TD className="tabular text-right font-medium">{formatMoney(po.total)}</TD>
                    <TD>
                      <Badge tone={PURCHASE_STATUS[po.status].tone}>{PURCHASE_STATUS[po.status].label}</Badge>
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
            <Pagination page={orders.data.page} totalPages={orders.data.totalPages} totalCount={orders.data.totalCount} onPageChange={(p) => setParam('page', String(p))} />
          </>
        )}
      </Card>
    </>
  )
}
