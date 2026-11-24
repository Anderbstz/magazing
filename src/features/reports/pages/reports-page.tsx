import { Download, Receipt, TrendingUp, Wallet } from 'lucide-react'
import { useState } from 'react'
import { PageHeader } from '@/components/page-header'
import { StatCard } from '@/components/stat-card'
import { Button } from '@/components/ui/button'
import { Card, CardHeader } from '@/components/ui/card'
import { Input, Select } from '@/components/ui/input'
import { Pagination } from '@/components/ui/pagination'
import { LoadingBlock } from '@/components/ui/spinner'
import { EmptyState, ErrorState } from '@/components/ui/states'
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table'
import { formatMoney, formatQuantity } from '@/lib/format'
import { daysAgo, isoDate } from '@/lib/dates'
import { cn } from '@/lib/utils'
import type { GroupBy } from '../api'
import { labelDate } from '../components/chart-utils'
import { SalesBarChart, TopProductsChart } from '../components/charts'
import { ExportDialog } from '../components/export-dialog'
import { useSalesReport, useTopProducts } from '../queries'

const iso = isoDate

const PRESETS = [
  { label: '7 días', from: () => daysAgo(6), groupBy: 'day' as GroupBy },
  { label: '30 días', from: () => daysAgo(29), groupBy: 'day' as GroupBy },
  { label: '90 días', from: () => daysAgo(89), groupBy: 'week' as GroupBy },
  { label: 'Este mes', from: () => iso(new Date()).slice(0, 8) + '01', groupBy: 'day' as GroupBy },
]

/** Filas por página de la tabla: un mes agrupado por día entra completo. */
const PAGE_SIZE = 31

const GROUP_LABEL: Record<GroupBy, string> = { day: 'Día', week: 'Semana (desde)', month: 'Mes' }

export function ReportsPage() {
  // "Hoy" se fija al montar la página: los presets comparan contra este valor.
  const [today] = useState(() => iso(new Date()))
  const [from, setFrom] = useState(() => daysAgo(29))
  const [to, setTo] = useState(today)
  const [groupBy, setGroupBy] = useState<GroupBy>('day')
  const report = useSalesReport({ from, to, groupBy })
  const top = useTopProducts({ from, to, limit: 10 })

  const [exporting, setExporting] = useState(false)

  // La página vuelve a 1 cuando cambian los filtros: se guarda junto con la consulta que la originó.
  const queryKey = `${from}|${to}|${groupBy}`
  const [pageState, setPageState] = useState({ key: queryKey, page: 1 })
  const rows = report.data?.rows ?? []
  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE))
  const page = pageState.key === queryKey ? Math.min(pageState.page, totalPages) : 1
  const pageSlice: [number, number] = [(page - 1) * PAGE_SIZE, Math.min(page * PAGE_SIZE, rows.length)]

  const periodLabel = (p: string) =>
    groupBy === 'month' ? new Intl.DateTimeFormat('es-PE', { month: 'short', year: 'numeric' }).format(new Date(p + 'T12:00:00')) : labelDate(p)
  const shortDate = (p: string) => new Intl.DateTimeFormat('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(p + 'T12:00:00'))

  const t = report.data?.totals
  const margin = t && t.subtotal > 0 ? (t.grossProfit / t.subtotal) * 100 : 0

  return (
    <>
      <PageHeader
        title="Reportes"
        description="Ventas, utilidad y productos más vendidos. Las ventas anuladas no se cuentan."
        actions={
          <Button variant="secondary" onClick={() => setExporting(true)} disabled={!rows.length}>
            <Download className="size-4" /> Exportar
          </Button>
        }
      />

      <Card className="mb-6 flex flex-wrap items-center gap-3 p-4">
        <div className="flex flex-wrap rounded-lg bg-slate-100 p-1">
          {PRESETS.map((p) => {
            const active = from === p.from() && to === today
            return (
              <button
                key={p.label}
                type="button"
                aria-pressed={active}
                onClick={() => {
                  setFrom(p.from())
                  setTo(today)
                  setGroupBy(p.groupBy)
                }}
                className={cn('rounded-md px-3 py-1.5 text-sm font-medium', active ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900')}
              >
                {p.label}
              </button>
            )
          })}
        </div>
        <Input type="date" value={from} max={to} onChange={(e) => e.target.value && setFrom(e.target.value)} className="w-auto" aria-label="Desde" />
        <span className="text-slate-400">—</span>
        <Input type="date" value={to} min={from} onChange={(e) => e.target.value && setTo(e.target.value)} className="w-auto" aria-label="Hasta" />
        <Select value={groupBy} onChange={(e) => setGroupBy(e.target.value as GroupBy)} className="w-auto" aria-label="Agrupar por">
          <option value="day">Por día</option>
          <option value="week">Por semana</option>
          <option value="month">Por mes</option>
        </Select>
      </Card>

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard label="Ventas (con IGV)" icon={Receipt} loading={report.isPending} value={formatMoney(t?.total)} detail={t && `${t.count} comprobantes`} />
        <StatCard label="Utilidad bruta" icon={TrendingUp} tone="sky" loading={report.isPending} value={formatMoney(t?.grossProfit)} detail={t && `Margen ${margin.toFixed(1)} %`} />
        <StatCard label="IGV generado" icon={Wallet} tone="slate" loading={report.isPending} value={formatMoney(t?.taxAmount)} />
      </div>

      <div className="space-y-6">
        <Card>
          <CardHeader title="Ventas por período" description="Total con IGV" />
          {report.isPending ? (
            <LoadingBlock />
          ) : report.isError ? (
            <ErrorState error={report.error} onRetry={() => report.refetch()} />
          ) : report.data.rows.length === 0 ? (
            <EmptyState title="Sin ventas en el rango" />
          ) : (
            <>
              <div className={cn('p-4', report.isPlaceholderData && 'opacity-60')}>
                <SalesBarChart data={report.data.rows.map((r) => ({ label: periodLabel(r.period), total: r.total, count: r.count }))} />
              </div>
              <Table>
                <THead>
                  <tr>
                    <TH>{GROUP_LABEL[groupBy]}</TH>
                    <TH className="text-right">Comprob.</TH>
                    <TH className="hidden text-right md:table-cell">Sin IGV</TH>
                    <TH className="hidden text-right md:table-cell">IGV</TH>
                    <TH className="text-right">Total</TH>
                    <TH className="hidden text-right lg:table-cell">Costo</TH>
                    <TH className="text-right">Utilidad</TH>
                  </tr>
                </THead>
                <TBody>
                  {rows.slice(...pageSlice).map((r) => (
                    <TR key={r.period}>
                      <TD>{periodLabel(r.period)}</TD>
                      <TD className="tabular text-right">{r.count}</TD>
                      <TD className="tabular hidden text-right md:table-cell">{formatMoney(r.subtotal)}</TD>
                      <TD className="tabular hidden text-right md:table-cell">{formatMoney(r.taxAmount)}</TD>
                      <TD className="tabular text-right font-medium">{formatMoney(r.total)}</TD>
                      <TD className="tabular hidden text-right lg:table-cell">{formatMoney(r.cost)}</TD>
                      <TD className="tabular text-right">{formatMoney(r.grossProfit)}</TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
              {totalPages > 1 && (
                <Pagination page={page} totalPages={totalPages} totalCount={rows.length} onPageChange={(p) => setPageState({ key: queryKey, page: p })} />
              )}
            </>
          )}
        </Card>

        <Card>
          <CardHeader title="Productos más vendidos" description="Top 10 por monto en el rango" />
          {top.isPending ? (
            <LoadingBlock />
          ) : top.isError ? (
            <ErrorState error={top.error} onRetry={() => top.refetch()} />
          ) : top.data.length === 0 ? (
            <EmptyState title="Sin ventas en el rango" />
          ) : (
            <>
              <div className="p-4">
                <TopProductsChart data={top.data} />
              </div>
              <Table>
                <THead>
                  <tr>
                    <TH>Producto</TH>
                    <TH className="text-right">Unidades</TH>
                    <TH className="text-right">Vendido</TH>
                    <TH className="text-right">Utilidad</TH>
                  </tr>
                </THead>
                <TBody>
                  {top.data.map((p) => (
                    <TR key={p.productId}>
                      <TD>
                        <div className="font-medium text-slate-900">{p.productName}</div>
                        <div className="text-xs text-slate-500">{p.sku}</div>
                      </TD>
                      <TD className="tabular text-right">{formatQuantity(p.quantity)}</TD>
                      <TD className="tabular text-right font-medium">{formatMoney(p.total)}</TD>
                      <TD className="tabular text-right">{formatMoney(p.grossProfit)}</TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            </>
          )}
        </Card>
      </div>

      {exporting && (
        <ExportDialog
          open
          onClose={() => setExporting(false)}
          from={from}
          to={to}
          groupBy={groupBy}
          rows={rows}
          pageSlice={pageSlice}
          pageLabel={`${page} de ${totalPages}`}
          formatDate={shortDate}
        />
      )}
    </>
  )
}
