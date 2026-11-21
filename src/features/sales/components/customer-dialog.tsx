import { zodResolver } from '@hookform/resolvers/zod'
import { useForm, useWatch } from 'react-hook-form'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { Field } from '@/components/ui/field'
import { Checkbox, Input, Select } from '@/components/ui/input'
import { optionalText } from '@/lib/forms'
import type { Customer } from '../api'
import { useSaveCustomer } from '../queries'

const DOC_HINT = {
  DNI: '8 dígitos',
  RUC: '11 dígitos (necesario para factura)',
  CE: '6 a 20 caracteres',
  PASSPORT: '6 a 20 caracteres',
} as const

// Mismas reglas que el CHECK `customers_document_number_check` de la BD.
const schema = z
  .object({
    documentType: z.enum(['DNI', 'RUC', 'CE', 'PASSPORT']),
    documentNumber: z.string().trim(),
    fullName: z.string().trim().min(1, 'Requerido').max(200, 'Máximo 200 caracteres'),
    email: optionalText(150).refine((v) => v === null || z.email().safeParse(v).success, 'Correo no válido'),
    phone: optionalText(20),
    address: optionalText(255),
    isActive: z.boolean(),
  })
  .superRefine((v, ctx) => {
    const ok =
      v.documentType === 'DNI'
        ? /^\d{8}$/.test(v.documentNumber)
        : v.documentType === 'RUC'
          ? /^\d{11}$/.test(v.documentNumber)
          : v.documentNumber.length >= 6 && v.documentNumber.length <= 20
    if (!ok) ctx.addIssue({ code: 'custom', path: ['documentNumber'], message: `Debe tener ${DOC_HINT[v.documentType]}` })
  })

type FormInput = z.input<typeof schema>
type FormOutput = z.output<typeof schema>

/** Alta/edición de cliente. Se monta al abrirse. `onSaved` recibe el cliente guardado (para el punto de venta). */
export function CustomerDialog({
  customer,
  defaultDocumentType = 'DNI',
  onClose,
  onSaved,
}: {
  customer: Customer | null
  defaultDocumentType?: FormInput['documentType']
  onClose: () => void
  onSaved?: (customer: Customer) => void
}) {
  const save = useSaveCustomer()
  const form = useForm<FormInput, unknown, FormOutput>({
    resolver: zodResolver(schema),
    defaultValues: {
      documentType: customer?.documentType ?? defaultDocumentType,
      documentNumber: customer?.documentNumber ?? '',
      fullName: customer?.fullName ?? '',
      email: customer?.email ?? '',
      phone: customer?.phone ?? '',
      address: customer?.address ?? '',
      isActive: customer?.isActive ?? true,
    },
  })
  const { errors } = form.formState
  const documentType = useWatch({ control: form.control, name: 'documentType' })

  return (
    <Dialog
      open
      onClose={onClose}
      title={customer ? 'Editar cliente' : 'Nuevo cliente'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={save.isPending}>
            Cancelar
          </Button>
          <Button type="submit" form="customer-form" loading={save.isPending}>
            Guardar
          </Button>
        </>
      }
    >
      <form
        id="customer-form"
        noValidate
        className="grid gap-4 sm:grid-cols-[140px_1fr]"
        onSubmit={(e) => {
          // El formulario puede abrirse dentro de otro (punto de venta): que no envíe al de afuera.
          e.stopPropagation()
          void form.handleSubmit(({ isActive, ...body }) =>
            save.mutate({ id: customer?.customerId, body, isActive }, { onSuccess: (c) => (onSaved ? onSaved(c) : onClose()) }),
          )(e)
        }}
      >
        <Field label="Documento" htmlFor="cus-doctype" required>
          <Select id="cus-doctype" {...form.register('documentType')}>
            <option value="DNI">DNI</option>
            <option value="RUC">RUC</option>
            <option value="CE">Carné ext.</option>
            <option value="PASSPORT">Pasaporte</option>
          </Select>
        </Field>
        <Field label="Número" htmlFor="cus-docnum" required error={errors.documentNumber?.message} hint={DOC_HINT[documentType]}>
          <Input id="cus-docnum" autoFocus inputMode={documentType === 'DNI' || documentType === 'RUC' ? 'numeric' : 'text'} aria-invalid={!!errors.documentNumber} {...form.register('documentNumber')} />
        </Field>
        <Field label={documentType === 'RUC' ? 'Razón social' : 'Nombre completo'} htmlFor="cus-name" required error={errors.fullName?.message} className="sm:col-span-2">
          <Input id="cus-name" aria-invalid={!!errors.fullName} {...form.register('fullName')} />
        </Field>
        <Field label="Correo" htmlFor="cus-email" error={errors.email?.message} hint="Para enviarle el comprobante.">
          <Input id="cus-email" type="email" {...form.register('email')} />
        </Field>
        <Field label="Teléfono" htmlFor="cus-phone" error={errors.phone?.message}>
          <Input id="cus-phone" type="tel" {...form.register('phone')} />
        </Field>
        <Field label="Dirección" htmlFor="cus-address" error={errors.address?.message} className="sm:col-span-2">
          <Input id="cus-address" {...form.register('address')} />
        </Field>
        {customer && (
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <Checkbox {...form.register('isActive')} /> Activo
          </label>
        )}
      </form>
    </Dialog>
  )
}
