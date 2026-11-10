import { zodResolver } from '@hookform/resolvers/zod'
import { Pencil, Plus } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { PageHeader } from '@/components/page-header'
import { ActiveBadge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardHeader } from '@/components/ui/card'
import { Dialog } from '@/components/ui/dialog'
import { Field } from '@/components/ui/field'
import { Checkbox, Input } from '@/components/ui/input'
import { LoadingBlock } from '@/components/ui/spinner'
import { ErrorState } from '@/components/ui/states'
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table'
import { optionalText } from '@/lib/forms'
import type { Branch, Company } from '../api'
import { useBranches, useCompany, useSaveBranch, useSaveCompany } from '../queries'

export function CompanyPage() {
  const company = useCompany()
  const branches = useBranches()
  const [editing, setEditing] = useState<Branch | null>(null)
  const [open, setOpen] = useState(false)

  return (
    <>
      <PageHeader title="Empresa y sucursales" description="Datos que salen en los comprobantes y locales donde se vende." />

      <div className="space-y-6">
        <Card>
          <CardHeader title="Empresa" description="Aparece en la cabecera de boletas y facturas." />
          {company.isPending ? (
            <LoadingBlock />
          ) : company.isError ? (
            <ErrorState error={company.error} onRetry={() => company.refetch()} />
          ) : (
            <CompanyForm company={company.data} />
          )}
        </Card>

        <Card>
          <CardHeader
            title="Sucursales"
            description="Cada sucursal tiene sus almacenes y sus series de comprobantes."
            actions={
              <Button
                size="sm"
                onClick={() => {
                  setEditing(null)
                  setOpen(true)
                }}
              >
                <Plus className="size-4" /> Nueva sucursal
              </Button>
            }
          />
          {branches.isPending ? (
            <LoadingBlock />
          ) : branches.isError ? (
            <ErrorState error={branches.error} onRetry={() => branches.refetch()} />
          ) : (
            <Table>
              <THead>
                <tr>
                  <TH>Código</TH>
                  <TH>Nombre</TH>
                  <TH className="hidden md:table-cell">Dirección</TH>
                  <TH className="text-right">Almacenes</TH>
                  <TH>Estado</TH>
                  <TH className="w-px" />
                </tr>
              </THead>
              <TBody>
                {branches.data.map((b) => (
                  <TR key={b.branchId}>
                    <TD className="font-mono text-xs font-semibold">{b.code}</TD>
                    <TD className="font-medium text-slate-900">{b.name}</TD>
                    <TD className="hidden md:table-cell">{b.address ?? '—'}</TD>
                    <TD className="tabular text-right">{b.warehouseCount}</TD>
                    <TD>
                      <ActiveBadge active={b.isActive} />
                    </TD>
                    <TD>
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Editar"
                        aria-label={`Editar ${b.name}`}
                        onClick={() => {
                          setEditing(b)
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
      </div>

      {open && <BranchDialog branch={editing} onClose={() => setOpen(false)} />}
    </>
  )
}

const companySchema = z.object({
  ruc: z.string().trim().regex(/^\d{11}$/, 'El RUC tiene 11 dígitos'),
  businessName: z.string().trim().min(1, 'Requerido').max(200),
  tradeName: optionalText(200),
  address: optionalText(255),
  phone: optionalText(20),
  email: optionalText(150).refine((v) => v === null || z.email().safeParse(v).success, 'Correo no válido'),
  logoUrl: optionalText(500).refine((v) => v === null || URL.canParse(v), 'URL no válida'),
})
type CompanyInput = z.input<typeof companySchema>
type CompanyOutput = z.output<typeof companySchema>

function CompanyForm({ company }: { company: Company }) {
  const save = useSaveCompany()
  const form = useForm<CompanyInput, unknown, CompanyOutput>({
    resolver: zodResolver(companySchema),
    defaultValues: {
      ruc: company.ruc,
      businessName: company.businessName,
      tradeName: company.tradeName ?? '',
      address: company.address ?? '',
      phone: company.phone ?? '',
      email: company.email ?? '',
      logoUrl: company.logoUrl ?? '',
    },
  })
  const { errors, isDirty } = form.formState

  return (
    <form
      noValidate
      className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-3"
      onSubmit={form.handleSubmit((body) => save.mutate(body, { onSuccess: () => form.reset(form.getValues()) }))}
    >
      <Field label="RUC" htmlFor="co-ruc" required error={errors.ruc?.message}>
        <Input id="co-ruc" inputMode="numeric" maxLength={11} aria-invalid={!!errors.ruc} {...form.register('ruc')} />
      </Field>
      <Field label="Razón social" htmlFor="co-name" required error={errors.businessName?.message} className="lg:col-span-2">
        <Input id="co-name" aria-invalid={!!errors.businessName} {...form.register('businessName')} />
      </Field>
      <Field label="Nombre comercial" htmlFor="co-trade" error={errors.tradeName?.message}>
        <Input id="co-trade" {...form.register('tradeName')} />
      </Field>
      <Field label="Teléfono" htmlFor="co-phone" error={errors.phone?.message}>
        <Input id="co-phone" type="tel" {...form.register('phone')} />
      </Field>
      <Field label="Correo" htmlFor="co-email" error={errors.email?.message} hint="Recibe las alertas de stock.">
        <Input id="co-email" type="email" aria-invalid={!!errors.email} {...form.register('email')} />
      </Field>
      <Field label="Dirección fiscal" htmlFor="co-address" error={errors.address?.message} className="sm:col-span-2">
        <Input id="co-address" {...form.register('address')} />
      </Field>
      <Field label="URL del logo" htmlFor="co-logo" error={errors.logoUrl?.message}>
        <Input id="co-logo" type="url" placeholder="https://…" {...form.register('logoUrl')} />
      </Field>
      <div className="flex justify-end sm:col-span-2 lg:col-span-3">
        <Button type="submit" loading={save.isPending} disabled={!isDirty}>
          Guardar cambios
        </Button>
      </div>
    </form>
  )
}

const branchSchema = z.object({
  code: z
    .string()
    .trim()
    .transform((v) => v.toUpperCase())
    .pipe(z.string().regex(/^[A-Z0-9]{2,10}$/, '2 a 10 letras o números')),
  name: z.string().trim().min(1, 'Requerido').max(100),
  address: optionalText(255),
  phone: optionalText(20),
  isActive: z.boolean(),
})
type BranchInput = z.input<typeof branchSchema>
type BranchOutput = z.output<typeof branchSchema>

function BranchDialog({ branch, onClose }: { branch: Branch | null; onClose: () => void }) {
  const save = useSaveBranch()
  const form = useForm<BranchInput, unknown, BranchOutput>({
    resolver: zodResolver(branchSchema),
    defaultValues: {
      code: branch?.code ?? '',
      name: branch?.name ?? '',
      address: branch?.address ?? '',
      phone: branch?.phone ?? '',
      isActive: branch?.isActive ?? true,
    },
  })
  const { errors } = form.formState

  return (
    <Dialog
      open
      onClose={onClose}
      title={branch ? 'Editar sucursal' : 'Nueva sucursal'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={save.isPending}>
            Cancelar
          </Button>
          <Button type="submit" form="branch-form" loading={save.isPending}>
            Guardar
          </Button>
        </>
      }
    >
      <form
        id="branch-form"
        noValidate
        className="grid gap-4 sm:grid-cols-[120px_1fr]"
        onSubmit={form.handleSubmit((body) => save.mutate({ id: branch?.branchId, body }, { onSuccess: onClose }))}
      >
        <Field label="Código" htmlFor="br-code" required error={errors.code?.message}>
          <Input id="br-code" className="uppercase" maxLength={10} aria-invalid={!!errors.code} {...form.register('code')} />
        </Field>
        <Field label="Nombre" htmlFor="br-name" required error={errors.name?.message}>
          <Input id="br-name" aria-invalid={!!errors.name} {...form.register('name')} />
        </Field>
        <Field label="Dirección" htmlFor="br-address" error={errors.address?.message} className="sm:col-span-2">
          <Input id="br-address" {...form.register('address')} />
        </Field>
        <Field label="Teléfono" htmlFor="br-phone" error={errors.phone?.message} className="sm:col-span-2">
          <Input id="br-phone" type="tel" {...form.register('phone')} />
        </Field>
        {branch && (
          <label className="flex items-center gap-2 text-sm text-slate-700 sm:col-span-2">
            <Checkbox {...form.register('isActive')} /> Activa
          </label>
        )}
      </form>
    </Dialog>
  )
}
