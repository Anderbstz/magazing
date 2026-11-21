import { zodResolver } from '@hookform/resolvers/zod'
import { Pencil, Plus } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { PageHeader } from '@/components/page-header'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Dialog } from '@/components/ui/dialog'
import { Field } from '@/components/ui/field'
import { Checkbox, Input } from '@/components/ui/input'
import { LoadingBlock } from '@/components/ui/spinner'
import { EmptyState, ErrorState } from '@/components/ui/states'
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table'
import { P } from '@/config/permissions'
import { Can } from '@/features/auth/guards'
import type { Unit } from '../api'
import { useSaveUnit, useUnits } from '../queries'

export function UnitsPage() {
  const units = useUnits()
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Unit | null>(null)

  function openForm(unit: Unit | null) {
    setEditing(unit)
    setFormOpen(true)
  }

  return (
    <>
      <PageHeader
        title="Unidades de medida"
        description="Usan los códigos de SUNAT (NIU, KGM, LTR…)."
        actions={
          <Can permission={P.CatalogManage}>
            <Button onClick={() => openForm(null)}>
              <Plus className="size-4" /> Nueva unidad
            </Button>
          </Can>
        }
      />

      <Card>
        {units.isPending ? (
          <LoadingBlock />
        ) : units.isError ? (
          <ErrorState error={units.error} onRetry={() => units.refetch()} />
        ) : units.data.length === 0 ? (
          <EmptyState title="Aún no hay unidades" />
        ) : (
          <Table>
            <THead>
              <tr>
                <TH>Código</TH>
                <TH>Nombre</TH>
                <TH>Decimales</TH>
                <TH className="w-px" />
              </tr>
            </THead>
            <TBody>
              {units.data.map((u) => (
                <TR key={u.unitId}>
                  <TD className="font-mono text-xs font-semibold text-slate-900">{u.code}</TD>
                  <TD>{u.name}</TD>
                  <TD>
                    <Badge tone={u.allowsDecimals ? 'info' : 'neutral'}>{u.allowsDecimals ? 'Permite' : 'Solo enteros'}</Badge>
                  </TD>
                  <TD>
                    <Can permission={P.CatalogManage}>
                      <Button variant="ghost" size="icon" aria-label={`Editar ${u.name}`} title="Editar" onClick={() => openForm(u)}>
                        <Pencil className="size-4" />
                      </Button>
                    </Can>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </Card>

      <UnitFormDialog open={formOpen} unit={editing} onClose={() => setFormOpen(false)} />
    </>
  )
}

const schema = z.object({
  code: z
    .string()
    .trim()
    .min(1, 'Requerido')
    .max(10, 'Máximo 10 caracteres')
    .transform((v) => v.toUpperCase()),
  name: z.string().trim().min(1, 'Requerido').max(50, 'Máximo 50 caracteres'),
  allowsDecimals: z.boolean(),
})
type FormInput = z.input<typeof schema>
type FormOutput = z.output<typeof schema>

function UnitFormDialog({ open, unit, onClose }: { open: boolean; unit: Unit | null; onClose: () => void }) {
  const save = useSaveUnit()
  const form = useForm<FormInput, unknown, FormOutput>({ resolver: zodResolver(schema) })
  const { errors } = form.formState

  useEffect(() => {
    if (open) form.reset({ code: unit?.code ?? '', name: unit?.name ?? '', allowsDecimals: unit?.allowsDecimals ?? false })
  }, [open, unit, form])

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={unit ? 'Editar unidad' : 'Nueva unidad'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={save.isPending}>
            Cancelar
          </Button>
          <Button type="submit" form="unit-form" loading={save.isPending}>
            Guardar
          </Button>
        </>
      }
    >
      <form
        id="unit-form"
        noValidate
        className="space-y-4"
        onSubmit={form.handleSubmit((body) => save.mutate({ id: unit?.unitId, body }, { onSuccess: onClose }))}
      >
        <Field
          label="Código"
          htmlFor="unit-code"
          required
          error={errors.code?.message}
          hint={unit ? 'El código no se puede cambiar.' : 'Código SUNAT, por ejemplo NIU o KGM.'}
        >
          <Input id="unit-code" readOnly={!!unit} className="uppercase read-only:bg-slate-50 read-only:text-slate-500" aria-invalid={!!errors.code} {...form.register('code')} />
        </Field>
        <Field label="Nombre" htmlFor="unit-name" required error={errors.name?.message}>
          <Input id="unit-name" aria-invalid={!!errors.name} {...form.register('name')} />
        </Field>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <Checkbox {...form.register('allowsDecimals')} /> Permite cantidades con decimales (por ejemplo, kilos)
        </label>
      </form>
    </Dialog>
  )
}
