import { AlertTriangle, BrainCircuit, CheckCheck, Eye, PackageSearch, X } from 'lucide-react'
import { useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { PageHeader } from '@/components/page-header'
import { ProductPicker } from '@/components/product-picker'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardHeader } from '@/components/ui/card'
import { LoadingBlock } from '@/components/ui/spinner'
import { EmptyState, ErrorState } from '@/components/ui/states'
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table'
import { P } from '@/config/permissions'
import { Can } from '@/features/auth/guards'
import { useCan } from '@/features/auth/use-auth'
import { formatDateTime, formatQuantity } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { AlertStatus, StockAlert } from '../api'
import { labelDate } from '../components/chart-utils'
import { ForecastChart } from '../components/charts'
import { useAlertAction, useAlerts, useForecast, useRunPredictions } from '../queries'

const ALERT_TYPE = {
  LOW_STOCK: { label: 'Bajo mínimo', detail: 'mínimo' },
  PREDICTED_SHORTAGE: { label: 'Faltante previsto', detail: 'demanda de la semana' },
} as const

const STATUS_TABS: { value: AlertStatus; label: string }[] = [
  { value: 'OPEN', label: 'Abiertas' },
  { value: 'ACKNOWLEDGED', label: 'Vistas' },
  { value: 'RESOLVED', label: 'Resueltas' },
]

export function ForecastPage() {
  const [params, setParams] = useSearchParams()
  const productId = params.get('productId')
  const run = useRunPredictions()

  const selectProduct = (id: string | null) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        if (id) next.set('productId', id)
        else next.delete('productId')
        return next
      },
      { replace: true },
    )

  return (
    <>
      <PageHeader
        title="Predicción de demanda"
        description="Demanda semanal estimada por producto. Si el stock no alcanza, se abre una alerta."
        actions={
          <Can permission={P.PredictionsRun}>
            <Button onClick={() => run.mutate()} loading={run.isPending}>
              <BrainCircuit className="size-4" /> Ejecutar predicción
            </Button>
          </Can>
        }
      />

      <div className="space-y-6">
        <AlertsCard onSelectProduct={selectProduct} />
        <ProductForecastCard productId={productId} onSelect={selectProduct} />
      </div>
    </>
  )
}

function AlertsCard({ onSelectProduct }: { onSelectProduct: (id: string) => void }) {
  const [status, setStatus] = useState<AlertStatus>('OPEN')
  const alerts = useAlerts(status)

  return (
    <Card>
      <CardHeader
        title="Alertas de stock"
        description="Generadas por la predicción semanal y por el stock mínimo."
        actions={
          <div className="flex rounded-lg bg-slate-100 p-1" role="tablist">
            {STATUS_TABS.map((t) => (
              <button
                key={t.value}
                type="button"
                role="tab"
                aria-selected={status === t.value}
                onClick={() => setStatus(t.value)}
                className={cn('rounded-md px-3 py-1 text-sm font-medium', status === t.value ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600')}
              >
                {t.label}
              </button>
            ))}
          </div>
        }
      />
      {alerts.isPending ? (
        <LoadingBlock />
      ) : alerts.isError ? (
        <ErrorState error={alerts.error} onRetry={() => alerts.refetch()} />
      ) : alerts.data.length === 0 ? (
        <EmptyState title={status === 'OPEN' ? 'Sin alertas abiertas' : 'Nada por aquí'} description={status === 'OPEN' ? 'El stock alcanza para la demanda prevista.' : undefined} />
      ) : (
        <Table>
          <THead>
            <tr>
              <TH>Producto</TH>
              <TH>Tipo</TH>
              <TH className="text-right">Stock</TH>
              <TH className="hidden text-right sm:table-cell">Umbral</TH>
              <TH className="text-right">Sugerido pedir</TH>
              <TH className="hidden lg:table-cell">Fecha</TH>
              <TH className="w-px" />
            </tr>
          </THead>
          <TBody>
            {alerts.data.map((a) => (
              <AlertRow key={a.stockAlertId} alert={a} onSelectProduct={onSelectProduct} />
            ))}
          </TBody>
        </Table>
      )}
    </Card>
  )
}

function AlertRow({ alert: a, onSelectProduct }: { alert: StockAlert; onSelectProduct: (id: string) => void }) {
  const action = useAlertAction()
  const can = useCan()
  const manage = can(P.AlertsManage) && a.status !== 'RESOLVED'
  return (
    <TR>
      <TD>
        <button type="button" className="text-left font-medium text-slate-900 hover:text-brand-700 hover:underline" onClick={() => onSelectProduct(a.productId)}>
          {a.productName}
        </button>
        <div className="text-xs text-slate-500">
          {a.sku} · {a.warehouseName}
        </div>
      </TD>
      <TD>
        <Badge tone={a.alertType === 'PREDICTED_SHORTAGE' ? 'warning' : 'danger'}>
          <AlertTriangle className="mr-1 size-3" aria-hidden />
          {ALERT_TYPE[a.alertType].label}
        </Badge>
      </TD>
      <TD className="tabular text-right font-semibold">{formatQuantity(a.currentStock)}</TD>
      <TD className="tabular hidden text-right text-slate-600 sm:table-cell" title={ALERT_TYPE[a.alertType].detail}>
        {formatQuantity(a.threshold)}
        <div className="text-[11px] text-slate-400">{ALERT_TYPE[a.alertType].detail}</div>
      </TD>
      <TD className="tabular text-right">
        {a.suggestedOrderQty ? `${formatQuantity(a.suggestedOrderQty)} ${a.unitCode}` : '—'}
      </TD>
      <TD className="hidden text-xs lg:table-cell">
        {formatDateTime(a.createdAt)}
        {a.resolvedByName && <div className="text-slate-500">Resuelta por {a.resolvedByName}</div>}
      </TD>
      <TD>
        <div className="flex justify-end gap-1">
          {a.status === 'OPEN' && manage && (
            <Button variant="ghost" size="icon" title="Marcar como vista" aria-label="Marcar como vista" onClick={() => action.mutate({ id: a.stockAlertId, action: 'acknowledge' })}>
              <Eye className="size-4" />
            </Button>
          )}
          {manage && (
            <Button variant="ghost" size="icon" title="Resolver" aria-label="Resolver" onClick={() => action.mutate({ id: a.stockAlertId, action: 'resolve' })}>
              <CheckCheck className="size-4 text-emerald-700" />
            </Button>
          )}
          {a.status !== 'RESOLVED' && can(P.PurchasesCreate) && (
            <Link to="/purchases/orders/new" className="inline-flex h-9 items-center rounded-lg px-2 text-xs font-medium whitespace-nowrap text-brand-700 hover:bg-brand-50">
              Pedir
            </Link>
          )}
        </div>
      </TD>
    </TR>
  )
}

function ProductForecastCard({ productId, onSelect }: { productId: string | null; onSelect: (id: string | null) => void }) {
  const forecast = useForecast(productId)
  const f = forecast.data
  const next = f?.points.find((p) => p.predictedQuantity !== null)
  const shortage = f && next?.predictedQuantity != null && f.currentStock < next.predictedQuantity

  return (
    <Card>
      <CardHeader
        title={f ? f.productName : 'Predicción por producto'}
        description={f ? `Modelo ${f.modelVersion} · 12 semanas de historia + 4 de predicción` : 'Elige un producto para ver su demanda semanal.'}
        actions={
          productId && (
            <Button variant="ghost" size="sm" onClick={() => onSelect(null)}>
              <X className="size-4" /> Cambiar producto
            </Button>
          )
        }
      />
      {!productId ? (
        <div className="p-4">
          <ProductPicker show="price" onSelect={(p) => onSelect(p.productId)} />
          <div className="flex flex-col items-center gap-2 py-12 text-center text-sm text-slate-500">
            <PackageSearch className="size-8 text-slate-300" aria-hidden />
            También puedes hacer clic en un producto de las alertas.
          </div>
        </div>
      ) : forecast.isPending ? (
        <LoadingBlock />
      ) : forecast.isError ? (
        <ErrorState error={forecast.error} onRetry={() => forecast.refetch()} />
      ) : (
        <div className="space-y-4 p-4">
          {next && (
            <p className={cn('rounded-lg px-3 py-2 text-sm ring-1', shortage ? 'bg-amber-50 text-amber-900 ring-amber-200' : 'bg-emerald-50 text-emerald-900 ring-emerald-200')}>
              Esta semana se esperan <strong>{formatQuantity(next.predictedQuantity)} {f!.unitCode}</strong> (entre {formatQuantity(next.lowerBound)} y {formatQuantity(next.upperBound)}). Hay{' '}
              <strong>{formatQuantity(f!.currentStock)}</strong> en stock: {shortage ? 'no alcanza, conviene reponer.' : 'alcanza.'}
            </p>
          )}
          <ForecastChart points={f!.points} currentStock={f!.currentStock} unit={f!.unitCode} />
          <details className="rounded-lg ring-1 ring-slate-200">
            <summary className="cursor-pointer px-4 py-2.5 text-sm font-medium text-slate-700">Ver datos en tabla</summary>
            <Table>
              <THead>
                <tr>
                  <TH>Semana</TH>
                  <TH className="text-right">Vendido</TH>
                  <TH className="text-right">Predicción</TH>
                  <TH className="text-right">Intervalo</TH>
                </tr>
              </THead>
              <TBody>
                {f!.points.map((p) => (
                  <TR key={p.periodStart}>
                    <TD>
                      {labelDate(p.periodStart)} – {labelDate(p.periodEnd)}
                    </TD>
                    <TD className="tabular text-right">{p.actualQuantity === null ? '—' : formatQuantity(p.actualQuantity)}</TD>
                    <TD className="tabular text-right">{p.predictedQuantity === null ? '—' : formatQuantity(p.predictedQuantity)}</TD>
                    <TD className="tabular text-right text-slate-500">
                      {p.lowerBound === null ? '—' : `${formatQuantity(p.lowerBound)} – ${formatQuantity(p.upperBound)}`}
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </details>
        </div>
      )}
    </Card>
  )
}
