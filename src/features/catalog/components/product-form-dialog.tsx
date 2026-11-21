import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { Field } from '@/components/ui/field'
import { Checkbox, Input, Select, Textarea } from '@/components/ui/input'
import { asNullableNumber, asNumber, money, optionalId, optionalText, quantity } from '@/lib/forms'
import type { Product } from '../api'
import { useBrands, useCategories, useSaveProduct, useUnits } from '../queries'

const schema = z
  .object({
    sku: z.string().trim().min(1, 'Requerido').max(50, 'Máximo 50 caracteres'),
    barcode: optionalText(50),
    name: z.string().trim().min(1, 'Requerido').max(200, 'Máximo 200 caracteres'),
    description: optionalText(1000),
    categoryId: z.string().min(1, 'Elige una categoría'),
    brandId: optionalId,
    unitId: z.string().min(1, 'Elige una unidad'),
    isTaxable: z.boolean(),
    minStock: quantity,
    maxStock: quantity.nullable(),
    // El precio solo se pide al crear; después se cambia con "Cambiar precio" (queda historial).
    price: money.nullable(),
    imageUrl: optionalText(500).refine((v) => v === null || URL.canParse(v), 'URL no válida'),
    isActive: z.boolean(),
  })
  .refine((v) => v.maxStock === null || v.maxStock >= v.minStock, {
    path: ['maxStock'],
    message: 'Debe ser mayor o igual al stock mínimo',
  })

type FormInput = z.input<typeof schema>
type FormOutput = z.output<typeof schema>

function toDefaults(product: Product | null): FormInput {
  return {
    sku: product?.sku ?? '',
    barcode: product?.barcode ?? '',
    name: product?.name ?? '',
    description: product?.description ?? '',
    categoryId: product?.categoryId ?? '',
    brandId: product?.brandId ?? '',
    unitId: product?.unitId ?? '',
    isTaxable: product?.isTaxable ?? true,
    minStock: product?.minStock ?? 0,
    maxStock: product?.maxStock ?? null,
    price: product ? null : Number.NaN,
    imageUrl: product?.imageUrl ?? '',
    isActive: product?.isActive ?? true,
  }
}

interface Props {
  open: boolean
  product: Product | null
  onClose: () => void
}

export function ProductFormDialog({ open, product, onClose }: Props) {
  const isEdit = !!product
  const categories = useCategories()
  const brands = useBrands()
  const units = useUnits()
  const save = useSaveProduct()

  const form = useForm<FormInput, unknown, FormOutput>({
    resolver: zodResolver(schema),
    defaultValues: toDefaults(product),
  })
  const { errors } = form.formState

  useEffect(() => {
    if (open) form.reset(toDefaults(product))
  }, [open, product, form])

  function onSubmit(values: FormOutput) {
    const common = {
      barcode: values.barcode,
      name: values.name,
      description: values.description,
      categoryId: values.categoryId,
      brandId: values.brandId,
      unitId: values.unitId,
      isTaxable: values.isTaxable,
      minStock: values.minStock,
      maxStock: values.maxStock,
      imageUrl: values.imageUrl,
    }

    if (product) {
      save.mutate({ id: product.productId, body: { ...common, isActive: values.isActive } }, { onSuccess: onClose })
    } else {
      if (values.price === null) {
        form.setError('price', { message: 'Ingresa el precio de venta' })
        return
      }
      save.mutate({ body: { ...common, sku: values.sku, price: values.price } }, { onSuccess: onClose })
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="lg"
      title={isEdit ? 'Editar producto' : 'Nuevo producto'}
      description={isEdit ? `SKU ${product.sku}` : 'Los campos con * son obligatorios.'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={save.isPending}>
            Cancelar
          </Button>
          <Button type="submit" form="product-form" loading={save.isPending}>
            {isEdit ? 'Guardar cambios' : 'Crear producto'}
          </Button>
        </>
      }
    >
      <form id="product-form" noValidate onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4 sm:grid-cols-2">
        <Field label="SKU" htmlFor="sku" required error={errors.sku?.message} hint={isEdit ? 'El SKU no se puede cambiar.' : undefined}>
          <Input id="sku" readOnly={isEdit} className="read-only:bg-slate-50 read-only:text-slate-500" aria-invalid={!!errors.sku} {...form.register('sku')} />
        </Field>
        <Field label="Código de barras" htmlFor="barcode" error={errors.barcode?.message}>
          <Input id="barcode" inputMode="numeric" {...form.register('barcode')} />
        </Field>

        <Field label="Nombre" htmlFor="name" required error={errors.name?.message} className="sm:col-span-2">
          <Input id="name" aria-invalid={!!errors.name} {...form.register('name')} />
        </Field>

        <Field label="Categoría" htmlFor="categoryId" required error={errors.categoryId?.message}>
          <Select id="categoryId" aria-invalid={!!errors.categoryId} {...form.register('categoryId')}>
            <option value="">Selecciona…</option>
            {categories.data
              ?.filter((c) => c.isActive || c.categoryId === product?.categoryId)
              .map((c) => (
                <option key={c.categoryId} value={c.categoryId}>
                  {c.parentCategoryName ? `${c.parentCategoryName} › ${c.name}` : c.name}
                </option>
              ))}
          </Select>
        </Field>
        <Field label="Marca" htmlFor="brandId" error={errors.brandId?.message}>
          <Select id="brandId" {...form.register('brandId')}>
            <option value="">Sin marca</option>
            {brands.data
              ?.filter((b) => b.isActive || b.brandId === product?.brandId)
              .map((b) => (
                <option key={b.brandId} value={b.brandId}>
                  {b.name}
                </option>
              ))}
          </Select>
        </Field>

        <Field label="Unidad" htmlFor="unitId" required error={errors.unitId?.message}>
          <Select id="unitId" aria-invalid={!!errors.unitId} {...form.register('unitId')}>
            <option value="">Selecciona…</option>
            {units.data?.map((u) => (
              <option key={u.unitId} value={u.unitId}>
                {u.code} · {u.name}
              </option>
            ))}
          </Select>
        </Field>
        {!isEdit ? (
          <Field label="Precio de venta (S/)" htmlFor="price" required error={errors.price?.message} hint="Incluye IGV.">
            <Input
              id="price"
              type="number"
              step="0.01"
              min="0"
              aria-invalid={!!errors.price}
              {...form.register('price', { setValueAs: asNullableNumber })}
            />
          </Field>
        ) : (
          <div className="hidden sm:block" />
        )}

        <Field label="Stock mínimo" htmlFor="minStock" required error={errors.minStock?.message} hint="Debajo de esto se considera stock bajo.">
          <Input
            id="minStock"
            type="number"
            step="0.001"
            min="0"
            aria-invalid={!!errors.minStock}
            {...form.register('minStock', { setValueAs: asNumber })}
          />
        </Field>
        <Field label="Stock máximo" htmlFor="maxStock" error={errors.maxStock?.message}>
          <Input
            id="maxStock"
            type="number"
            step="0.001"
            min="0"
            aria-invalid={!!errors.maxStock}
            {...form.register('maxStock', { setValueAs: asNullableNumber })}
          />
        </Field>

        <Field label="URL de imagen" htmlFor="imageUrl" error={errors.imageUrl?.message} className="sm:col-span-2">
          <Input id="imageUrl" type="url" placeholder="https://…" {...form.register('imageUrl')} />
        </Field>

        <Field label="Descripción" htmlFor="description" error={errors.description?.message} className="sm:col-span-2">
          <Textarea id="description" rows={3} {...form.register('description')} />
        </Field>

        <div className="flex flex-wrap gap-6 sm:col-span-2">
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <Checkbox {...form.register('isTaxable')} />
            Afecto a IGV (18%)
          </label>
          {isEdit && (
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <Checkbox {...form.register('isActive')} />
              Activo
            </label>
          )}
        </div>
      </form>
    </Dialog>
  )
}
