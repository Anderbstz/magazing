import {
  AlertTriangle,
  AreaChart as AreaChartIcon,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  BarChartHorizontal,
  BellRing,
  ClipboardList,
  LineChart as LineChartIcon,
  PackageX,
  PieChart as PieChartIcon,
  Receipt,
  TrendingUp,
  Truck,
  UserPlus,
  Wallet,
} from 'lucide-react'
import { useMemo, type ReactNode } from 'react'
import { Link } from 'react-router'
import { navigation } from '@/app/navigation'
import { PageHeader } from '@/components/page-header'
import { StatCard } from '@/components/stat-card'
import { Badge } from '@/components/ui/badge'
import { buttonClasses } from '@/components/ui/button-classes'
import { Card, CardHeader } from '@/components/ui/card'
import { Segmented, type SegmentedOption } from '@/components/ui/segmented'
import { ErrorState } from '@/components/ui/states'
import { P } from '@/config/permissions'
import { useUsers } from '@/features/admin/queries'
import { useCan, useSession } from '@/features/auth/use-auth'
import type { GroupBy } from '@/features/reports/api'
import { labelDate } from '@/features/reports/components/chart-utils'
import { SalesChart, TopProductsChart, TopProductsPie, type SalesChartType } from '@/features/reports/components/charts'
import { useDashboard, useSalesReport, useTopProducts } from '@/features/reports/queries'
import { useStoredState } from '@/hooks/use-stored-state'
import { daysAgo, isoDate, monthStart } from '@/lib/dates'
import { formatMoney } from '@/lib/format'
import { cn } from '@/lib/utils'

export function DashboardPage() {
  const { user } = useSession()
  const can = useCan()
  const greeting = `Hola, ${user?.username ?? ''}`

  if (!can(P.ReportsRead)) {
    return (
      <>
        <PageHeader title={greeting} description="Accesos rápidos a tus módulos." />
        <Shortcuts />
      </>
    )
  }
  return (
    <>
      <PageHeader
        title={greeting}
        description="Así va tu negocio."
        actions={
          can(P.UsersManage) && (
            <Link to="/admin/users?new=1" className={buttonClasses()}>
              <UserPlus className="size-4" /> Nuevo usuario
            </Link>
          )
        }
      />
      <Indicators />
    </>
  )
}

type Period = 'today' | '7d' | '30d' | '12m'

const PERIODS: SegmentedOption<Period>[] = [
  { value: 'today', label: 'Hoy' },
  { value: '7d', label: '7 días' },
  { value: '30d', label: '30 días' },
  { value: '12m', label: '12 meses' },
]

const SALES_CHARTS: SegmentedOption<SalesChartType>[] = [
  { value: 'bar', label: 'Barras', icon: BarChart3 },
  { value: 'line', label: 'Línea', icon: LineChartIcon },
  { value: 'area', label: 'Área', icon: AreaChartIcon },
]

type TopChartType = 'bar' | 'pie'

const TOP_CHARTS: SegmentedOption<TopChartType>[] = [
  { value: 'bar', label: 'Barras', icon: BarChartHorizontal },
  { value: 'pie', label: 'Pastel', icon: PieChartIcon },
]

/**
 * Rango del período, el período anterior de igual largo (para comparar) y el rango del
 * gráfico. "Hoy" grafica la última semana: un solo día no dice nada en un gráfico.
 */
function periodRanges(period: Period, now = new Date()) {
  const today = isoDate(now)
  const day = (n: number) => daysAgo(n, now)
  switch (period) {
    case 'today':
      return {
        current: { from: today, to: today },
        previous: { from: day(1), to: day(1) },
        chart: { from: day(6), to: today, groupBy: 'day' as GroupBy },
        compareLabel: 'vs. ayer',
        chartTitle: 'Ventas de los últimos 7 días',
      }
    case '7d':
      return {
        current: { from: day(6), to: today },
        previous: { from: day(13), to: day(7) },
        chart: { from: day(6), to: today, groupBy: 'day' as GroupBy },
        compareLabel: 'vs. los 7 días anteriores',
        chartTitle: 'Ventas de los últimos 7 días',
      }
    case '30d':
      return {
        current: { from: day(29), to: today },
        previous: { from: day(59), to: day(30) },
        chart: { from: day(29), to: today, groupBy: 'day' as GroupBy },
        compareLabel: 'vs. los 30 días anteriores',
        chartTitle: 'Ventas de los últimos 30 días',
      }
    case '12m': {
      const lastYear = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate())
      return {
        current: { from: monthStart(11, now), to: today },
        previous: { from: monthStart(11, lastYear), to: isoDate(lastYear) },
        chart: { from: monthStart(11, now), to: today, groupBy: 'month' as GroupBy },
        compareLabel: 'vs. los 12 meses anteriores',
        chartTitle: 'Ventas de los últimos 12 meses',
      }
    }
  }
}

const monthLabel = new Intl.DateTimeFormat('es-PE', { month: 'short', year: '2-digit' })

function Indicators() {
  const can = useCan()
  const [period, setPeriod] = useStoredState<Period>('magazing.dashboard.period', '30d', ['today', '7d', '30d', '12m'])
  const [salesChart, setSalesChart] = useStoredState<SalesChartType>('magazing.dashboard.salesChart', 'bar', ['bar', 'line', 'area'])
  const [topChart, setTopChart] = useStoredState<TopChartType>('magazing.dashboard.topChart', 'bar', ['bar', 'pie'])

  // Las fechas se calculan al elegir el período, no en cada render.
  const ranges = useMemo(() => periodRanges(period), [period])
  const dashboard = useDashboard()
  const current = useSalesReport({ ...ranges.current, groupBy: 'day' })
  const previous = useSalesReport({ ...ranges.previous, groupBy: 'day' })
  const chart = useSalesReport(ranges.chart)
  const top = useTopProducts({ ...ranges.current, limit: 6 })

  if (dashboard.isError) return <Card><ErrorState error={dashboard.error} onRetry={() => dashboard.refetch()} /></Card>
  if (current.isError) return <Card><ErrorState error={current.error} onRetry={() => current.refetch()} /></Card>

  const d = dashboard.data
  const t = current.data?.totals
  const prevTotal = previous.data?.totals.total
  const vsPrev = t && prevTotal ? ((t.total - prevTotal) / prevTotal) * 100 : null
  const margin = t && t.subtotal > 0 ? (t.grossProfit / t.subtotal) * 100 : 0
  const averageTicket = t && t.count > 0 ? t.total / t.count : 0
  const periodLabel = PERIODS.find((p) => p.value === period)!.label

  const chartData = (chart.data?.rows ?? []).map((r) => ({
    label: ranges.chart.groupBy === 'month' ? monthLabel.format(new Date(r.period + 'T12:00:00')) : labelDate(r.period),
    total: r.total,
    count: r.count,
  }))

  return (
    <div className="space-y-6">
      <Segmented label="Período" options={PERIODS} value={period} onChange={setPeriod} />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label={period === 'today' ? 'Ventas de hoy' : `Ventas · ${periodLabel.toLowerCase()}`}
          icon={TrendingUp}
          tone="sky"
          loading={current.isPending}
          value={formatMoney(t?.total)}
          detail={vsPrev !== null ? <Trend value={vsPrev} suffix={ranges.compareLabel} /> : previous.data && 'Sin ventas en el período anterior'}
        />
        <StatCard
          label="Comprobantes"
          icon={Receipt}
          loading={current.isPending}
          value={t?.count ?? '—'}
          detail={t && `Ticket promedio ${formatMoney(averageTicket)}`}
        />
        <StatCard
          label="Utilidad bruta"
          icon={Wallet}
          tone="brand"
          loading={current.isPending}
          value={formatMoney(t?.grossProfit)}
          detail={t && `Margen ${margin.toFixed(1)} % sobre la venta sin IGV`}
        />
        <StatCard
          label="Valor del inventario"
          icon={Wallet}
          tone="slate"
          loading={dashboard.isPending}
          value={formatMoney(d?.inventoryValue)}
          detail="Al costo promedio, hoy"
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[2fr_1fr]">
        <Card>
          <CardHeader
            title={ranges.chartTitle}
            description={ranges.chart.groupBy === 'month' ? 'Total mensual con IGV' : 'Total diario con IGV'}
            actions={<Segmented size="sm" label="Tipo de gráfico de ventas" options={SALES_CHARTS} value={salesChart} onChange={setSalesChart} />}
          />
          <div className="p-4">
            {chart.isPending ? <div className="h-[260px] animate-pulse rounded-lg bg-slate-50" /> : <SalesChart data={chartData} type={salesChart} />}
          </div>
        </Card>

        <Card>
          <CardHeader title="Pendientes" />
          <ul className="divide-y divide-slate-100">
            <Pending to="/forecast" icon={BellRing} label="Alertas de stock abiertas" value={d?.openAlerts} tone="red" />
            <Pending to="/inventory/stock?status=OUT" icon={PackageX} label="Productos sin stock" value={d?.outOfStockCount} tone="red" />
            <Pending to="/inventory/stock?status=LOW" icon={AlertTriangle} label="Productos bajo mínimo" value={d?.lowStockCount} tone="amber" />
            <Pending to="/purchases/orders?status=APPROVED" icon={ClipboardList} label="Órdenes por recibir" value={d?.pendingPurchaseOrders} tone="sky" />
            <Pending to="/inventory/transfers" icon={Truck} label="Transferencias pendientes" value={d?.pendingTransfers} tone="sky" />
          </ul>
        </Card>
      </div>

      <div className={cn('grid gap-6', can(P.UsersRead) && 'xl:grid-cols-[2fr_1fr]')}>
        <Card>
          <CardHeader
            title="Productos más vendidos"
            description={`${periodLabel}, por monto`}
            actions={
              <div className="flex items-center gap-3">
                <Segmented size="sm" label="Tipo de gráfico de productos" options={TOP_CHARTS} value={topChart} onChange={setTopChart} />
                <Link to="/reports" className="hidden items-center gap-1 text-sm font-medium text-brand-700 hover:underline sm:inline-flex">
                  Ver reportes <ArrowRight className="size-4" />
                </Link>
              </div>
            }
          />
          <div className="p-4">
            {top.isPending ? (
              <div className="h-40 animate-pulse rounded-lg bg-slate-50" />
            ) : !top.data?.length ? (
              <p className="py-8 text-center text-sm text-slate-500">Aún no hay ventas en este período.</p>
            ) : topChart === 'pie' ? (
              <TopProductsPie data={top.data} />
            ) : (
              <TopProductsChart data={top.data} />
            )}
          </div>
        </Card>

        {can(P.UsersRead) && <Team />}
      </div>
    </div>
  )
}

/** Resumen del equipo para el administrador: quién usa el sistema y con qué rol. */
function Team() {
  const can = useCan()
  const users = useUsers({ page: 1, pageSize: 8 })
  const active = users.data?.items.filter((u) => u.isActive) ?? []

  return (
    <Card>
      <CardHeader
        title="Equipo"
        description={users.data && `${active.length} usuarios activos`}
        actions={
          <Link to="/admin/users" className="inline-flex items-center gap-1 text-sm font-medium text-brand-700 hover:underline">
            Ver todos <ArrowRight className="size-4" />
          </Link>
        }
      />
      {users.isPending ? (
        <div className="m-4 h-40 animate-pulse rounded-lg bg-slate-50" />
      ) : (
        <ul className="divide-y divide-slate-100">
          {active.map((u) => (
            <li key={u.userId} className="flex items-center gap-3 px-5 py-2.5 text-sm">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-600 uppercase">
                {(u.fullName || u.username).slice(0, 2)}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium text-slate-800">{u.fullName || u.username}</span>
                <span className="block truncate text-xs text-slate-500">{u.username}</span>
              </span>
              {u.roles.length > 0 ? <Badge>{u.roles[0]}</Badge> : <Badge tone="warning">Sin rol</Badge>}
            </li>
          ))}
        </ul>
      )}
      {can(P.UsersManage) && (
        <div className="border-t border-slate-100 p-4">
          <Link to="/admin/users?new=1" className={cn(buttonClasses({ variant: 'secondary' }), 'w-full')}>
            <UserPlus className="size-4" /> Nuevo usuario
          </Link>
        </div>
      )}
    </Card>
  )
}

function Trend({ value, suffix }: { value: number; suffix: string }) {
  const up = value >= 0
  const Icon = up ? ArrowUpRight : ArrowDownRight
  return (
    <>
      <span className={cn('font-medium whitespace-nowrap', up ? 'text-emerald-700' : 'text-red-700')}>
        <Icon className="inline size-3.5 align-[-2px]" aria-hidden />
        {up ? '+' : '−'}
        {Math.abs(value).toFixed(1)} %
      </span>{' '}
      {suffix}
    </>
  )
}

const PENDING_TONES = {
  red: 'bg-red-50 text-red-700',
  amber: 'bg-amber-50 text-amber-700',
  sky: 'bg-sky-50 text-sky-700',
} as const

function Pending({
  to,
  icon: Icon,
  label,
  value,
  tone,
}: {
  to: string
  icon: typeof BellRing
  label: ReactNode
  value: number | undefined
  tone: keyof typeof PENDING_TONES
}) {
  const active = (value ?? 0) > 0
  return (
    <li>
      <Link to={to} className="flex items-center gap-3 px-5 py-3 text-sm hover:bg-slate-50">
        <span className={cn('flex size-8 items-center justify-center rounded-lg', active ? PENDING_TONES[tone] : 'bg-slate-100 text-slate-400')}>
          <Icon className="size-4" aria-hidden />
        </span>
        <span className="flex-1 text-slate-700">{label}</span>
        <span className={cn('tabular font-semibold', active ? 'text-slate-900' : 'text-slate-400')}>{value ?? '—'}</span>
      </Link>
    </li>
  )
}

function Shortcuts() {
  const can = useCan()
  const shortcuts = navigation
    .flatMap((section) => section.items)
    .filter((item) => item.to !== '/' && (!item.permission || can(item.permission)))

  if (shortcuts.length === 0) {
    return <Card className="p-6 text-sm text-slate-500">Aún no hay módulos disponibles para tu rol.</Card>
  }
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {shortcuts.map((item) => (
        <Link key={item.to} to={item.to} className="group">
          <Card className="flex items-center gap-4 p-5 transition-shadow group-hover:shadow-md">
            <div className="flex size-10 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
              <item.icon className="size-5" aria-hidden />
            </div>
            <span className="flex-1 font-medium text-slate-800">{item.label}</span>
            <ArrowRight className="size-4 text-slate-300 transition-transform group-hover:translate-x-0.5 group-hover:text-slate-500" />
          </Card>
        </Link>
      ))}
    </div>
  )
}
