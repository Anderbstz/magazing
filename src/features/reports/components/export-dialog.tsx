import { Download, FileSpreadsheet } from 'lucide-react'
import { useState } from 'react'
import { DownloadButton } from '@/components/download-button'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { toCsv, downloadFile } from '@/lib/csv'
import { isoDate } from '@/lib/dates'
import { cn } from '@/lib/utils'
import type { GroupBy, SalesReportRow } from '../api'

type Format = 'xlsx' | 'csv'
type Scope = 'all' | 'page'

interface ExportDialogProps {
  open: boolean
  onClose: () => void
  from: string
  to: string
  groupBy: GroupBy
  rows: SalesReportRow[]
  /** Índices [inicio, fin) de las filas de la página que se está viendo. */
  pageSlice: [number, number]
  pageLabel: string
  formatDate: (iso: string) => string
}

const dayBefore = (iso: string) => {
  const d = new Date(`${iso}T12:00:00`)
  d.setDate(d.getDate() - 1)
  return isoDate(d)
}

/**
 * Exporta el reporte completo del período o solo la página visible. Cada fila es un período
 * consecutivo, así que la página equivale a un rango de fechas: el Excel se pide a la API con ese rango.
 */
export function ExportDialog({ open, onClose, from, to, groupBy, rows, pageSlice, pageLabel, formatDate }: ExportDialogProps) {
  const [format, setFormat] = useState<Format>('xlsx')
  const [scope, setScope] = useState<Scope>('all')

  const [start, end] = pageSlice
  const pageRows = rows.slice(start, end)
  const pageFrom = start === 0 ? from : pageRows[0]?.period ?? from
  const pageTo = end >= rows.length ? to : dayBefore(rows[end].period)

  const range = scope === 'all' ? { from, to } : { from: pageFrom, to: pageTo }
  const selected = scope === 'all' ? rows : pageRows
  const fileBase = `ventas_${range.from}_${range.to}`

  function downloadCsv() {
    const csv = toCsv(
      ['Periodo', 'Comprobantes', 'Venta sin IGV', 'IGV', 'Total', 'Costo', 'Utilidad bruta'],
      selected.map((r) => [r.period, r.count, r.subtotal, r.taxAmount, r.total, r.cost, r.grossProfit]),
    )
    downloadFile(csv, `${fileBase}.csv`, 'text/csv')
    onClose()
  }

  const options: { value: Scope; title: string; detail: string }[] = [
    { value: 'all', title: 'Todo el período', detail: `${formatDate(from)} al ${formatDate(to)} · ${rows.length} filas` },
    { value: 'page', title: `Solo esta página (${pageLabel})`, detail: `${formatDate(pageFrom)} al ${formatDate(pageTo)} · ${pageRows.length} filas` },
  ]

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Exportar reporte de ventas"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          {format === 'xlsx' ? (
            <DownloadButton variant="primary" path="/reports/sales/export" params={{ ...range, groupBy }} fallbackName={`${fileBase}.xlsx`}>
              <FileSpreadsheet className="size-4" /> Descargar Excel
            </DownloadButton>
          ) : (
            <Button onClick={downloadCsv}>
              <Download className="size-4" /> Descargar CSV
            </Button>
          )}
        </>
      }
    >
      <div className="space-y-5">
        <fieldset>
          <legend className="mb-2 text-sm font-medium text-slate-700">Formato</legend>
          <div className="grid grid-cols-2 rounded-lg bg-slate-100 p-1" role="radiogroup" aria-label="Formato">
            {(['xlsx', 'csv'] as const).map((f) => (
              <button
                key={f}
                type="button"
                role="radio"
                aria-checked={format === f}
                onClick={() => setFormat(f)}
                className={cn('rounded-md py-1.5 text-sm font-medium', format === f ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900')}
              >
                {f === 'xlsx' ? 'Excel (.xlsx)' : 'CSV'}
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset className="space-y-2">
          <legend className="mb-2 text-sm font-medium text-slate-700">Qué exportar</legend>
          {options.map((o) => (
            <label
              key={o.value}
              className={cn(
                'flex cursor-pointer items-start gap-3 rounded-lg p-3 ring-1',
                scope === o.value ? 'bg-brand-50/60 ring-brand-300' : 'ring-slate-200 hover:bg-slate-50',
              )}
            >
              <input type="radio" name="export-scope" className="mt-1 accent-brand-700" checked={scope === o.value} onChange={() => setScope(o.value)} />
              <span>
                <span className="block text-sm font-medium text-slate-900">{o.title}</span>
                <span className="block text-xs text-slate-500">{o.detail}</span>
              </span>
            </label>
          ))}
        </fieldset>
      </div>
    </Dialog>
  )
}
