import { zodResolver } from '@hookform/resolvers/zod'
import { Pencil, Plus } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link } from 'react-router'
import { z } from 'zod'
import { PageHeader } from '@/components/page-header'
import { ActiveBadge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Dialog } from '@/components/ui/dialog'
import { Field } from '@/components/ui/field'
import { Checkbox, Input, Select } from '@/components/ui/input'
import { LoadingBlock } from '@/components/ui/spinner'
import { EmptyState, ErrorState } from '@/components/ui/states'
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table'
import { optionalText } from '@/lib/forms'
import type { WarehouseDetail } from '../api'
import { useBranches, useSaveWarehouse, useWarehouseDetails } from '../queries'

export function WarehousesPage() {
  const warehouses = useWarehouseDetails()
  const [editing, setEditing] = useState<WarehouseDetail | null>(null)
  const [open, setOpen] = useState(false)

  return (
    <>
      <PageHeader
        title="Almacenes"
        description="Dónde se guarda la mercadería. Cada almacén pertenece a una sucursal."
        actions={
          <Button
            onClick={() => {
              setEditing(null)
              setOpen(true)
            }}
          >
            <Plus className="size-4" /> Nuevo almacén
          </Button>
        }
      />
      <Card>
        {warehouses.isPending ? (
          <LoadingBlock />
        ) : warehouses.isError ? (
          <ErrorState error={warehouses.error} onRetry={() => warehouses.refetch()} />
        ) : warehouses.data.length === 0 ? (
          <EmptyState title="Sin almacenes" />
        ) : (
          <Table>
            <THead>
              <tr>
                <TH>Código</TH>
                <TH>Almacén</TH>
                <TH className="hidden md:table-cell">Sucursal</TH>
                <TH className="text-right">Productos con stock</TH>
                <TH>Estado</TH>
                <TH className="w-px" />
              </tr>
            </THead>
            <TBody>
              {warehouses.data.map((w) => (
                <TR key={w.warehouseId}>
                  <TD className="font-mono text-xs font-semibold">{w.code}</TD>
                  <TD>
                    <div className="font-medium text-slate-900">{w.name}</div>
                    {w.address && <div className="text-xs text-slate-500">{w.address}</div>}
                  </TD>
                  <TD className="hidden md:table-cell">{w.branchName}</TD>
                  <TD className="tabular text-right">
                    <Link to={`/inventory/stock?warehouseId=${w.warehouseId}`} className="text-brand-700 hover:underline">
                      {w.productsWithStock}
                    </Link>
                  </TD>
                  <TD>
                    <ActiveBadge active={w.isActive} />
                  </TD>
                  <TD>
                    <Button
                      variant="ghost"
                      size="icon"
                      title="Editar"
                      aria-label={`Editar ${w.name}`}
                      onClick={() => {
                        setEditing(w)
                        setOpen(true)
                      }}
                    >
                      <Pencil className="size-4" />
                    </Button>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </Card>
      {open && <WarehouseDialog warehouse={editing} onClose={() => setOpen(false)} />}
    </>
  )
}

const schema = z.object({
  branchId: z.string().min(1, 'Elige una sucursal'),
  code: z
    .string()
    .trim()
    .transform((v) => v.toUpperCase())
    .pipe(z.string().regex(/^[A-Z0-9]{2,10}$/, '2 a 10 letras o números')),
  name: z.string().trim().min(1, 'Requerido').max(100),
  address: optionalText(255),
  isActive: z.boolean(),
})
type FormInput = z.input<typeof schema>
type FormOutput = z.output<typeof schema>

function WarehouseDialog({ warehouse, onClose }: { warehouse: WarehouseDetail | null; onClose: () => void }) {
  const branches = useBranches()
  const save = useSaveWarehouse()
  const form = useForm<FormInput, unknown, FormOutput>({
    resolver: zodResolver(schema),
    defaultValues: {
      branchId: warehouse?.branchId ?? '',
      code: warehouse?.code ?? '',
      name: warehouse?.name ?? '',
      address: warehouse?.address ?? '',
      isActive: warehouse?.isActive ?? true,
    },
  })
  const { errors } = form.formState

  return (
    <Dialog
      open
      onClose={onClose}
      title={warehouse ? 'Editar almacén' : 'Nuevo almacén'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={save.isPending}>
            Cancelar
          </Button>
          <Button type="submit" form="warehouse-form" loading={save.isPending}>
            Guardar
          </Button>
        </>
      }
    >
      <form
        id="warehouse-form"
        noValidate
        className="grid gap-4 sm:grid-cols-[120px_1fr]"
        onSubmit={form.handleSubmit((body) => save.mutate({ id: warehouse?.warehouseId, body }, { onSuccess: onClose }))}
      >
        <Field label="Sucursal" htmlFor="wh-branch" required error={errors.branchId?.message} className="sm:col-span-2">
          <Select id="wh-branch" aria-invalid={!!errors.branchId} {...form.register('branchId')}>
            <option value="">Selecciona…</option>
            {branches.data?.map((b) => (
              <option key={b.branchId} value={b.branchId}>
                {b.code} · {b.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Código" htmlFor="wh-code" required error={errors.code?.message}>
          <Input id="wh-code" className="uppercase" maxLength={10} aria-invalid={!!errors.code} {...form.register('code')} />
        </Field>
        <Field label="Nombre" htmlFor="wh-name" required error={errors.name?.message}>
          <Input id="wh-name" aria-invalid={!!errors.name} {...form.register('name')} />
        </Field>
        <Field label="Dirección" htmlFor="wh-address" error={errors.address?.message} className="sm:col-span-2">
          <Input id="wh-address" {...form.register('address')} />
        </Field>
        {warehouse && (
          <label className="flex items-center gap-2 text-sm text-slate-700 sm:col-span-2">
            <Checkbox {...form.register('isActive')} /> Activo
            {warehouse.productsWithStock > 0 && <span className="text-xs text-slate-500">(tiene stock: no se podrá desactivar)</span>}
          </label>
        )}
      </form>
    </Dialog>
  )
}
