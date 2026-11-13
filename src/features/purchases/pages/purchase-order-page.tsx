import { ArrowLeft, Check, CheckCircle2, Circle, PackageCheck, Pencil, XCircle } from 'lucide-react'
import { useState } from 'react'
import { Link, useParams } from 'react-router'
import { PageHeader } from '@/components/page-header'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardHeader } from '@/components/ui/card'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { LoadingBlock } from '@/components/ui/spinner'
import { ErrorState } from '@/components/ui/states'
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table'
import { P } from '@/config/permissions'
import { useCan } from '@/features/auth/use-auth'
import { formatDate, formatDateTime, formatMoney, formatQuantity } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { PurchaseOrderDetail } from '../api'
import { PURCHASE_STATUS } from '../labels'
import { usePurchaseOrder, usePurchaseTransition } from '../queries'

type Action = 'approve' | 'receive' | 'cancel'

const CONFIRM: Record<Action, { title: string; message: string; label: string }> = {
  approve: { title: 'Aprobar orden', message: 'La orden queda lista para recibir la mercadería. Ya no se podrá editar.', label: 'Aprobar' },
  receive: {
    title: 'Recibir mercadería',
    message: 'Se registrará el ingreso en el kardex, subirá el stock y se recalculará el costo promedio ponderado. No se puede deshacer.',
    label: 'Recibir',
  },
  cancel: { title: 'Cancelar orden', message: 'La orden quedará cancelada y no moverá stock.', label: 'Cancelar orden' },
}

export function PurchaseOrderPage() {
  const { id } = useParams()
  const order = usePurchaseOrder(id)
  const transition = usePurchaseTransition()
  const can = useCan()
  const [confirm, setConfirm] = useState<Action | null>(null)

  if (order.isPending) return <LoadingBlock />
  if (order.isError) return <ErrorState error={order.error} onRetry={() => order.refetch()} />
  const po = order.data

  const actions = {
    edit: po.status === 'DRAFT' && can(P.PurchasesCreate),
    approve: po.status === 'DRAFT' && can(P.PurchasesApprove),
    receive: po.status === 'APPROVED' && can(P.PurchasesReceive),
    cancel: (po.status === 'DRAFT' || po.status === 'APPROVED') && can(P.PurchasesApprove),
  }

  return (
    <>
      <Link to="/purchases/orders" className="mb-3 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800">
        <ArrowLeft className="size-4" /> Órdenes de compra
      </Link>
      <PageHeader
        title={`Orden ${po.code}`}
        description={`${po.supplierName} · RUC ${po.supplierRuc}`}
        actions={
          <>
            {actions.cancel && (
              <Button variant="secondary" onClick={() => setConfirm('cancel')}>
                <XCircle className="size-4" /> Cancelar
              </Button>
            )}
            {actions.edit && (
              <Link
                to={`/purchases/orders/${po.purchaseOrderId}/edit`}
                className="inline-flex h-10 items-center gap-2 rounded-lg bg-white px-4 text-sm font-medium text-slate-800 ring-1 ring-slate-300 ring-inset hover:bg-slate-50"
              >
                <Pencil className="size-4" /> Editar
              </Link>
            )}
            {actions.approve && (
              <Button onClick={() => setConfirm('approve')}>
                <Check className="size-4" /> Aprobar
              </Button>
            )}
            {actions.receive && (
              <Button onClick={() => setConfirm('receive')}>
                <PackageCheck className="size-4" /> Recibir mercadería
              </Button>
            )}
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <Card>
          <CardHeader title="Productos" description={`Destino: ${po.warehouseName}`} />
          <Table>
            <THead>
              <tr>
                <TH>Producto</TH>
                <TH className="text-right">Cantidad</TH>
                <TH className="text-right">Costo unit.</TH>
                <TH className="text-right">Subtotal</TH>
              </tr>
            </THead>
            <TBody>
              {po.items.map((i) => (
                <TR key={i.productId}>
                  <TD>
                    <div className="font-medium text-slate-900">{i.productName}</div>
                    <div className="text-xs text-slate-500">{i.sku}</div>
                  </TD>
                  <TD className="tabular text-right">
                    {formatQuantity(i.quantity)} {i.unitCode}
                  </TD>
                  <TD className="tabular text-right">{formatMoney(i.unitCost)}</TD>
                  <TD className="tabular text-right">{formatMoney(i.subtotal)}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
          <dl className="space-y-1.5 border-t border-slate-200 px-5 py-4 text-sm">
            <div className="flex justify-end gap-8">
              <dt className="text-slate-500">Subtotal</dt>
              <dd className="tabular w-28 text-right">{formatMoney(po.subtotal)}</dd>
            </div>
            <div className="flex justify-end gap-8">
              <dt className="text-slate-500">IGV (18%)</dt>
              <dd className="tabular w-28 text-right">{formatMoney(po.taxAmount)}</dd>
            </div>
            <div className="flex justify-end gap-8 text-base font-semibold">
              <dt>Total</dt>
              <dd className="tabular w-28 text-right">{formatMoney(po.total)}</dd>
            </div>
          </dl>
        </Card>

        <div className="space-y-4">
          <Card className="p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-semibold text-slate-900">Estado</h2>
              <Badge tone={PURCHASE_STATUS[po.status].tone}>{PURCHASE_STATUS[po.status].label}</Badge>
            </div>
            <Timeline po={po} />
          </Card>
          <Card className="space-y-3 p-5 text-sm">
            <div>
              <p className="text-xs text-slate-500">Fecha de la orden</p>
              <p className="text-slate-800">{formatDate(po.orderDate + 'T12:00:00')}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Fecha esperada</p>
              <p className="text-slate-800">{po.expectedDate ? formatDate(po.expectedDate + 'T12:00:00') : '—'}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Notas</p>
              <p className="text-slate-800">{po.notes ?? '—'}</p>
            </div>
          </Card>
        </div>
      </div>

      {confirm && (
        <ConfirmDialog
          open
          title={CONFIRM[confirm].title}
          message={CONFIRM[confirm].message}
          confirmLabel={CONFIRM[confirm].label}
          loading={transition.isPending}
          onClose={() => setConfirm(null)}
          onConfirm={() => transition.mutate({ id: po.purchaseOrderId, action: confirm }, { onSuccess: () => setConfirm(null) })}
        />
      )}
    </>
  )
}

/** Línea de tiempo del flujo DRAFT → APPROVED → RECEIVED. */
function Timeline({ po }: { po: PurchaseOrderDetail }) {
  const cancelled = po.status === 'CANCELLED'
  const steps = [
    { label: 'Creada', at: po.createdAt, by: po.createdByName, done: true },
    { label: 'Aprobada', at: po.approvedAt, by: po.approvedByName, done: !!po.approvedAt },
    { label: 'Recibida', at: po.receivedAt, by: null, done: !!po.receivedAt },
  ]
  return (
    <ol className="space-y-3">
      {steps.map((s) => (
        <li key={s.label} className="flex gap-3">
          {s.done ? (
            <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-600" />
          ) : (
            <Circle className={cn('mt-0.5 size-5 shrink-0', cancelled ? 'text-slate-200' : 'text-slate-300')} />
          )}
          <div className="text-sm">
            <p className={cn('font-medium', s.done ? 'text-slate-900' : 'text-slate-400')}>{s.label}</p>
            {s.done && (
              <p className="text-xs text-slate-500">
                {formatDateTime(s.at)}
                {s.by && ` · ${s.by}`}
              </p>
            )}
          </div>
        </li>
      ))}
      {cancelled && (
        <li className="flex gap-3">
          <XCircle className="mt-0.5 size-5 shrink-0 text-red-600" />
          <p className="text-sm font-medium text-red-700">Cancelada</p>
        </li>
      )}
    </ol>
  )
}
