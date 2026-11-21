import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { LoadingBlock } from '@/components/ui/spinner'
import { ErrorState } from '@/components/ui/states'
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table'
import { P } from '@/config/permissions'
import { useCan } from '@/features/auth/use-auth'
import { asNumber, money } from '@/lib/forms'
import { formatDateTime, formatMoney } from '@/lib/format'
import type { Product } from '../api'
import { useChangePrice, useProductPrices } from '../queries'

const schema = z.object({ price: money })
type FormValues = z.infer<typeof schema>

/** Historial de precios del producto y, con `prices.manage`, el formulario para cambiarlo. */
export function PriceDialog({ product, onClose }: { product: Product | null; onClose: () => void }) {
  const can = useCan()
  const canChange = can(P.PricesManage)
  const prices = useProductPrices(product?.productId ?? null)
  const change = useChangePrice()

  const form = useForm<FormValues>({ resolver: zodResolver(schema) })

  useEffect(() => {
    if (product) form.reset({ price: product.currentPrice ?? Number.NaN })
  }, [product, form])

  const margin =
    product?.currentPrice && product.averageCost > 0
      ? ((product.currentPrice - product.averageCost) / product.currentPrice) * 100
      : null

  return (
    <Dialog open={!!product} onClose={onClose} size="lg" title="Precios" description={product?.name}>
      {product && (
        <div className="space-y-6">
          <dl className="grid grid-cols-3 gap-3">
            <Stat label="Precio actual" value={formatMoney(product.currentPrice)} />
            <Stat label="Costo promedio" value={formatMoney(product.averageCost)} />
            <Stat label="Margen" value={margin === null ? '—' : `${margin.toFixed(1)} %`} />
          </dl>

          {canChange && (
            <form
              noValidate
              className="flex flex-wrap items-end gap-3 rounded-lg bg-slate-50 p-4 ring-1 ring-slate-200"
              onSubmit={form.handleSubmit(({ price }) =>
                change.mutate({ id: product.productId, price }, { onSuccess: onClose }),
              )}
            >
              <Field
                label="Nuevo precio (S/)"
                htmlFor="new-price"
                error={form.formState.errors.price?.message}
                className="min-w-40 flex-1"
              >
                <Input
                  id="new-price"
                  type="number"
                  step="0.01"
                  min="0"
                  aria-invalid={!!form.formState.errors.price}
                  {...form.register('price', { setValueAs: asNumber })}
                />
              </Field>
              <Button type="submit" loading={change.isPending}>
                Cambiar precio
              </Button>
              <p className="w-full text-xs text-slate-500">
                El precio anterior se cierra y queda en el historial. Las ventas pasadas conservan su precio.
              </p>
            </form>
          )}

          <div>
            <h3 className="mb-2 text-sm font-semibold text-slate-800">Historial</h3>
            <div className="overflow-hidden rounded-lg ring-1 ring-slate-200">
              {prices.isPending ? (
                <LoadingBlock />
              ) : prices.isError ? (
                <ErrorState error={prices.error} onRetry={() => prices.refetch()} />
              ) : (
                <Table>
                  <THead>
                    <tr>
                      <TH>Precio</TH>
                      <TH>Desde</TH>
                      <TH>Hasta</TH>
                      <TH />
                    </tr>
                  </THead>
                  <TBody>
                    {prices.data.map((p) => (
                      <TR key={p.productPriceId}>
                        <TD className="tabular font-medium">{formatMoney(p.price)}</TD>
                        <TD>{formatDateTime(p.validFrom)}</TD>
                        <TD>{formatDateTime(p.validTo)}</TD>
                        <TD className="text-right">{p.isCurrent && <Badge tone="success">Vigente</Badge>}</TD>
                      </TR>
                    ))}
                  </TBody>
                </Table>
              )}
            </div>
          </div>
        </div>
      )}
    </Dialog>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg p-3 ring-1 ring-slate-200">
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="tabular mt-1 text-lg font-semibold text-slate-900">{value}</dd>
    </div>
  )
}
