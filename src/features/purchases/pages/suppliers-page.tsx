import { zodResolver } from '@hookform/resolvers/zod'
import { Pencil, Plus, Search } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { PageHeader } from '@/components/page-header'
import { ActiveBadge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Dialog } from '@/components/ui/dialog'
import { Field } from '@/components/ui/field'
import { Checkbox, Input } from '@/components/ui/input'
import { Pagination } from '@/components/ui/pagination'
import { LoadingBlock } from '@/components/ui/spinner'
import { EmptyState, ErrorState } from '@/components/ui/states'
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table'
import { P } from '@/config/permissions'
import { Can } from '@/features/auth/guards'
import { useDebouncedValue } from '@/hooks/use-debounced-value'
import { optionalText } from '@/lib/forms'
import type { Supplier } from '../api'
import { useSaveSupplier, useSuppliers } from '../queries'

export function SuppliersPage() {
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const debounced = useDebouncedValue(search.trim())
  const suppliers = useSuppliers({ page, pageSize: 20, search: debounced || undefined })
  const [editing, setEditing] = useState<Supplier | null>(null)
  const [open, setOpen] = useState(false)

  return (
    <>
      <PageHeader
        title="Proveedores"
        actions={
          <Can permission={P.SuppliersManage}>
            <Button
              onClick={() => {
                setEditing(null)
                setOpen(true)
              }}
            >
              <Plus className="size-4" /> Nuevo proveedor
            </Button>
          </Can>
        }
      />

      <Card>
        <div className="border-b border-slate-200 p-4">
          <div className="relative max-w-md">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" />
            <Input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setPage(1)
              }}
              placeholder="Buscar por razón social o RUC"
              className="pl-9"
              aria-label="Buscar proveedores"
            />
          </div>
        </div>
        {suppliers.isPending ? (
          <LoadingBlock />
        ) : suppliers.isError ? (
          <ErrorState error={suppliers.error} onRetry={() => suppliers.refetch()} />
        ) : suppliers.data.items.length === 0 ? (
          <EmptyState title="Sin proveedores" />
        ) : (
          <>
            <Table>
              <THead>
                <tr>
                  <TH>Proveedor</TH>
                  <TH className="hidden md:table-cell">Contacto</TH>
                  <TH className="hidden lg:table-cell">Teléfono</TH>
                  <TH>Estado</TH>
                  <TH className="w-px" />
                </tr>
              </THead>
              <TBody>
                {suppliers.data.items.map((s) => (
                  <TR key={s.supplierId}>
                    <TD>
                      <div className="font-medium text-slate-900">{s.businessName}</div>
                      <div className="font-mono text-xs text-slate-500">RUC {s.ruc}</div>
                    </TD>
                    <TD className="hidden md:table-cell">
                      {s.contactName ?? '—'}
                      {s.email && <div className="text-xs text-slate-500">{s.email}</div>}
                    </TD>
                    <TD className="hidden lg:table-cell">{s.phone ?? '—'}</TD>
                    <TD>
                      <ActiveBadge active={s.isActive} />
                    </TD>
                    <TD>
                      <Can permission={P.SuppliersManage}>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`Editar ${s.businessName}`}
                          title="Editar"
                          onClick={() => {
                            setEditing(s)
                            setOpen(true)
                          }}
                        >
                          <Pencil className="size-4" />
                        </Button>
                      </Can>
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
            <Pagination page={suppliers.data.page} totalPages={suppliers.data.totalPages} totalCount={suppliers.data.totalCount} onPageChange={setPage} />
          </>
        )}
      </Card>

      {open && <SupplierDialog supplier={editing} onClose={() => setOpen(false)} />}
    </>
  )
}

const schema = z.object({
  ruc: z.string().trim().regex(/^\d{11}$/, 'El RUC tiene 11 dígitos'),
  businessName: z.string().trim().min(1, 'Requerido').max(200, 'Máximo 200 caracteres'),
  contactName: optionalText(150),
  email: optionalText(150).refine((v) => v === null || z.email().safeParse(v).success, 'Correo no válido'),
  phone: optionalText(20),
  address: optionalText(255),
  isActive: z.boolean(),
})
type FormInput = z.input<typeof schema>
type FormOutput = z.output<typeof schema>

function SupplierDialog({ supplier, onClose }: { supplier: Supplier | null; onClose: () => void }) {
  const save = useSaveSupplier()
  const form = useForm<FormInput, unknown, FormOutput>({
    resolver: zodResolver(schema),
    defaultValues: {
      ruc: supplier?.ruc ?? '',
      businessName: supplier?.businessName ?? '',
      contactName: supplier?.contactName ?? '',
      email: supplier?.email ?? '',
      phone: supplier?.phone ?? '',
      address: supplier?.address ?? '',
      isActive: supplier?.isActive ?? true,
    },
  })
  const { errors } = form.formState

  return (
    <Dialog
      open
      onClose={onClose}
      title={supplier ? 'Editar proveedor' : 'Nuevo proveedor'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={save.isPending}>
            Cancelar
          </Button>
          <Button type="submit" form="supplier-form" loading={save.isPending}>
            Guardar
          </Button>
        </>
      }
    >
      <form
        id="supplier-form"
        noValidate
        className="grid gap-4 sm:grid-cols-2"
        onSubmit={form.handleSubmit(({ isActive, ...body }) => save.mutate({ id: supplier?.supplierId, body, isActive }, { onSuccess: onClose }))}
      >
        <Field label="RUC" htmlFor="sup-ruc" required error={errors.ruc?.message}>
          <Input id="sup-ruc" inputMode="numeric" maxLength={11} aria-invalid={!!errors.ruc} {...form.register('ruc')} />
        </Field>
        <Field label="Teléfono" htmlFor="sup-phone" error={errors.phone?.message}>
          <Input id="sup-phone" type="tel" {...form.register('phone')} />
        </Field>
        <Field label="Razón social" htmlFor="sup-name" required error={errors.businessName?.message} className="sm:col-span-2">
          <Input id="sup-name" aria-invalid={!!errors.businessName} {...form.register('businessName')} />
        </Field>
        <Field label="Contacto" htmlFor="sup-contact" error={errors.contactName?.message}>
          <Input id="sup-contact" {...form.register('contactName')} />
        </Field>
        <Field label="Correo" htmlFor="sup-email" error={errors.email?.message}>
          <Input id="sup-email" type="email" aria-invalid={!!errors.email} {...form.register('email')} />
        </Field>
        <Field label="Dirección" htmlFor="sup-address" error={errors.address?.message} className="sm:col-span-2">
          <Input id="sup-address" {...form.register('address')} />
        </Field>
        {supplier && (
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <Checkbox {...form.register('isActive')} /> Activo
          </label>
        )}
      </form>
    </Dialog>
  )
}
