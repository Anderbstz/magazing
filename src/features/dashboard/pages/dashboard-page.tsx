import { AlertTriangle, ArrowDownRight, ArrowRight, ArrowUpRight, BellRing, ClipboardList, PackageX, Receipt, TrendingUp, Truck, Wallet } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { navigation } from '@/app/navigation'
import { PageHeader } from '@/components/page-header'
import { StatCard } from '@/components/stat-card'
import { Card, CardHeader } from '@/components/ui/card'
import { ErrorState } from '@/components/ui/states'
import { P } from '@/config/permissions'
import { useCan, useSession } from '@/features/auth/use-auth'
import { labelDate } from '@/features/reports/components/chart-utils'
import { SalesBarChart, TopProductsChart } from '@/features/reports/components/charts'
import { useDashboard } from '@/features/reports/queries'
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
      <PageHeader title={greeting} description="Así va tu tienda hoy." />
      <Indicators />
    </>
  )
}

function Indicators() {
  const dashboard = useDashboard()
  const d = dashboard.data
  const loading = dashboard.isPending

  if (dashboard.isError) return <Card><ErrorState error={dashboard.error} onRetry={() => dashboard.refetch()} /></Card>

  const vsPrev = d && d.previousMonthTotal > 0 ? ((d.month.total - d.previousMonthTotal) / d.previousMonthTotal) * 100 : null

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Ventas de hoy" icon={Receipt} loading={loading} value={formatMoney(d?.today.total)} detail={d && `${d.today.count} comprobantes · ticket prom. ${formatMoney(d.today.averageTicket)}`} />
        <StatCard
          label="Ventas del mes"
          icon={TrendingUp}
          tone="sky"
          loading={loading}
          value={formatMoney(d?.month.total)}
          detail={vsPrev !== null && <Trend value={vsPrev} suffix="vs. mismo periodo del mes anterior" />}
        />
        <StatCard label="Utilidad bruta del mes" icon={Wallet} tone="brand" loading={loading} value={formatMoney(d?.month.grossProfit)} detail={d && `Margen ${d.month.marginPct.toFixed(1)} % sobre la venta sin IGV`} />
        <StatCard label="Valor del inventario" icon={Wallet} tone="slate" loading={loading} value={formatMoney(d?.inventoryValue)} detail="Al costo promedio" />
      </div>

      <div className="grid gap-6 xl:grid-cols-[2fr_1fr]">
        <Card>
          <CardHeader title="Ventas de los últimos 30 días" description="Total diario con IGV" />
          <div className="p-4">
            {loading ? (
              <div className="h-[260px] animate-pulse rounded-lg bg-slate-50" />
            ) : (
              <SalesBarChart data={d!.salesByDay.map((x) => ({ label: labelDate(x.date), total: x.total, count: x.count }))} />
            )}
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

      <Card>
        <CardHeader
          title="Productos más vendidos"
          description="Últimos 30 días, por monto"
          actions={
            <Link to="/reports" className="inline-flex items-center gap-1 text-sm font-medium text-brand-700 hover:underline">
              Ver reportes <ArrowRight className="size-4" />
            </Link>
          }
        />
        <div className="p-4">
          {loading ? (
            <div className="h-40 animate-pulse rounded-lg bg-slate-50" />
          ) : d!.topProducts.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-500">Aún no hay ventas en este período.</p>
          ) : (
            <TopProductsChart data={d!.topProducts} />
          )}
        </div>
      </Card>
    </div>
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
