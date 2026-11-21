import { ArrowLeft, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { PageHeader } from '@/components/page-header'
import { ProductPicker } from '@/components/product-picker'
import { Button } from '@/components/ui/button'
import { Card, CardHeader } from '@/components/ui/card'
import { Field } from '@/components/ui/field'
import { Input, Select, Textarea } from '@/components/ui/input'
import { LoadingBlock } from '@/components/ui/spinner'
import { EmptyState, ErrorState } from '@/components/ui/states'
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table'
import { WarehouseSelect } from '@/features/inventory/components/warehouse-select'
import { useWarehouses } from '@/features/inventory/queries'
import { formatMoney } from '@/lib/format'
import { calculatePurchase, round2 } from '@/lib/tax'
import type { PurchaseOrderDetail } from '../api'
import { usePurchaseOrder, useSavePurchaseOrder, useSuppliers } from '../queries'

/** Crear (`/purchases/orders/new`) o editar un borrador (`/purchases/orders/:id/edit`). */
export function PurchaseOrderFormPage() {
  const { id } = useParams()
  const order = usePurchaseOrder(id)

  if (id && order.isPending) return <LoadingBlock />
  if (id && order.isError) return <ErrorState error={order.error} onRetry={() => order.refetch()} />
  if (order.data && order.data.status !== 'DRAFT') {
    return <EmptyState title="Esta orden ya no se puede editar" description="Solo se editan órdenes en borrador." />
  }
  // `key` reinicia el formulario si se pasa de una orden a otra.
  return <PurchaseOrderForm key={id ?? 'new'} initial={order.data ?? null} />
}

interface Line {
  productId: string
  name: string
  sku: string
  unitCode: string
  quantity: string
  unitCost: string
}

function PurchaseOrderForm({ initial }: { initial: PurchaseOrderDetail | null }) {
  const navigate = useNavigate()
  const suppliers = useSuppliers({ isActive: true, pageSize: 100 })
  const warehouses = useWarehouses()
  const save = useSavePurchaseOrder()

  const [supplierId, setSupplierId] = useState(initial?.supplierId ?? '')
  const [warehouseChoice, setWarehouseId] = useState(initial?.warehouseId ?? '')
  const warehouseId = warehouseChoice || warehouses.data?.[0]?.warehouseId || ''
  const [expectedDate, setExpectedDate] = useState(initial?.expectedDate ?? '')
  const [notes, setNotes] = useState(initial?.notes ?? '')
  const [lines, setLines] = useState<Line[]>(
    initial?.items.map((i) => ({
      productId: i.productId,
      name: i.productName,
      sku: i.sku,
      unitCode: i.unitCode,
      quantity: String(i.quantity),
      unitCost: String(i.unitCost),
    })) ?? [],
  )
  const [error, setError] = useState<string | null>(null)

  const parsed = lines.map((l) => ({ quantity: Number(l.quantity) || 0, unitCost: Number(l.unitCost) || 0 }))
  const totals = calculatePurchase(parsed)

  function update(i: number, patch: Partial<Line>) {
    setLines((ls) => ls.map((l, j) => (j === i ? { ...l, ...patch } : l)))
  }

  function submit() {
    if (!supplierId) return setError('Elige un proveedor.')
    if (!warehouseId) return setError('Elige el almacén de destino.')
    if (lines.length === 0) return setError('Agrega al menos un producto.')
    const items = lines.map((l) => ({ productId: l.productId, quantity: Number(l.quantity), unitCost: Number(l.unitCost) }))
    if (items.some((i) => !(i.quantity > 0))) return setError('Todas las cantidades deben ser mayores a cero.')
    if (items.some((i) => !(i.unitCost >= 0) || Number.isNaN(i.unitCost))) return setError('Revisa los costos unitarios.')
    setError(null)
    save.mutate(
      {
        id: initial?.purchaseOrderId,
        body: { supplierId, warehouseId, expectedDate: expectedDate || null, notes: notes.trim() || null, items },
      },
      { onSuccess: (po) => navigate(`/purchases/orders/${po.purchaseOrderId}`, { replace: true }) },
    )
  }

  return (
    <>
      <Link to={initial ? `/purchases/orders/${initial.purchaseOrderId}` : '/purchases/orders'} className="mb-3 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800">
        <ArrowLeft className="size-4" /> Volver
      </Link>
      <PageHeader
        title={initial ? `Editar ${initial.code}` : 'Nueva orden de compra'}
        description="Se guarda como borrador. Los costos van sin IGV; el IGV se calcula encima."
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          <Card className="p-5">
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Proveedor" htmlFor="po-supplier" required className="sm:col-span-3">
                <Select id="po-supplier" value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
                  <option value="">Selecciona…</option>
                  {suppliers.data?.items.map((s) => (
                    <option key={s.supplierId} value={s.supplierId}>
                      {s.businessName} · RUC {s.ruc}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Almacén destino" required className="sm:col-span-2">
                <WarehouseSelect value={warehouseId} onChange={setWarehouseId} />
              </Field>
              <Field label="Fecha esperada" htmlFor="po-date">
                <Input id="po-date" type="date" value={expectedDate} onChange={(e) => setExpectedDate(e.target.value)} />
              </Field>
            </div>
          </Card>

          <Card>
            <CardHeader title="Productos" description="El costo se sugiere con el costo promedio actual." />
            <div className="p-4">
              <ProductPicker
                show="cost"
                excludeIds={lines.map((l) => l.productId)}
                onSelect={(p) =>
                  setLines((ls) => [
                    ...ls,
                    { productId: p.productId, name: p.name, sku: p.sku, unitCode: p.unitCode, quantity: '1', unitCost: String(round2(p.averageCost)) },
                  ])
                }
              />
            </div>
            {lines.length === 0 ? (
              <EmptyState title="Sin productos" description="Busca y agrega los productos a comprar." />
            ) : (
              <Table>
                <THead>
                  <tr>
                    <TH>Producto</TH>
                    <TH className="w-32">Cantidad</TH>
                    <TH className="w-36">Costo unit.</TH>
                    <TH className="text-right">Subtotal</TH>
                    <TH className="w-px" />
                  </tr>
                </THead>
                <TBody>
                  {lines.map((l, i) => (
                    <TR key={l.productId}>
                      <TD>
                        <div className="font-medium text-slate-900">{l.name}</div>
                        <div className="text-xs text-slate-500">
                          {l.sku} · {l.unitCode}
                        </div>
                      </TD>
                      <TD>
                        <Input type="number" min="0" step="0.001" className="h-8" value={l.quantity} onChange={(e) => update(i, { quantity: e.target.value })} aria-label={`Cantidad de ${l.name}`} />
                      </TD>
                      <TD>
                        <Input type="number" min="0" step="0.01" className="h-8" value={l.unitCost} onChange={(e) => update(i, { unitCost: e.target.value })} aria-label={`Costo de ${l.name}`} />
                      </TD>
                      <TD className="tabular text-right">{formatMoney(round2(parsed[i].quantity * parsed[i].unitCost))}</TD>
                      <TD>
                        <Button variant="ghost" size="icon" aria-label={`Quitar ${l.name}`} onClick={() => setLines((ls) => ls.filter((_, j) => j !== i))}>
                          <Trash2 className="size-4 text-red-600" />
                        </Button>
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            )}
          </Card>
        </div>

        <div className="space-y-4 lg:sticky lg:top-8 lg:self-start">
          <Card className="p-5">
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-slate-500">Subtotal</dt>
                <dd className="tabular">{formatMoney(totals.subtotal)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">IGV (18%)</dt>
                <dd className="tabular">{formatMoney(totals.taxAmount)}</dd>
              </div>
              <div className="flex justify-between border-t border-slate-200 pt-2 text-base font-semibold">
                <dt>Total</dt>
                <dd className="tabular">{formatMoney(totals.total)}</dd>
              </div>
            </dl>
            <Field label="Notas" htmlFor="po-notes" className="mt-4">
              <Textarea id="po-notes" rows={2} maxLength={255} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </Field>
            {error && (
              <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-200" role="alert">
                {error}
              </p>
            )}
            <Button className="mt-4 w-full" onClick={submit} loading={save.isPending}>
              {initial ? 'Guardar cambios' : 'Guardar borrador'}
            </Button>
          </Card>
        </div>
      </div>
    </>
  )
}
