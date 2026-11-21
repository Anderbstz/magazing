import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowDownToLine, ArrowUpFromLine, X } from 'lucide-react'
import { useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { z } from 'zod'
import { ProductPicker } from '@/components/product-picker'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { Field } from '@/components/ui/field'
import { Input, Select, Textarea } from '@/components/ui/input'
import { asNullableNumber, asNumber } from '@/lib/forms'
import { formatQuantity } from '@/lib/format'
import { cn } from '@/lib/utils'
import { useAdjustStock, useWarehouses } from '../queries'

export interface AdjustTarget {
  productId: string
  productName: string
  unitCode: string
  warehouseId: string
  currentStock?: number
}

const schema = z
  .object({
    warehouseId: z.string().min(1, 'Elige un almacén'),
    type: z.enum(['ADJUST_IN', 'ADJUST_OUT']),
    quantity: z.number({ error: 'Ingresa la cantidad' }).positive('Debe ser mayor a cero'),
    unitCost: z.number().min(0, 'No puede ser negativo').nullable(),
    reason: z.string().trim().min(5, 'Explica el motivo (mínimo 5 caracteres)').max(255, 'Máximo 255 caracteres'),
  })

type FormValues = z.infer<typeof schema>

const REASONS = {
  ADJUST_IN: ['Sobrante en conteo físico', 'Devolución de cliente sin comprobante', 'Corrección de registro'],
  ADJUST_OUT: ['Merma por vencimiento', 'Producto dañado', 'Faltante en conteo físico', 'Consumo interno'],
}

/**
 * Regla 9: ajustes ADJUST_IN / ADJUST_OUT con motivo obligatorio.
 * Se monta al abrirse, así cada apertura arranca limpia.
 */
export function AdjustDialog({ target, onClose }: { target: AdjustTarget | null; onClose: () => void }) {
  const warehouses = useWarehouses()
  const adjust = useAdjustStock()
  const [product, setProduct] = useState(target ? { id: target.productId, name: target.productName, unit: target.unitCode } : null)
  const [productError, setProductError] = useState<string | null>(null)

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      warehouseId: target?.warehouseId ?? '',
      type: 'ADJUST_OUT',
      quantity: Number.NaN,
      unitCost: null,
      reason: '',
    },
  })
  const { errors } = form.formState
  const type = useWatch({ control: form.control, name: 'type' })

  function onSubmit(values: FormValues) {
    if (!product) {
      setProductError('Elige un producto')
      return
    }
    adjust.mutate(
      {
        productId: product.id,
        warehouseId: values.warehouseId,
        type: values.type,
        quantity: values.quantity,
        unitCost: values.type === 'ADJUST_IN' ? values.unitCost : null,
        reason: values.reason,
      },
      { onSuccess: onClose },
    )
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title="Ajuste de inventario"
      description="Queda registrado en el kardex con tu usuario y el motivo."
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={adjust.isPending}>
            Cancelar
          </Button>
          <Button type="submit" form="adjust-form" loading={adjust.isPending}>
            Registrar ajuste
          </Button>
        </>
      }
    >
      <form id="adjust-form" noValidate className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
        <Field label="Producto" required error={productError ?? undefined}>
          {product ? (
            <div className="flex h-10 items-center justify-between rounded-lg bg-slate-50 px-3 text-sm ring-1 ring-slate-200">
              <span className="truncate font-medium text-slate-800">{product.name}</span>
              {!target && (
                <button type="button" onClick={() => setProduct(null)} className="text-slate-400 hover:text-slate-600" aria-label="Cambiar producto">
                  <X className="size-4" />
                </button>
              )}
            </div>
          ) : (
            <ProductPicker
              show="cost"
              onSelect={(p) => {
                setProduct({ id: p.productId, name: p.name, unit: p.unitCode })
                setProductError(null)
              }}
            />
          )}
          {target?.currentStock !== undefined && (
            <p className="text-xs text-slate-500">
              Stock actual: {formatQuantity(target.currentStock)} {target.unitCode}
            </p>
          )}
        </Field>

        <Field label="Almacén" htmlFor="adj-wh" required error={errors.warehouseId?.message}>
          <Select id="adj-wh" {...form.register('warehouseId')}>
            <option value="">Selecciona…</option>
            {warehouses.data?.map((w) => (
              <option key={w.warehouseId} value={w.warehouseId}>
                {w.code} · {w.name}
              </option>
            ))}
          </Select>
        </Field>

        <fieldset>
          <legend className="mb-1.5 text-sm font-medium text-slate-700">Tipo</legend>
          <div className="grid grid-cols-2 gap-2">
            {(
              [
                ['ADJUST_IN', 'Ingreso', ArrowDownToLine, 'peer-checked:bg-emerald-50 peer-checked:ring-emerald-500 peer-checked:text-emerald-800'],
                ['ADJUST_OUT', 'Salida', ArrowUpFromLine, 'peer-checked:bg-red-50 peer-checked:ring-red-500 peer-checked:text-red-800'],
              ] as const
            ).map(([value, label, Icon, checked]) => (
              <label key={value} className="cursor-pointer">
                <input type="radio" value={value} className="peer sr-only" {...form.register('type')} />
                <span
                  className={cn(
                    'flex h-10 items-center justify-center gap-2 rounded-lg text-sm font-medium text-slate-600 ring-1 ring-slate-300 transition-colors peer-focus-visible:outline-2 peer-focus-visible:outline-brand-600',
                    checked,
                  )}
                >
                  <Icon className="size-4" /> {label}
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={`Cantidad${product ? ` (${product.unit})` : ''}`} htmlFor="adj-qty" required error={errors.quantity?.message}>
            <Input id="adj-qty" type="number" step="0.001" min="0" aria-invalid={!!errors.quantity} {...form.register('quantity', { setValueAs: asNumber })} />
          </Field>
          {type === 'ADJUST_IN' && (
            <Field label="Costo unitario (S/)" htmlFor="adj-cost" error={errors.unitCost?.message} hint="Sin IGV. Vacío = costo promedio actual.">
              <Input id="adj-cost" type="number" step="0.0001" min="0" {...form.register('unitCost', { setValueAs: asNullableNumber })} />
            </Field>
          )}
        </div>

        <Field label="Motivo" htmlFor="adj-reason" required error={errors.reason?.message}>
          <Textarea id="adj-reason" rows={2} aria-invalid={!!errors.reason} {...form.register('reason')} />
          <div className="flex flex-wrap gap-1.5 pt-1">
            {REASONS[type].map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => form.setValue('reason', r, { shouldValidate: true })}
                className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-200"
              >
                {r}
              </button>
            ))}
          </div>
        </Field>
      </form>
    </Dialog>
  )
}
