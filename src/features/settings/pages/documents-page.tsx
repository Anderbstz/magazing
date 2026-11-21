import { Plus } from 'lucide-react'
import { useState } from 'react'
import { PageHeader } from '@/components/page-header'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardHeader } from '@/components/ui/card'
import { Dialog } from '@/components/ui/dialog'
import { Field } from '@/components/ui/field'
import { Checkbox, Input, Select } from '@/components/ui/input'
import { LoadingBlock } from '@/components/ui/spinner'
import { ErrorState } from '@/components/ui/states'
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table'
import type { PaymentMethodAdmin } from '../api'
import { useBranches, useCreateSeries, useDocumentSeries, usePaymentMethodsAdmin, useToggleSeries, useUpdatePaymentMethod } from '../queries'

export function DocumentsPage() {
  const series = useDocumentSeries()
  const methods = usePaymentMethodsAdmin()
  const toggle = useToggleSeries()
  const [creating, setCreating] = useState(false)

  return (
    <>
      <PageHeader title="Comprobantes y pagos" description="Series de boletas y facturas con su correlativo, y los medios de pago del punto de venta." />

      <div className="space-y-6">
        <Card>
          <CardHeader
            title="Series de comprobantes"
            description="El correlativo sube solo con cada venta y no se puede editar."
            actions={
              <Button size="sm" onClick={() => setCreating(true)}>
                <Plus className="size-4" /> Nueva serie
              </Button>
            }
          />
          {series.isPending ? (
            <LoadingBlock />
          ) : series.isError ? (
            <ErrorState error={series.error} onRetry={() => series.refetch()} />
          ) : (
            <Table>
              <THead>
                <tr>
                  <TH>Serie</TH>
                  <TH>Tipo</TH>
                  <TH className="hidden sm:table-cell">Sucursal</TH>
                  <TH className="text-right">Último número</TH>
                  <TH className="hidden md:table-cell">Próximo</TH>
                  <TH>Activa</TH>
                </tr>
              </THead>
              <TBody>
                {series.data.map((s) => (
                  <TR key={s.documentSeriesId}>
                    <TD className="font-mono font-semibold text-slate-900">{s.series}</TD>
                    <TD>
                      <Badge tone={s.documentType === 'FACTURA' ? 'info' : 'neutral'}>{s.documentType === 'FACTURA' ? 'Factura' : 'Boleta'}</Badge>
                    </TD>
                    <TD className="hidden sm:table-cell">{s.branchName}</TD>
                    <TD className="tabular text-right">{s.currentNumber}</TD>
                    <TD className="hidden font-mono text-xs text-slate-500 md:table-cell">
                      {s.series}-{String(s.currentNumber + 1).padStart(8, '0')}
                    </TD>
                    <TD>
                      <Checkbox
                        checked={s.isActive}
                        disabled={toggle.isPending}
                        onChange={(e) => toggle.mutate({ id: s.documentSeriesId, isActive: e.target.checked })}
                        aria-label={`Serie ${s.series} activa`}
                      />
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
        </Card>

        <Card>
          <CardHeader title="Métodos de pago" description="Los inactivos no aparecen en el punto de venta. El efectivo siempre está activo." />
          {methods.isPending ? (
            <LoadingBlock />
          ) : methods.isError ? (
            <ErrorState error={methods.error} onRetry={() => methods.refetch()} />
          ) : (
            <ul className="divide-y divide-slate-100">
              {methods.data.map((m) => (
                <PaymentMethodRow key={`${m.paymentMethodId}-${m.name}-${m.isActive}`} method={m} />
              ))}
            </ul>
          )}
        </Card>
      </div>

      {creating && <SeriesDialog onClose={() => setCreating(false)} />}
    </>
  )
}

/** Edición en línea: nombre + activo. `key` en el padre la reinicia cuando cambia en el servidor. */
function PaymentMethodRow({ method }: { method: PaymentMethodAdmin }) {
  const update = useUpdatePaymentMethod()
  const [name, setName] = useState(method.name)
  const dirty = name.trim() !== method.name
  return (
    <li className="flex flex-wrap items-center gap-3 px-5 py-3">
      <code className="w-20 text-xs font-semibold text-slate-500">{method.code}</code>
      <Input value={name} onChange={(e) => setName(e.target.value)} className="h-9 max-w-xs flex-1" aria-label={`Nombre de ${method.code}`} />
      {dirty && (
        <Button size="sm" loading={update.isPending} onClick={() => update.mutate({ id: method.paymentMethodId, name: name.trim(), isActive: method.isActive })}>
          Guardar
        </Button>
      )}
      <label className="ml-auto flex items-center gap-2 text-sm text-slate-700">
        <Checkbox
          checked={method.isActive}
          disabled={method.code === 'CASH' || update.isPending}
          onChange={(e) => update.mutate({ id: method.paymentMethodId, name: method.name, isActive: e.target.checked })}
        />
        Activo
      </label>
    </li>
  )
}

function SeriesDialog({ onClose }: { onClose: () => void }) {
  const branches = useBranches()
  const create = useCreateSeries()
  const [documentType, setDocumentType] = useState<'BOLETA' | 'FACTURA'>('BOLETA')
  const [branchChoice, setBranchId] = useState('')
  const branchId = branchChoice || branches.data?.[0]?.branchId || ''
  const [suffix, setSuffix] = useState('002')
  const prefix = documentType === 'FACTURA' ? 'F' : 'B'
  const series = prefix + suffix.toUpperCase()
  const valid = /^[0-9A-Z]{3}$/.test(suffix.toUpperCase())

  return (
    <Dialog
      open
      onClose={onClose}
      title="Nueva serie"
      description="La serie arranca en 0; la primera venta será el número 1."
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={create.isPending}>
            Cancelar
          </Button>
          <Button disabled={!valid || !branchId} loading={create.isPending} onClick={() => create.mutate({ branchId, documentType, series }, { onSuccess: onClose })}>
            Crear {series}
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Tipo" htmlFor="ser-type" required>
          <Select id="ser-type" value={documentType} onChange={(e) => setDocumentType(e.target.value as 'BOLETA' | 'FACTURA')}>
            <option value="BOLETA">Boleta</option>
            <option value="FACTURA">Factura</option>
          </Select>
        </Field>
        <Field label="Sucursal" htmlFor="ser-branch" required>
          <Select id="ser-branch" value={branchId} onChange={(e) => setBranchId(e.target.value)}>
            {branches.data?.map((b) => (
              <option key={b.branchId} value={b.branchId}>
                {b.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Serie" htmlFor="ser-suffix" required error={valid ? undefined : '3 letras o números'} hint="Formato SUNAT: letra del tipo + 3 caracteres." className="sm:col-span-2">
          <div className="flex items-center">
            <span className="flex h-10 items-center rounded-l-lg bg-slate-100 px-3 font-mono text-sm font-semibold text-slate-600 ring-1 ring-slate-300 ring-inset">{prefix}</span>
            <Input id="ser-suffix" maxLength={3} value={suffix} onChange={(e) => setSuffix(e.target.value)} className="rounded-l-none font-mono uppercase" />
          </div>
        </Field>
      </div>
    </Dialog>
  )
}
