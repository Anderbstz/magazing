import { Plus, Printer, Search } from 'lucide-react'
import { useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { PageHeader } from '@/components/page-header'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Dialog } from '@/components/ui/dialog'
import { Field } from '@/components/ui/field'
import { Input, Select, Textarea } from '@/components/ui/input'
import { Pagination } from '@/components/ui/pagination'
import { LoadingBlock } from '@/components/ui/spinner'
import { EmptyState, ErrorState } from '@/components/ui/states'
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table'
import { P } from '@/config/permissions'
import { Can } from '@/features/auth/guards'
import { useCan } from '@/features/auth/use-auth'
import { useDebouncedValue } from '@/hooks/use-debounced-value'
import { formatDateTime, formatMoney } from '@/lib/format'
import type { InvoiceType, SaleStatus } from '../api'
import { Receipt } from '../components/receipt'
import { useCancelSale, useSale, useSales } from '../queries'

export function SalesPage() {
  const [params, setParams] = useSearchParams()
  const status = (params.get('status') ?? '') as '' | SaleStatus
  const documentType = (params.get('documentType') ?? '') as '' | InvoiceType
  const from = params.get('from') ?? ''
  const to = params.get('to') ?? ''
  const page = Number(params.get('page') ?? 1)
  const [search, setSearch] = useState('')
  const debounced = useDebouncedValue(search.trim())
  const [viewing, setViewing] = useState<string | null>(null)

  const sales = useSales({
    status: status || undefined,
    documentType: documentType || undefined,
    from: from || undefined,
    to: to || undefined,
    search: debounced || undefined,
    page,
    pageSize: 20,
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

  return (
    <>
      <PageHeader
        title="Ventas"
        description="Historial de ventas y comprobantes emitidos."
        actions={
          <Can permission={P.SalesCreate}>
            <Link to="/sales/pos" className="inline-flex h-10 items-center gap-2 rounded-lg bg-brand-700 px-4 text-sm font-medium text-white hover:bg-brand-800">
              <Plus className="size-4" /> Nueva venta
            </Link>
          </Can>
        }
      />

      <Card>
        <div className="grid gap-3 border-b border-slate-200 p-4 sm:grid-cols-2 xl:grid-cols-[2fr_1fr_1fr_auto_auto]">
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" />
            <Input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setParam('page', '')
              }}
              placeholder="N.º de comprobante, cliente o documento"
              className="pl-9"
              aria-label="Buscar ventas"
            />
          </div>
          <Select value={documentType} onChange={(e) => setParam('documentType', e.target.value)} aria-label="Comprobante">
            <option value="">Boletas y facturas</option>
            <option value="BOLETA">Boletas</option>
            <option value="FACTURA">Facturas</option>
          </Select>
          <Select value={status} onChange={(e) => setParam('status', e.target.value)} aria-label="Estado">
            <option value="">Todos los estados</option>
            <option value="COMPLETED">Completadas</option>
            <option value="CANCELLED">Anuladas</option>
          </Select>
          <Input type="date" value={from} max={to || undefined} onChange={(e) => setParam('from', e.target.value)} aria-label="Desde" />
          <Input type="date" value={to} min={from || undefined} onChange={(e) => setParam('to', e.target.value)} aria-label="Hasta" />
        </div>

        {sales.isPending ? (
          <LoadingBlock />
        ) : sales.isError ? (
          <ErrorState error={sales.error} onRetry={() => sales.refetch()} />
        ) : sales.data.items.length === 0 ? (
          <EmptyState title="Sin ventas" description="Prueba con otro rango de fechas." />
        ) : (
          <>
            <Table className={sales.isPlaceholderData ? 'opacity-60' : undefined}>
              <THead>
                <tr>
                  <TH>Comprobante</TH>
                  <TH>Cliente</TH>
                  <TH className="hidden md:table-cell">Fecha</TH>
                  <TH className="hidden lg:table-cell">Pago</TH>
                  <TH className="text-right">Total</TH>
                  <TH>Estado</TH>
                </tr>
              </THead>
              <TBody>
                {sales.data.items.map((s) => (
                  <TR key={s.saleId} className="cursor-pointer" onClick={() => setViewing(s.saleId)}>
                    <TD>
                      <button type="button" className="font-mono text-sm font-medium text-brand-700 hover:underline" onClick={() => setViewing(s.saleId)}>
                        {s.fullNumber}
                      </button>
                      <div className="text-xs text-slate-500">{s.documentType === 'FACTURA' ? 'Factura' : 'Boleta'}</div>
                    </TD>
                    <TD>
                      <div className="font-medium text-slate-800">{s.customerName}</div>
                      <div className="font-mono text-xs text-slate-500">
                        {s.customerDocumentType} {s.customerDocumentNumber}
                      </div>
                    </TD>
                    <TD className="hidden text-xs md:table-cell">
                      {formatDateTime(s.soldAt)}
                      <div className="text-slate-500">{s.sellerName}</div>
                    </TD>
                    <TD className="hidden text-xs lg:table-cell">{s.paymentMethods.join(', ')}</TD>
                    <TD className={s.status === 'CANCELLED' ? 'tabular text-right text-slate-400 line-through' : 'tabular text-right font-medium'}>
                      {formatMoney(s.total)}
                    </TD>
                    <TD>
                      <Badge tone={s.status === 'COMPLETED' ? 'success' : 'danger'}>{s.status === 'COMPLETED' ? 'Completada' : 'Anulada'}</Badge>
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
            <Pagination page={sales.data.page} totalPages={sales.data.totalPages} totalCount={sales.data.totalCount} onPageChange={(p) => setParam('page', String(p))} />
          </>
        )}
      </Card>

      {viewing && <SaleDialog id={viewing} onClose={() => setViewing(null)} />}
    </>
  )
}

function SaleDialog({ id, onClose }: { id: string; onClose: () => void }) {
  const sale = useSale(id)
  const cancel = useCancelSale()
  const can = useCan()
  const [cancelling, setCancelling] = useState(false)
  const [reason, setReason] = useState('')

  const s = sale.data
  const canCancel = s?.status === 'COMPLETED' && can(P.SalesCancel)

  return (
    <Dialog
      open
      onClose={onClose}
      title={s ? s.fullNumber : 'Venta'}
      description={s ? `${s.warehouseName} · ${s.sellerName}` : undefined}
      footer={
        <>
          {canCancel && (
            <Button variant="danger" onClick={() => setCancelling(true)}>
              Anular venta
            </Button>
          )}
          <Button variant="secondary" onClick={() => window.print()} disabled={!s}>
            <Printer className="size-4" /> Reimprimir
          </Button>
        </>
      }
    >
      {sale.isPending ? (
        <LoadingBlock />
      ) : sale.isError ? (
        <ErrorState error={sale.error} onRetry={() => sale.refetch()} />
      ) : (
        <>
          {s!.status === 'CANCELLED' && (
            <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800 ring-1 ring-red-200">
              Anulada el {formatDateTime(s!.cancelledAt)} · Motivo: {s!.cancelReason}
            </p>
          )}
          <div className="rounded-lg bg-slate-50 p-4 ring-1 ring-slate-200">
            <Receipt sale={s!} />
          </div>
        </>
      )}

      {cancelling && s && (
        <Dialog
          open
          onClose={() => setCancelling(false)}
          title={`Anular ${s.fullNumber}`}
          description="El stock regresa al almacén y el comprobante queda anulado. No se puede deshacer."
          footer={
            <>
              <Button variant="secondary" onClick={() => setCancelling(false)} disabled={cancel.isPending}>
                Volver
              </Button>
              <Button
                variant="danger"
                loading={cancel.isPending}
                disabled={reason.trim().length < 5}
                onClick={() => cancel.mutate({ id: s.saleId, reason: reason.trim() }, { onSuccess: () => setCancelling(false) })}
              >
                Anular
              </Button>
            </>
          }
        >
          <Field label="Motivo" htmlFor="cancel-reason" required hint="Mínimo 5 caracteres.">
            <Textarea id="cancel-reason" autoFocus rows={3} maxLength={255} value={reason} onChange={(e) => setReason(e.target.value)} />
          </Field>
        </Dialog>
      )}
    </Dialog>
  )
}
