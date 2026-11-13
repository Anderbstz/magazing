import { zodResolver } from '@hookform/resolvers/zod'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { PageHeader } from '@/components/page-header'
import { ActiveBadge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Dialog } from '@/components/ui/dialog'
import { Field } from '@/components/ui/field'
import { Checkbox, Input } from '@/components/ui/input'
import { LoadingBlock } from '@/components/ui/spinner'
import { EmptyState, ErrorState } from '@/components/ui/states'
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table'
import { P } from '@/config/permissions'
import { Can } from '@/features/auth/guards'
import { formatDate } from '@/lib/format'
import type { Brand } from '../api'
import { useBrands, useDeleteBrand, useSaveBrand } from '../queries'

export function BrandsPage() {
  const brands = useBrands()
  const remove = useDeleteBrand()
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Brand | null>(null)
  const [deleting, setDeleting] = useState<Brand | null>(null)

  function openForm(brand: Brand | null) {
    setEditing(brand)
    setFormOpen(true)
  }

  return (
    <>
      <PageHeader
        title="Marcas"
        actions={
          <Can permission={P.CatalogManage}>
            <Button onClick={() => openForm(null)}>
              <Plus className="size-4" /> Nueva marca
            </Button>
          </Can>
        }
      />

      <Card>
        {brands.isPending ? (
          <LoadingBlock />
        ) : brands.isError ? (
          <ErrorState error={brands.error} onRetry={() => brands.refetch()} />
        ) : brands.data.length === 0 ? (
          <EmptyState title="Aún no hay marcas" />
        ) : (
          <Table>
            <THead>
              <tr>
                <TH>Nombre</TH>
                <TH className="hidden sm:table-cell">Creada</TH>
                <TH>Estado</TH>
                <TH className="w-px" />
              </tr>
            </THead>
            <TBody>
              {brands.data.map((b) => (
                <TR key={b.brandId}>
                  <TD className="font-medium text-slate-900">{b.name}</TD>
                  <TD className="hidden sm:table-cell">{formatDate(b.createdAt)}</TD>
                  <TD>
                    <ActiveBadge active={b.isActive} />
                  </TD>
                  <TD>
                    <Can permission={P.CatalogManage}>
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" aria-label={`Editar ${b.name}`} title="Editar" onClick={() => openForm(b)}>
                          <Pencil className="size-4" />
                        </Button>
                        <Button variant="ghost" size="icon" aria-label={`Eliminar ${b.name}`} title="Eliminar" onClick={() => setDeleting(b)}>
                          <Trash2 className="size-4 text-red-600" />
                        </Button>
                      </div>
                    </Can>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </Card>

      <BrandFormDialog open={formOpen} brand={editing} onClose={() => setFormOpen(false)} />
      <ConfirmDialog
        open={!!deleting}
        title="Eliminar marca"
        message={`¿Eliminar "${deleting?.name}"? Si tiene productos, el sistema no lo permitirá; en ese caso desactívala.`}
        loading={remove.isPending}
        onClose={() => setDeleting(null)}
        onConfirm={() => deleting && remove.mutate(deleting.brandId, { onSuccess: () => setDeleting(null) })}
      />
    </>
  )
}

const schema = z.object({
  name: z.string().trim().min(1, 'Requerido').max(100, 'Máximo 100 caracteres'),
  isActive: z.boolean(),
})
type FormValues = z.infer<typeof schema>

function BrandFormDialog({ open, brand, onClose }: { open: boolean; brand: Brand | null; onClose: () => void }) {
  const save = useSaveBrand()
  const form = useForm<FormValues>({ resolver: zodResolver(schema) })

  useEffect(() => {
    if (open) form.reset({ name: brand?.name ?? '', isActive: brand?.isActive ?? true })
  }, [open, brand, form])

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={brand ? 'Editar marca' : 'Nueva marca'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={save.isPending}>
            Cancelar
          </Button>
          <Button type="submit" form="brand-form" loading={save.isPending}>
            Guardar
          </Button>
        </>
      }
    >
      <form
        id="brand-form"
        noValidate
        className="space-y-4"
        onSubmit={form.handleSubmit((values) => save.mutate({ id: brand?.brandId, ...values }, { onSuccess: onClose }))}
      >
        <Field label="Nombre" htmlFor="brand-name" required error={form.formState.errors.name?.message}>
          <Input id="brand-name" aria-invalid={!!form.formState.errors.name} {...form.register('name')} />
        </Field>
        {brand && (
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <Checkbox {...form.register('isActive')} /> Activa
          </label>
        )}
      </form>
    </Dialog>
  )
}
