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
import { Checkbox, Input, Select, Textarea } from '@/components/ui/input'
import { LoadingBlock } from '@/components/ui/spinner'
import { EmptyState, ErrorState } from '@/components/ui/states'
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table'
import { P } from '@/config/permissions'
import { Can } from '@/features/auth/guards'
import { optionalId, optionalText } from '@/lib/forms'
import type { Category } from '../api'
import { useCategories, useDeleteCategory, useSaveCategory } from '../queries'

export function CategoriesPage() {
  const categories = useCategories()
  const remove = useDeleteCategory()
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Category | null>(null)
  const [deleting, setDeleting] = useState<Category | null>(null)

  function openForm(category: Category | null) {
    setEditing(category)
    setFormOpen(true)
  }

  return (
    <>
      <PageHeader
        title="Categorías"
        description="Agrupan los productos. Una categoría puede tener una categoría padre."
        actions={
          <Can permission={P.CatalogManage}>
            <Button onClick={() => openForm(null)}>
              <Plus className="size-4" /> Nueva categoría
            </Button>
          </Can>
        }
      />

      <Card>
        {categories.isPending ? (
          <LoadingBlock />
        ) : categories.isError ? (
          <ErrorState error={categories.error} onRetry={() => categories.refetch()} />
        ) : categories.data.length === 0 ? (
          <EmptyState title="Aún no hay categorías" />
        ) : (
          <Table>
            <THead>
              <tr>
                <TH>Nombre</TH>
                <TH className="hidden sm:table-cell">Categoría padre</TH>
                <TH className="hidden md:table-cell">Descripción</TH>
                <TH>Estado</TH>
                <TH className="w-px" />
              </tr>
            </THead>
            <TBody>
              {categories.data.map((c) => (
                <TR key={c.categoryId}>
                  <TD className="font-medium text-slate-900">{c.name}</TD>
                  <TD className="hidden sm:table-cell">{c.parentCategoryName ?? '—'}</TD>
                  <TD className="hidden max-w-xs truncate md:table-cell">{c.description ?? '—'}</TD>
                  <TD>
                    <ActiveBadge active={c.isActive} />
                  </TD>
                  <TD>
                    <Can permission={P.CatalogManage}>
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" aria-label={`Editar ${c.name}`} title="Editar" onClick={() => openForm(c)}>
                          <Pencil className="size-4" />
                        </Button>
                        <Button variant="ghost" size="icon" aria-label={`Eliminar ${c.name}`} title="Eliminar" onClick={() => setDeleting(c)}>
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

      <CategoryFormDialog
        open={formOpen}
        category={editing}
        categories={categories.data ?? []}
        onClose={() => setFormOpen(false)}
      />
      <ConfirmDialog
        open={!!deleting}
        title="Eliminar categoría"
        message={`¿Eliminar "${deleting?.name}"? Si tiene productos o subcategorías, el sistema no lo permitirá; en ese caso desactívala.`}
        loading={remove.isPending}
        onClose={() => setDeleting(null)}
        onConfirm={() => deleting && remove.mutate(deleting.categoryId, { onSuccess: () => setDeleting(null) })}
      />
    </>
  )
}

const schema = z.object({
  name: z.string().trim().min(1, 'Requerido').max(100, 'Máximo 100 caracteres'),
  description: optionalText(255),
  parentCategoryId: optionalId,
  isActive: z.boolean(),
})

type FormInput = z.input<typeof schema>
type FormOutput = z.output<typeof schema>

function CategoryFormDialog({
  open,
  category,
  categories,
  onClose,
}: {
  open: boolean
  category: Category | null
  categories: Category[]
  onClose: () => void
}) {
  const save = useSaveCategory()
  const form = useForm<FormInput, unknown, FormOutput>({ resolver: zodResolver(schema) })
  const { errors } = form.formState

  useEffect(() => {
    if (open)
      form.reset({
        name: category?.name ?? '',
        description: category?.description ?? '',
        parentCategoryId: category?.parentCategoryId ?? '',
        isActive: category?.isActive ?? true,
      })
  }, [open, category, form])

  // Una categoría no puede ser su propia padre.
  const parents = categories.filter((c) => c.categoryId !== category?.categoryId && c.isActive)

  function onSubmit({ isActive, ...body }: FormOutput) {
    if (category) save.mutate({ id: category.categoryId, body: { ...body, isActive } }, { onSuccess: onClose })
    else save.mutate({ body }, { onSuccess: onClose })
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={category ? 'Editar categoría' : 'Nueva categoría'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={save.isPending}>
            Cancelar
          </Button>
          <Button type="submit" form="category-form" loading={save.isPending}>
            Guardar
          </Button>
        </>
      }
    >
      <form id="category-form" noValidate className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
        <Field label="Nombre" htmlFor="cat-name" required error={errors.name?.message}>
          <Input id="cat-name" aria-invalid={!!errors.name} {...form.register('name')} />
        </Field>
        <Field label="Categoría padre" htmlFor="cat-parent">
          <Select id="cat-parent" {...form.register('parentCategoryId')}>
            <option value="">Ninguna (categoría principal)</option>
            {parents.map((c) => (
              <option key={c.categoryId} value={c.categoryId}>
                {c.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Descripción" htmlFor="cat-desc" error={errors.description?.message}>
          <Textarea id="cat-desc" rows={3} {...form.register('description')} />
        </Field>
        {category && (
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <Checkbox {...form.register('isActive')} /> Activa
          </label>
        )}
      </form>
    </Dialog>
  )
}
