import { AlertTriangle, ArrowRight, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { ProductPicker } from '@/components/product-picker'
import { PageHeader } from '@/components/page-header'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Dialog } from '@/components/ui/dialog'
import { Field } from '@/components/ui/field'
import { Input, Textarea } from '@/components/ui/input'
import { Pagination } from '@/components/ui/pagination'
import { LoadingBlock } from '@/components/ui/spinner'
import { EmptyState, ErrorState } from '@/components/ui/states'
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table'
import { P } from '@/config/permissions'
import { Can } from '@/features/auth/guards'
import { useCan } from '@/features/auth/use-auth'
import { formatDateTime, formatQuantity } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { TransferStatus } from '../api'
import { WarehouseSelect } from '../components/warehouse-select'
import { TRANSFER_STATUS } from '../labels'
import { useCancelTransfer, useCompleteTransfer, useCreateTransfer, useTransfer, useTransfers, useWarehouses } from '../queries'

const TABS: { value: '' | TransferStatus; label: string }[] = [
  { value: '', label: 'Todas' },
  { value: 'PENDING', label: 'Pendientes' },
  { value: 'COMPLETED', label: 'Completadas' },
  { value: 'CANCELLED', label: 'Canceladas' },
]

export function TransfersPage() {
  const [status, setStatus] = useState<'' | TransferStatus>('')
  const [page, setPage] = useState(1)
  const transfers = useTransfers({ status: status || undefined, page, pageSize: 20 })
  const [creating, setCreating] = useState(false)
  const [viewing, setViewing] = useState<string | null>(null)

  return (
    <>
      <PageHeader
        title="Transferencias"
        description="Movimiento de mercadería entre almacenes. El stock se mueve al completarla."
        actions={
          <Can permission={P.TransfersManage}>
            <Button onClick={() => setCreating(true)}>
              <Plus className="size-4" /> Nueva transferencia
            </Button>
          </Can>
        }
      />

      <Card>
        <div className="border-b border-slate-200 p-4">
          <div className="inline-flex rounded-lg bg-slate-100 p-1" role="tablist">
            {TABS.map((t) => (
              <button
                key={t.value}
                type="button"
                role="tab"
                aria-selected={status === t.value}
                onClick={() => {
                  setStatus(t.value)
                  setPage(1)
                }}
                className={cn(
                  'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                  status === t.value ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900',
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {transfers.isPending ? (
          <LoadingBlock />
        ) : transfers.isError ? (
          <ErrorState error={transfers.error} onRetry={() => transfers.refetch()} />
        ) : transfers.data.items.length === 0 ? (
          <EmptyState title="Sin transferencias" />
        ) : (
          <>
            <Table>
              <THead>
                <tr>
                  <TH>Código</TH>
                  <TH>Ruta</TH>
                  <TH className="hidden text-right sm:table-cell">Productos</TH>
                  <TH className="hidden md:table-cell">Solicitada</TH>
                  <TH>Estado</TH>
                </tr>
              </THead>
              <TBody>
                {transfers.data.items.map((t) => (
                  <TR key={t.transferId} className="cursor-pointer" onClick={() => setViewing(t.transferId)}>
                    <TD>
                      <button type="button" className="font-mono text-sm font-medium text-brand-700 hover:underline" onClick={() => setViewing(t.transferId)}>
                        {t.code}
                      </button>
                    </TD>
                    <TD>
                      <span className="inline-flex items-center gap-1.5 text-sm">
                        {t.originWarehouseName} <ArrowRight className="size-3.5 text-slate-400" /> {t.destinationWarehouseName}
                      </span>
                    </TD>
                    <TD className="tabular hidden text-right sm:table-cell">
                      {t.itemCount} · {formatQuantity(t.totalQuantity)} u.
                    </TD>
                    <TD className="hidden text-xs md:table-cell">
                      {formatDateTime(t.createdAt)}
                      <div className="text-slate-500">{t.requestedByName}</div>
                    </TD>
                    <TD>
                      <Badge tone={TRANSFER_STATUS[t.status].tone}>{TRANSFER_STATUS[t.status].label}</Badge>
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
            <Pagination page={transfers.data.page} totalPages={transfers.data.totalPages} totalCount={transfers.data.totalCount} onPageChange={setPage} />
          </>
        )}
      </Card>

      {creating && (
        <CreateTransferDialog
          onClose={() => setCreating(false)}
          onCreated={(id) => {
            setCreating(false)
            setViewing(id)
          }}
        />
      )}
      {viewing && <TransferDetailDialog id={viewing} onClose={() => setViewing(null)} />}
    </>
  )
}

// ── Nueva transferencia ─────────────────────────────────────────────────────

interface Line {
  productId: string
  name: string
  unitCode: string
  quantity: string
}

function CreateTransferDialog({ onClose, onCreated }: { onClose: () => void; onCreated: (id: string) => void }) {
  const warehouses = useWarehouses()
  const create = useCreateTransfer()
  const [originChoice, setOrigin] = useState('')
  const [destinationChoice, setDestination] = useState('')
  // Por defecto: primer almacén → segundo (los almacenes pueden llegar después de abrir el diálogo).
  const origin = originChoice || warehouses.data?.[0]?.warehouseId || ''
  const destination = destinationChoice || warehouses.data?.[1]?.warehouseId || ''
  const [notes, setNotes] = useState('')
  const [lines, setLines] = useState<Line[]>([])
  const [error, setError] = useState<string | null>(null)

  function submit() {
    if (!origin || !destination) return setError('Elige el almacén de origen y de destino.')
    if (origin === destination) return setError('El origen y el destino deben ser distintos.')
    if (lines.length === 0) return setError('Agrega al menos un producto.')
    const items = lines.map((l) => ({ productId: l.productId, quantity: Number(l.quantity) }))
    if (items.some((i) => !(i.quantity > 0))) return setError('Todas las cantidades deben ser mayores a cero.')
    setError(null)
    create.mutate(
      { originWarehouseId: origin, destinationWarehouseId: destination, notes: notes.trim() || null, items },
      { onSuccess: (t) => onCreated(t.transferId) },
    )
  }

  return (
    <Dialog
      open
      onClose={onClose}
      size="lg"
      title="Nueva transferencia"
      description="Queda pendiente hasta que alguien la complete; recién ahí se mueve el stock."
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={create.isPending}>
            Cancelar
          </Button>
          <Button onClick={submit} loading={create.isPending}>
            Crear transferencia
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid items-end gap-3 sm:grid-cols-[1fr_auto_1fr]">
          <Field label="Origen" required>
            <WarehouseSelect value={origin} onChange={setOrigin} />
          </Field>
          <ArrowRight className="mb-2.5 hidden size-5 text-slate-400 sm:block" />
          <Field label="Destino" required>
            <WarehouseSelect value={destination} onChange={setDestination} />
          </Field>
        </div>

        <Field label="Productos" required>
          <ProductPicker
            show="cost"
            excludeIds={lines.map((l) => l.productId)}
            onSelect={(p) => setLines((ls) => [...ls, { productId: p.productId, name: p.name, unitCode: p.unitCode, quantity: '1' }])}
          />
        </Field>

        {lines.length > 0 && (
          <div className="overflow-hidden rounded-lg ring-1 ring-slate-200">
            <Table>
              <THead>
                <tr>
                  <TH>Producto</TH>
                  <TH className="w-36">Cantidad</TH>
                  <TH className="w-px" />
                </tr>
              </THead>
              <TBody>
                {lines.map((l, i) => (
                  <TR key={l.productId}>
                    <TD className="font-medium text-slate-800">{l.name}</TD>
                    <TD>
                      <div className="flex items-center gap-1.5">
                        <Input
                          type="number"
                          min="0"
                          step="0.001"
                          value={l.quantity}
                          onChange={(e) => setLines((ls) => ls.map((x, j) => (j === i ? { ...x, quantity: e.target.value } : x)))}
                          className="h-8"
                          aria-label={`Cantidad de ${l.name}`}
                        />
                        <span className="text-xs text-slate-500">{l.unitCode}</span>
                      </div>
                    </TD>
                    <TD>
                      <Button variant="ghost" size="icon" aria-label={`Quitar ${l.name}`} onClick={() => setLines((ls) => ls.filter((_, j) => j !== i))}>
                        <Trash2 className="size-4 text-red-600" />
                      </Button>
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </div>
        )}

        <Field label="Notas" htmlFor="tr-notes">
          <Textarea id="tr-notes" rows={2} maxLength={255} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>

        {error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-200" role="alert">
            {error}
          </p>
        )}
      </div>
    </Dialog>
  )
}

// ── Detalle ─────────────────────────────────────────────────────────────────

function TransferDetailDialog({ id, onClose }: { id: string; onClose: () => void }) {
  const transfer = useTransfer(id)
  const complete = useCompleteTransfer()
  const cancel = useCancelTransfer()
  const can = useCan()
  const [confirm, setConfirm] = useState<'complete' | 'cancel' | null>(null)

  const t = transfer.data
  const shortages = t?.items.filter((i) => i.availableAtOrigin < i.quantity) ?? []
  const actionable = t?.status === 'PENDING' && can(P.TransfersManage)

  return (
    <Dialog
      open
      onClose={onClose}
      size="lg"
      title={t ? `Transferencia ${t.code}` : 'Transferencia'}
      description={t ? `${t.originWarehouseName} → ${t.destinationWarehouseName}` : undefined}
      footer={
        actionable ? (
          <>
            <Button variant="secondary" onClick={() => setConfirm('cancel')}>
              Cancelar transferencia
            </Button>
            <Button onClick={() => setConfirm('complete')} disabled={shortages.length > 0} title={shortages.length ? 'Falta stock en el origen' : undefined}>
              Completar
            </Button>
          </>
        ) : (
          <Button variant="secondary" onClick={onClose}>
            Cerrar
          </Button>
        )
      }
    >
      {transfer.isPending ? (
        <LoadingBlock />
      ) : transfer.isError ? (
        <ErrorState error={transfer.error} onRetry={() => transfer.refetch()} />
      ) : (
        <div className="space-y-4">
          <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-4">
            <div>
              <dt className="text-xs text-slate-500">Estado</dt>
              <dd className="mt-0.5">
                <Badge tone={TRANSFER_STATUS[t!.status].tone}>{TRANSFER_STATUS[t!.status].label}</Badge>
              </dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Solicitada</dt>
              <dd className="mt-0.5 text-slate-800">{formatDateTime(t!.createdAt)}</dd>
              <dd className="text-xs text-slate-500">{t!.requestedByName}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Completada</dt>
              <dd className="mt-0.5 text-slate-800">{formatDateTime(t!.completedAt)}</dd>
              {t!.completedByName && <dd className="text-xs text-slate-500">{t!.completedByName}</dd>}
            </div>
            <div>
              <dt className="text-xs text-slate-500">Notas</dt>
              <dd className="mt-0.5 text-slate-800">{t!.notes ?? '—'}</dd>
            </div>
          </dl>

          {actionable && shortages.length > 0 && (
            <p className="flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900 ring-1 ring-amber-200" role="alert">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              Falta stock en el origen para {shortages.map((s) => s.productName).join(', ')}. No se puede completar hasta reponerlo.
            </p>
          )}

          <div className="overflow-hidden rounded-lg ring-1 ring-slate-200">
            <Table>
              <THead>
                <tr>
                  <TH>Producto</TH>
                  <TH className="text-right">Cantidad</TH>
                  {t!.status === 'PENDING' && <TH className="text-right">Disponible en origen</TH>}
                </tr>
              </THead>
              <TBody>
                {t!.items.map((i) => (
                  <TR key={i.productId}>
                    <TD>
                      <div className="font-medium text-slate-900">{i.productName}</div>
                      <div className="text-xs text-slate-500">{i.sku}</div>
                    </TD>
                    <TD className="tabular text-right">
                      {formatQuantity(i.quantity)} {i.unitCode}
                    </TD>
                    {t!.status === 'PENDING' && (
                      <TD className={cn('tabular text-right', i.availableAtOrigin < i.quantity ? 'font-semibold text-red-700' : 'text-slate-600')}>
                        {formatQuantity(i.availableAtOrigin)}
                      </TD>
                    )}
                  </TR>
                ))}
              </TBody>
            </Table>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={confirm === 'complete'}
        title="Completar transferencia"
        message="Se registrará la salida en el almacén de origen y la entrada en el de destino. No se puede deshacer."
        confirmLabel="Completar"
        loading={complete.isPending}
        onClose={() => setConfirm(null)}
        onConfirm={() => complete.mutate(id, { onSuccess: () => setConfirm(null) })}
      />
      <ConfirmDialog
        open={confirm === 'cancel'}
        title="Cancelar transferencia"
        message="La transferencia quedará cancelada y no moverá stock."
        confirmLabel="Cancelar transferencia"
        loading={cancel.isPending}
        onClose={() => setConfirm(null)}
        onConfirm={() => cancel.mutate(id, { onSuccess: () => setConfirm(null) })}
      />
    </Dialog>
  )
}
