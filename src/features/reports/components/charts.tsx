import type { ReactNode } from 'react'
import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  LabelList,
  Line,
  Pie,
  PieChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { formatMoney, formatQuantity } from '@/lib/format'
import { CATEGORICAL, labelDate, SERIES } from './chart-utils'
import type { ForecastPoint } from '../api'

const GRID = '#e2e8f0'
const AXIS = { fontSize: 12, fill: '#64748b' }

const compactMoney = (v: number) => (v >= 1000 ? `S/ ${(v / 1000).toFixed(1)}k` : `S/ ${Math.round(v)}`)

function TooltipBox({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-lg bg-white px-3 py-2 text-xs shadow-lg ring-1 ring-slate-200">
      <p className="mb-1 font-medium text-slate-900">{title}</p>
      {children}
    </div>
  )
}

function TooltipRow({ color, label, value }: { color?: string; label: string; value: string }) {
  return (
    <p className="flex items-center gap-2 text-slate-600">
      {color && <span className="size-2 rounded-full" style={{ background: color }} />}
      <span>{label}</span>
      <span className="tabular ml-auto pl-4 font-medium text-slate-900">{value}</span>
    </p>
  )
}

export type SalesChartType = 'bar' | 'line' | 'area'

interface SalesPoint {
  label: string
  total: number
  count: number
}

/** Ventas por período: una sola serie, así que no lleva leyenda (el título la nombra). */
export function SalesChart({ data, type = 'bar', height = 260 }: { data: SalesPoint[]; type?: SalesChartType; height?: number }) {
  const tooltip = (
    <Tooltip
      cursor={type === 'bar' ? { fill: '#f1f5f9' } : { stroke: '#94a3b8', strokeDasharray: '3 3' }}
      content={({ active, payload, label }) =>
        active && payload?.length ? (
          <TooltipBox title={String(label)}>
            <TooltipRow color={SERIES.primary} label="Ventas" value={formatMoney(payload[0].payload.total)} />
            <TooltipRow label="Comprobantes" value={String(payload[0].payload.count)} />
          </TooltipBox>
        ) : null
      }
    />
  )
  // Con pocos puntos se marca cada uno; con muchos, los puntos ensucian la línea.
  const dot = data.length <= 14 ? { r: 3, strokeWidth: 0, fill: SERIES.primary } : false

  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barCategoryGap={2}>
        <CartesianGrid vertical={false} stroke={GRID} />
        <XAxis dataKey="label" tick={AXIS} tickLine={false} axisLine={{ stroke: GRID }} interval="preserveStartEnd" minTickGap={16} />
        <YAxis tick={AXIS} tickLine={false} axisLine={false} tickFormatter={compactMoney} width={64} />
        {tooltip}
        {type === 'bar' && <Bar dataKey="total" fill={SERIES.primary} radius={[4, 4, 0, 0]} maxBarSize={36} isAnimationActive={false} />}
        {type === 'line' && (
          <Line dataKey="total" stroke={SERIES.primary} strokeWidth={2} dot={dot} activeDot={{ r: 5 }} isAnimationActive={false} />
        )}
        {type === 'area' && (
          <Area dataKey="total" stroke={SERIES.primary} strokeWidth={2} fill={SERIES.primary} fillOpacity={0.15} dot={dot} activeDot={{ r: 5 }} isAnimationActive={false} />
        )}
      </ComposedChart>
    </ResponsiveContainer>
  )
}

export function SalesBarChart(props: { data: SalesPoint[]; height?: number }) {
  return <SalesChart {...props} type="bar" />
}

/**
 * Participación de cada producto en el monto vendido. La leyenda va al lado como lista
 * (nombre, % y monto): con etiquetas sobre las tajadas, las pequeñas no se leerían.
 */
export function TopProductsPie({ data }: { data: { productName: string; total: number; quantity: number }[] }) {
  const sum = data.reduce((acc, x) => acc + x.total, 0)
  const slices = data.map((x, i) => ({ ...x, color: CATEGORICAL[i % CATEGORICAL.length], pct: sum > 0 ? (x.total / sum) * 100 : 0 }))

  return (
    <div className="grid items-center gap-4 sm:grid-cols-[220px_1fr]">
      <ResponsiveContainer width="100%" height={220}>
        <PieChart>
          <Tooltip
            content={({ active, payload }) =>
              active && payload?.length ? (
                <TooltipBox title={payload[0].payload.productName}>
                  <TooltipRow color={payload[0].payload.color} label="Vendido" value={formatMoney(payload[0].payload.total)} />
                  <TooltipRow label="Participación" value={`${payload[0].payload.pct.toFixed(1)} %`} />
                </TooltipBox>
              ) : null
            }
          />
          <Pie data={slices} dataKey="total" nameKey="productName" innerRadius={55} outerRadius={95} paddingAngle={1} stroke="#fff" strokeWidth={2} isAnimationActive={false}>
            {slices.map((s) => (
              <Cell key={s.productName} fill={s.color} />
            ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      <ul className="space-y-2 text-sm">
        {slices.map((s) => (
          <li key={s.productName} className="flex items-center gap-2">
            <span className="size-2.5 shrink-0 rounded-full" style={{ background: s.color }} aria-hidden />
            <span className="min-w-0 flex-1 truncate text-slate-700">{s.productName}</span>
            <span className="tabular text-slate-500">{s.pct.toFixed(1)} %</span>
            <span className="tabular w-24 text-right font-medium text-slate-900">{formatMoney(s.total)}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

/** Ranking horizontal con el monto escrito al final de cada barra. */
export function TopProductsChart({ data }: { data: { productName: string; total: number; quantity: number }[] }) {
  const height = Math.max(160, data.length * 44)
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout="vertical" margin={{ top: 0, right: 80, left: 0, bottom: 0 }} barCategoryGap={8}>
        <XAxis type="number" hide />
        <YAxis type="category" dataKey="productName" tick={AXIS} tickLine={false} axisLine={false} width={150} />
        <Tooltip
          cursor={{ fill: '#f1f5f9' }}
          content={({ active, payload }) =>
            active && payload?.length ? (
              <TooltipBox title={payload[0].payload.productName}>
                <TooltipRow color={SERIES.primary} label="Vendido" value={formatMoney(payload[0].payload.total)} />
                <TooltipRow label="Unidades" value={formatQuantity(payload[0].payload.quantity)} />
              </TooltipBox>
            ) : null
          }
        />
        <Bar dataKey="total" fill={SERIES.primary} radius={[0, 4, 4, 0]} maxBarSize={24} isAnimationActive={false}>
          <LabelList dataKey="total" position="right" formatter={(v) => formatMoney(Number(v))} style={{ fontSize: 12, fill: '#334155' }} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

/**
 * Demanda semanal: vendido (línea continua) vs. predicho (línea discontinua + banda del
 * intervalo). Dos series → leyenda propia arriba; además se diferencian por trazo, no solo color.
 */
export function ForecastChart({ points, currentStock, unit }: { points: ForecastPoint[]; currentStock: number; unit: string }) {
  // La predicción arranca desde la última semana real para que las líneas se unan.
  const lastActual = [...points].reverse().find((p) => p.actualQuantity !== null)
  const data = points.map((p) => ({
    label: labelDate(p.periodStart),
    actual: p.actualQuantity,
    predicted: p.predictedQuantity ?? (p === lastActual ? p.actualQuantity : null),
    band: p.lowerBound !== null && p.upperBound !== null ? [p.lowerBound, p.upperBound] : null,
    point: p,
  }))

  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-4 text-xs text-slate-600" aria-hidden>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-0.5 w-5 rounded" style={{ background: SERIES.primary }} /> Vendido
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-0 w-5 border-t-2 border-dashed" style={{ borderColor: SERIES.secondary }} /> Predicción
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-5 rounded-sm" style={{ background: SERIES.secondary, opacity: 0.18 }} /> Intervalo 80 %
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-0 w-5 border-t border-dashed border-slate-500" /> Stock actual
        </span>
      </div>
      <ResponsiveContainer width="100%" height={300}>
        <ComposedChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke={GRID} />
          <XAxis dataKey="label" tick={AXIS} tickLine={false} axisLine={{ stroke: GRID }} minTickGap={12} />
          {/* El eje siempre incluye el stock actual, para que su línea de referencia se vea. */}
          <YAxis
            tick={AXIS}
            tickLine={false}
            axisLine={false}
            width={48}
            allowDecimals={false}
            domain={[0, (dataMax: number) => Math.ceil(Math.max(dataMax, currentStock) * 1.1)]}
          />
          <Tooltip
            cursor={{ stroke: '#94a3b8', strokeDasharray: '3 3' }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null
              const p = payload[0].payload.point as ForecastPoint
              return (
                <TooltipBox title={`Semana del ${labelDate(p.periodStart)}`}>
                  {p.actualQuantity !== null && <TooltipRow color={SERIES.primary} label="Vendido" value={`${formatQuantity(p.actualQuantity)} ${unit}`} />}
                  {p.predictedQuantity !== null && (
                    <>
                      <TooltipRow color={SERIES.secondary} label="Predicción" value={`${formatQuantity(p.predictedQuantity)} ${unit}`} />
                      <TooltipRow label="Intervalo" value={`${formatQuantity(p.lowerBound)} – ${formatQuantity(p.upperBound)}`} />
                    </>
                  )}
                </TooltipBox>
              )
            }}
          />
          <Area dataKey="band" stroke="none" fill={SERIES.secondary} fillOpacity={0.18} isAnimationActive={false} connectNulls={false} />
          <ReferenceLine y={currentStock} stroke="#64748b" strokeDasharray="4 4" label={{ value: `Stock: ${formatQuantity(currentStock)}`, position: 'insideTopRight', fontSize: 11, fill: '#475569' }} />
          <Line isAnimationActive={false} dataKey="actual" stroke={SERIES.primary} strokeWidth={2} dot={{ r: 3, strokeWidth: 0, fill: SERIES.primary }} activeDot={{ r: 5 }} connectNulls={false} />
          <Line isAnimationActive={false} dataKey="predicted" stroke={SERIES.secondary} strokeWidth={2} strokeDasharray="6 4" dot={{ r: 3, strokeWidth: 0, fill: SERIES.secondary }} activeDot={{ r: 5 }} connectNulls={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}
