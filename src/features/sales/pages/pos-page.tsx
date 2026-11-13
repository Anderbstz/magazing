import { useQueries, useQuery } from '@tanstack/react-query'
import { AlertTriangle, Banknote, CreditCard, Minus, Plus, Printer, ShoppingCart, Smartphone, Trash2, X } from 'lucide-react'
import { useState } from 'react'
import { ProductPicker } from '@/components/product-picker'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Dialog } from '@/components/ui/dialog'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { EmptyState } from '@/components/ui/states'
import type { Product } from '@/features/catalog/api'
import { inventoryApi } from '@/features/inventory/api'
import { WarehouseSelect } from '@/features/inventory/components/warehouse-select'
import { useWarehouses } from '@/features/inventory/queries'
import { formatMoney, formatQuantity } from '@/lib/format'
import { calculateLine, calculateSale, round2 } from '@/lib/tax'
import { cn } from '@/lib/utils'
import { customersApi, type Customer, type InvoiceType, type PaymentMethod, type SaleDetail } from '../api'
import { CustomerPicker } from '../components/customer-picker'
import { Receipt } from '../components/receipt'
import { useCreateSale, usePaymentMethods } from '../queries'

interface Line {
  productId: string
  name: string
  sku: string
  unitCode: string
  unitPrice: number
  isTaxable: boolean
  quantity: number
  discount: number
}

interface PaymentLine {
  key: number
  methodId: string
  /** Vacío = "lo que falta" (el caso normal: un solo pago exacto). */
  amount: string
  reference: string
}

const METHOD_ICONS: Record<string, typeof Banknote> = { CASH: Banknote, CARD: CreditCard, YAPE: Smartphone, PLIN: Smartphone }

export function PosPage() {
  const [completed, setCompleted] = useState<SaleDetail | null>(null)
  const [round, setRound] = useState(0)

  return (
    <>
      {/* `key` reinicia toda la venta al pulsar "Nueva venta". */}
      <PointOfSale key={round} onCompleted={setCompleted} />
      {completed && (
        <SaleCompletedDialog
          sale={completed}
          onNew={() => {
            setCompleted(null)
            setRound((r) => r + 1)
          }}
        />
      )}
    </>
  )
}

function PointOfSale({ onCompleted }: { onCompleted: (sale: SaleDetail) => void }) {
  const warehouses = useWarehouses()
  const methods = usePaymentMethods()
  const create = useCreateSale()

  const [warehouseChoice, setWarehouseId] = useState('')
  const warehouseId = warehouseChoice || warehouses.data?.[0]?.warehouseId || ''
  const [documentType, setDocumentType] = useState<InvoiceType>('BOLETA')
  const [lines, setLines] = useState<Line[]>([])
  const [customerChoice, setCustomer] = useState<Customer | null>(null)
  const [payments, setPayments] = useState<PaymentLine[]>([])
  const [error, setError] = useState<string | null>(null)

  // Cliente por defecto: "CLIENTES VARIOS" (boletas sin identificar).
  const defaultCustomer = useQuery({
    queryKey: ['customers', 'default'],
    queryFn: () => customersApi.list({ search: '00000000', pageSize: 1 }).then((r) => r.items[0] ?? null),
    staleTime: Infinity,
  })
  const customer = customerChoice ?? (documentType === 'BOLETA' ? defaultCustomer.data ?? null : null)

  // Stock disponible de cada producto del carrito en el almacén elegido.
  const availability = useQueries({
    queries: lines.map((l) => ({
      queryKey: ['stock', 'pos', warehouseId, l.productId],
      queryFn: () =>
        inventoryApi
          .stocks({ warehouseId, search: l.sku, pageSize: 5 })
          .then((r) => r.items.find((s) => s.productId === l.productId)?.quantity ?? 0),
      enabled: !!warehouseId,
      staleTime: 15_000,
    })),
  })
  const available = new Map(lines.map((l, i) => [l.productId, availability[i]?.data]))

  const paymentList: PaymentLine[] = payments.length
    ? payments
    : methods.data?.length
      ? [{ key: 0, methodId: methods.data.find((m) => m.code === 'CASH')?.paymentMethodId ?? methods.data[0].paymentMethodId, amount: '', reference: '' }]
      : []

  const totals = calculateSale(lines)
  const resolved = resolvePayments(paymentList, totals.total)
  const paid = round2(resolved.reduce((s, p) => s + p.amount, 0))
  const pending = round2(Math.max(0, totals.total - paid))
  const cashId = methods.data?.find((m) => m.code === 'CASH')?.paymentMethodId
  const change = round2(Math.max(0, paid - totals.total))

  function addProduct(p: Product) {
    setError(null)
    if (p.currentPrice == null) {
      setError(`${p.name} no tiene precio vigente.`)
      return
    }
    setLines((ls) => {
      const existing = ls.find((l) => l.productId === p.productId)
      if (existing) return ls.map((l) => (l === existing ? { ...l, quantity: l.quantity + 1 } : l))
      return [
        ...ls,
        { productId: p.productId, name: p.name, sku: p.sku, unitCode: p.unitCode, unitPrice: p.currentPrice!, isTaxable: p.isTaxable, quantity: 1, discount: 0 },
      ]
    })
  }

  function updateLine(productId: string, patch: Partial<Line>) {
    setLines((ls) => ls.map((l) => (l.productId === productId ? { ...l, ...patch } : l)))
  }

  function updatePayment(key: number, patch: Partial<PaymentLine>) {
    setPayments(paymentList.map((p) => (p.key === key ? { ...p, ...patch } : p)))
  }

  function submit() {
    setError(null)
    if (lines.length === 0) return setError('Agrega al menos un producto.')
    if (!customer) return setError(documentType === 'FACTURA' ? 'Elige un cliente con RUC para la factura.' : 'Elige un cliente.')
    if (documentType === 'FACTURA' && customer.documentType !== 'RUC') return setError('La factura exige un cliente con RUC.')
    if (lines.some((l) => !(l.quantity > 0))) return setError('Revisa las cantidades.')
    const short = lines.find((l) => (available.get(l.productId) ?? Infinity) < l.quantity)
    if (short) return setError(`Stock insuficiente de ${short.name}.`)
    if (pending > 0) return setError(`Falta cobrar ${formatMoney(pending)}.`)
    const nonCash = resolved.filter((p) => p.methodId !== cashId).reduce((s, p) => s + p.amount, 0)
    if (round2(nonCash) > totals.total) return setError('Solo el efectivo puede superar el total (para dar vuelto).')

    create.mutate(
      {
        warehouseId,
        customerId: customer.customerId,
        documentType,
        notes: null,
        items: lines.map((l) => ({ productId: l.productId, quantity: l.quantity, discount: l.discount })),
        payments: resolved.filter((p) => p.amount > 0).map((p) => ({ paymentMethodId: p.methodId, amount: p.amount, reference: p.reference || null })),
      },
      { onSuccess: onCompleted, onError: (e) => setError(e.message) },
    )
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_400px]">
      {/* ── Carrito ── */}
      <div className="min-w-0 space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Punto de venta</h1>
            <p className="mt-1 text-sm text-slate-500">Escanea o busca productos. Los precios incluyen IGV.</p>
          </div>
          <WarehouseSelect value={warehouseId} onChange={setWarehouseId} className="w-60" />
        </div>

        <ProductPicker autoFocus excludeIds={[]} onSelect={addProduct} className="max-w-none" />

        <Card>
          {lines.length === 0 ? (
            <EmptyState title="Carrito vacío" description="Busca un producto o escanea su código de barras." />
          ) : (
            <ul className="divide-y divide-slate-100">
              {lines.map((l) => {
                const t = calculateLine(l)
                const stock = available.get(l.productId)
                const short = stock !== undefined && stock < l.quantity
                return (
                  <li key={l.productId} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
                    <div className="min-w-0 flex-1 basis-48">
                      <p className="truncate font-medium text-slate-900">{l.name}</p>
                      <p className="text-xs text-slate-500">
                        {formatMoney(l.unitPrice)} c/u · {l.sku}
                        {!l.isTaxable && ' · exonerado'}
                      </p>
                      <p className={cn('text-xs', short ? 'font-medium text-red-600' : 'text-slate-400')}>
                        {stock === undefined ? 'Consultando stock…' : `Disponible: ${formatQuantity(stock)} ${l.unitCode}`}
                      </p>
                    </div>

                    <div className="flex items-center gap-1">
                      <Button variant="secondary" size="icon" className="size-8" aria-label="Quitar uno" onClick={() => updateLine(l.productId, { quantity: Math.max(1, l.quantity - 1) })}>
                        <Minus className="size-3.5" />
                      </Button>
                      <Input
                        type="number"
                        min="0"
                        step="any"
                        value={l.quantity}
                        onChange={(e) => updateLine(l.productId, { quantity: Number(e.target.value) })}
                        className={cn('h-8 w-16 text-center', short && 'ring-red-400')}
                        aria-label={`Cantidad de ${l.name}`}
                      />
                      <Button variant="secondary" size="icon" className="size-8" aria-label="Agregar uno" onClick={() => updateLine(l.productId, { quantity: l.quantity + 1 })}>
                        <Plus className="size-3.5" />
                      </Button>
                    </div>

                    <label className="flex items-center gap-1.5 text-xs text-slate-500">
                      Desc.
                      <Input
                        type="number"
                        min="0"
                        step="0.1"
                        value={l.discount || ''}
                        placeholder="0.00"
                        onChange={(e) => updateLine(l.productId, { discount: Math.max(0, Number(e.target.value) || 0) })}
                        className="h-8 w-20"
                        aria-label={`Descuento de ${l.name}`}
                      />
                    </label>

                    <p className="tabular w-24 text-right font-semibold text-slate-900">{formatMoney(t.lineTotal)}</p>

                    <Button variant="ghost" size="icon" aria-label={`Quitar ${l.name}`} onClick={() => setLines((ls) => ls.filter((x) => x.productId !== l.productId))}>
                      <Trash2 className="size-4 text-red-600" />
                    </Button>
                  </li>
                )
              })}
            </ul>
          )}
        </Card>
      </div>

      {/* ── Cobro ── */}
      <div className="space-y-4 xl:sticky xl:top-8 xl:self-start">
        <Card className="space-y-4 p-5">
          <div className="grid grid-cols-2 rounded-lg bg-slate-100 p-1" role="radiogroup" aria-label="Comprobante">
            {(['BOLETA', 'FACTURA'] as const).map((type) => (
              <button
                key={type}
                type="button"
                role="radio"
                aria-checked={documentType === type}
                onClick={() => {
                  setDocumentType(type)
                  if (type === 'FACTURA' && customerChoice?.documentType !== 'RUC') setCustomer(null)
                }}
                className={cn(
                  'rounded-md py-1.5 text-sm font-medium transition-colors',
                  documentType === type ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600',
                )}
              >
                {type === 'BOLETA' ? 'Boleta' : 'Factura'}
              </button>
            ))}
          </div>

          <CustomerPicker value={customer} onChange={setCustomer} requireRuc={documentType === 'FACTURA'} />

          <dl className="space-y-1.5 border-t border-slate-200 pt-4 text-sm">
            <div className="flex justify-between">
              <dt className="text-slate-500">Op. gravada</dt>
              <dd className="tabular">{formatMoney(totals.subtotal)}</dd>
            </div>
            {totals.discountTotal > 0 && (
              <div className="flex justify-between">
                <dt className="text-slate-500">Descuentos</dt>
                <dd className="tabular text-red-600">−{formatMoney(totals.discountTotal)}</dd>
              </div>
            )}
            <div className="flex justify-between">
              <dt className="text-slate-500">IGV (18%)</dt>
              <dd className="tabular">{formatMoney(totals.taxAmount)}</dd>
            </div>
            <div className="flex items-baseline justify-between pt-1">
              <dt className="font-semibold">Total</dt>
              <dd className="tabular text-3xl font-bold tracking-tight text-slate-900">{formatMoney(totals.total)}</dd>
            </div>
          </dl>
        </Card>

        <Card className="space-y-3 p-5">
          <h2 className="text-sm font-semibold text-slate-900">Pago</h2>
          {paymentList.map((p, idx) => (
            <PaymentEditor
              key={p.key}
              payment={p}
              methods={methods.data ?? []}
              placeholder={resolved[idx]?.amount.toFixed(2)}
              canRemove={paymentList.length > 1}
              onChange={(patch) => updatePayment(p.key, patch)}
              onRemove={() => setPayments(paymentList.filter((x) => x.key !== p.key))}
            />
          ))}
          {pending > 0 && paymentList.length > 0 && paymentList.every((p) => p.amount !== '') && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                setPayments([...paymentList, { key: Date.now(), methodId: methods.data?.find((m) => m.code === 'YAPE')?.paymentMethodId ?? paymentList[0].methodId, amount: '', reference: '' }])
              }
            >
              <Plus className="size-4" /> Agregar otro pago ({formatMoney(pending)} pendiente)
            </Button>
          )}
          {change > 0 && (
            <div className="flex items-center justify-between rounded-lg bg-emerald-50 px-3 py-2 text-emerald-900 ring-1 ring-emerald-200">
              <span className="text-sm font-medium">Vuelto</span>
              <span className="tabular text-lg font-bold">{formatMoney(change)}</span>
            </div>
          )}

          {error && (
            <p className="flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-200" role="alert">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" /> {error}
            </p>
          )}

          <Button className="h-12 w-full text-base" onClick={submit} loading={create.isPending} disabled={lines.length === 0}>
            <ShoppingCart className="size-5" /> Cobrar {formatMoney(totals.total)}
          </Button>
        </Card>
      </div>
    </div>
  )
}

/** Montos efectivos: un pago vacío cubre lo que falta hasta ese momento. */
function resolvePayments(payments: PaymentLine[], total: number) {
  let covered = 0
  return payments.map((p) => {
    const amount = p.amount === '' ? round2(Math.max(0, total - covered)) : round2(Math.max(0, Number(p.amount) || 0))
    covered += amount
    return { methodId: p.methodId, amount, reference: p.reference.trim() }
  })
}

function PaymentEditor({
  payment,
  methods,
  placeholder,
  canRemove,
  onChange,
  onRemove,
}: {
  payment: PaymentLine
  methods: PaymentMethod[]
  placeholder?: string
  canRemove: boolean
  onChange: (patch: Partial<PaymentLine>) => void
  onRemove: () => void
}) {
  const method = methods.find((m) => m.paymentMethodId === payment.methodId)
  const isCash = method?.code === 'CASH'
  return (
    <div className="space-y-2 rounded-lg p-3 ring-1 ring-slate-200">
      <div className="flex flex-wrap gap-1.5">
        {methods.map((m) => {
          const Icon = METHOD_ICONS[m.code] ?? CreditCard
          return (
            <button
              key={m.paymentMethodId}
              type="button"
              onClick={() => onChange({ methodId: m.paymentMethodId })}
              aria-pressed={m.paymentMethodId === payment.methodId}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium ring-1 transition-colors',
                m.paymentMethodId === payment.methodId ? 'bg-brand-50 text-brand-800 ring-brand-500' : 'text-slate-600 ring-slate-200 hover:bg-slate-50',
              )}
            >
              <Icon className="size-3.5" /> {m.name}
            </button>
          )
        })}
        {canRemove && (
          <button type="button" onClick={onRemove} className="ml-auto text-slate-400 hover:text-slate-600" aria-label="Quitar pago">
            <X className="size-4" />
          </button>
        )}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Field label={isCash ? 'Recibido (S/)' : 'Monto (S/)'}>
          <Input type="number" min="0" step="0.1" value={payment.amount} placeholder={placeholder} onChange={(e) => onChange({ amount: e.target.value })} />
        </Field>
        {!isCash && (
          <Field label="N.º operación">
            <Input value={payment.reference} maxLength={100} onChange={(e) => onChange({ reference: e.target.value })} />
          </Field>
        )}
      </div>
    </div>
  )
}

function SaleCompletedDialog({ sale, onNew }: { sale: SaleDetail; onNew: () => void }) {
  return (
    <Dialog
      open
      onClose={onNew}
      title="Venta registrada"
      description={`${sale.fullNumber} · ${formatMoney(sale.total)}`}
      footer={
        <>
          <Button variant="secondary" onClick={() => window.print()}>
            <Printer className="size-4" /> Imprimir
          </Button>
          <Button autoFocus onClick={onNew}>
            Nueva venta
          </Button>
        </>
      }
    >
      {sale.change > 0 && (
        <div className="mb-4 rounded-lg bg-emerald-50 p-4 text-center text-emerald-900 ring-1 ring-emerald-200">
          <p className="text-sm">Vuelto a entregar</p>
          <p className="tabular text-3xl font-bold">{formatMoney(sale.change)}</p>
        </div>
      )}
      <div className="rounded-lg bg-slate-50 p-4 ring-1 ring-slate-200">
        <Receipt sale={sale} />
      </div>
    </Dialog>
  )
}
