import { http } from 'msw'
import { api, context } from '@/mocks/context'
import {
  averageCost,
  forecast,
  MODEL_VERSION,
  runPredictions,
  save,
  stockOf,
  toLocalDate,
  weekStart,
  type AlertRec,
  type MockDb,
  type SaleRec,
} from '@/mocks/db'
import { badRequest, handle, notFound, query } from '@/mocks/utils'
import type { Product } from '@/features/catalog/api'
import { round2 } from '@/lib/tax'
import type { DashboardData, GroupBy, SalesReport, SalesReportRow, StockAlert, TopProduct } from './api'

const day = (iso: string) => toLocalDate(new Date(iso))
const completed = (d: MockDb) => d.sales.filter((s) => s.status === 'COMPLETED')

function saleCost(s: SaleRec) {
  return s.items.reduce((sum, i) => sum + i.quantity * i.unitCost, 0)
}

function periodOf(date: string, groupBy: GroupBy) {
  if (groupBy === 'day') return date
  if (groupBy === 'month') return date.slice(0, 7) + '-01'
  const [y, m, dd] = date.split('-').map(Number)
  return weekStart(new Date(y, m - 1, dd))
}

function topProducts(sales: SaleRec[], limit: number): TopProduct[] {
  const map = new Map<string, TopProduct>()
  for (const s of sales) {
    for (const i of s.items) {
      const row = map.get(i.productId) ?? { productId: i.productId, sku: i.sku, productName: i.productName, quantity: 0, total: 0, grossProfit: 0 }
      row.quantity += i.quantity
      row.total += i.lineTotal
      row.grossProfit += i.lineTotal - i.taxAmount - i.quantity * i.unitCost
      map.set(i.productId, row)
    }
  }
  return [...map.values()]
    .map((r) => ({ ...r, total: round2(r.total), grossProfit: round2(r.grossProfit) }))
    .sort((a, b) => b.total - a.total)
    .slice(0, limit)
}

function toAlert(d: MockDb, products: Map<string, Product>, a: AlertRec): StockAlert {
  const p = products.get(a.productId)
  return {
    ...a,
    productName: p?.name ?? 'Producto eliminado',
    sku: p?.sku ?? '—',
    unitCode: p?.unitCode ?? '',
    warehouseName: d.warehouses.find((w) => w.warehouseId === a.warehouseId)?.name ?? '—',
  }
}

function addDays(date: string, n: number) {
  const [y, m, dd] = date.split('-').map(Number)
  return toLocalDate(new Date(y, m - 1, dd + n))
}

export const reportsHandlers = [
  http.get(
    api('/reports/dashboard'),
    handle(async ({ user }) => {
      const { d, products } = await context(user)
      const today = toLocalDate(new Date())
      const monthStart = today.slice(0, 7) + '-01'
      // Mismo tramo del mes anterior (del 1 al día de hoy), para comparar en igualdad de días.
      const now = new Date()
      const prevStart = toLocalDate(new Date(now.getFullYear(), now.getMonth() - 1, 1))
      const prevLastDay = new Date(now.getFullYear(), now.getMonth(), 0).getDate()
      const prevEnd = toLocalDate(new Date(now.getFullYear(), now.getMonth() - 1, Math.min(now.getDate(), prevLastDay)))
      const from30 = addDays(today, -29)
      const sales = completed(d)

      const todaySales = sales.filter((s) => day(s.soldAt) === today)
      const monthSales = sales.filter((s) => day(s.soldAt) >= monthStart)
      const monthSubtotal = monthSales.reduce((s, x) => s + x.subtotal, 0)
      const monthProfit = monthSubtotal - monthSales.reduce((s, x) => s + saleCost(x), 0)
      const todayTotal = todaySales.reduce((s, x) => s + x.total, 0)

      const byDay = new Map<string, { total: number; count: number }>()
      for (let i = 0; i < 30; i++) byDay.set(addDays(from30, i), { total: 0, count: 0 })
      for (const s of sales) {
        const row = byDay.get(day(s.soldAt))
        if (row) {
          row.total += s.total
          row.count += 1
        }
      }

      const main = d.warehouses[0].warehouseId
      const active = products.filter((p) => p.isActive)
      const result: DashboardData = {
        today: { total: round2(todayTotal), count: todaySales.length, averageTicket: todaySales.length ? round2(todayTotal / todaySales.length) : 0 },
        month: {
          total: round2(monthSales.reduce((s, x) => s + x.total, 0)),
          count: monthSales.length,
          grossProfit: round2(monthProfit),
          marginPct: monthSubtotal ? Math.round((monthProfit / monthSubtotal) * 1000) / 10 : 0,
        },
        previousMonthTotal: round2(sales.filter((s) => day(s.soldAt) >= prevStart && day(s.soldAt) <= prevEnd).reduce((s, x) => s + x.total, 0)),
        inventoryValue: round2(d.stocks.reduce((s, x) => s + x.quantity * averageCost(d, x.productId), 0)),
        lowStockCount: active.filter((p) => {
          const q = stockOf(d, p.productId, main)
          return q > 0 && q < p.minStock
        }).length,
        outOfStockCount: active.filter((p) => stockOf(d, p.productId, main) <= 0).length,
        openAlerts: d.alerts.filter((a) => a.status === 'OPEN').length,
        pendingPurchaseOrders: d.purchaseOrders.filter((p) => p.status === 'APPROVED').length,
        pendingTransfers: d.transfers.filter((t) => t.status === 'PENDING').length,
        salesByDay: [...byDay.entries()].map(([date, v]) => ({ date, total: round2(v.total), count: v.count })),
        topProducts: topProducts(sales.filter((s) => day(s.soldAt) >= from30), 5),
      }
      return result
    }),
  ),

  http.get(
    api('/reports/sales'),
    handle(async ({ request, user }) => {
      const { d } = await context(user)
      const q = query(request)
      const from = q.str('from')
      const to = q.str('to')
      const groupBy = (q.str('groupBy') ?? 'day') as GroupBy
      if (!from || !to) throw badRequest('Indica el rango de fechas.')
      if (from > to) throw badRequest('La fecha inicial es mayor que la final.')

      const rows = new Map<string, SalesReportRow>()
      for (const s of completed(d)) {
        const date = day(s.soldAt)
        if (date < from || date > to) continue
        const period = periodOf(date, groupBy)
        const row = rows.get(period) ?? { period, count: 0, subtotal: 0, taxAmount: 0, total: 0, cost: 0, grossProfit: 0 }
        row.count += 1
        row.subtotal += s.subtotal
        row.taxAmount += s.taxAmount
        row.total += s.total
        row.cost += saleCost(s)
        rows.set(period, row)
      }
      const list = [...rows.values()]
        .map((r) => ({ ...r, subtotal: round2(r.subtotal), taxAmount: round2(r.taxAmount), total: round2(r.total), cost: round2(r.cost), grossProfit: round2(r.subtotal - r.cost) }))
        .sort((a, b) => a.period.localeCompare(b.period))
      const sum = (k: keyof Omit<SalesReportRow, 'period'>) => round2(list.reduce((s, r) => s + r[k], 0))
      const report: SalesReport = {
        rows: list,
        totals: { count: sum('count'), subtotal: sum('subtotal'), taxAmount: sum('taxAmount'), total: sum('total'), cost: sum('cost'), grossProfit: sum('grossProfit') },
      }
      return report
    }),
  ),

  http.get(
    api('/reports/top-products'),
    handle(async ({ request, user }) => {
      const { d } = await context(user)
      const q = query(request)
      const from = q.str('from') ?? '0000-01-01'
      const to = q.str('to') ?? '9999-12-31'
      return topProducts(completed(d).filter((s) => day(s.soldAt) >= from && day(s.soldAt) <= to), q.int('limit', 10))
    }),
  ),

  http.get(
    api('/predictions'),
    handle(async ({ request, user }) => {
      const { d, productMap } = await context(user)
      const q = query(request)
      const productId = q.str('productId')
      if (!productId) throw badRequest('Indica el producto.')
      const product = productMap.get(productId)
      if (!product) throw notFound('Producto')
      const warehouseId = q.str('warehouseId') ?? d.warehouses[0].warehouseId
      return {
        productId,
        productName: product.name,
        unitCode: product.unitCode,
        warehouseId,
        modelVersion: MODEL_VERSION,
        currentStock: stockOf(d, productId, warehouseId),
        points: forecast(d, productId, warehouseId),
      }
    }),
  ),

  http.post(
    api('/predictions/run'),
    handle(async ({ user }) => {
      const { d, products } = await context(user)
      return runPredictions(d, products)
    }),
  ),

  http.get(
    api('/alerts'),
    handle(async ({ request, user }) => {
      const { d, productMap } = await context(user)
      const status = query(request).str('status')
      return d.alerts
        .filter((a) => !status || a.status === status)
        .slice()
        .reverse()
        .map((a) => toAlert(d, productMap, a))
    }),
  ),

  ...(['acknowledge', 'resolve'] as const).map((action) =>
    http.post(
      api(`/alerts/:id/${action}`),
      handle(async ({ request, user }) => {
        const { d, productMap } = await context(user)
        const id = new URL(request.url).pathname.split('/').at(-2)
        const alert = d.alerts.find((a) => a.stockAlertId === id)
        if (!alert) throw notFound('Alerta')
        if (alert.status === 'RESOLVED') throw badRequest('La alerta ya está resuelta.')
        if (action === 'acknowledge') alert.status = 'ACKNOWLEDGED'
        else {
          alert.status = 'RESOLVED'
          alert.resolvedAt = new Date().toISOString()
          alert.resolvedByName = user.username
        }
        save()
        return toAlert(d, productMap, alert)
      }),
    ),
  ),
]
