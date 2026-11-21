/**
 * Contrato de reportes, predicción de demanda y alertas (aún sin backend: en desarrollo
 * responde MSW, ver ./mocks.ts). Regla 11: predicción semanal por producto; si el stock
 * no alcanza para la demanda predicha se abre una alerta.
 */
import { http } from '@/api/http'
import type { Guid, IsoDate } from '@/api/types'

export interface DashboardData {
  today: { total: number; count: number; averageTicket: number }
  month: { total: number; count: number; grossProfit: number; marginPct: number }
  /** Ventas del mes anterior del día 1 al mismo día de hoy (comparación en igualdad de días). */
  previousMonthTotal: number
  inventoryValue: number
  lowStockCount: number
  outOfStockCount: number
  openAlerts: number
  pendingPurchaseOrders: number
  pendingTransfers: number
  /** Últimos 30 días, uno por día (YYYY-MM-DD), incluidos los días sin ventas. */
  salesByDay: { date: string; total: number; count: number }[]
  /** Top 5 por monto de los últimos 30 días. */
  topProducts: TopProduct[]
}

export interface TopProduct {
  productId: Guid
  sku: string
  productName: string
  quantity: number
  total: number
  grossProfit: number
}

export type GroupBy = 'day' | 'week' | 'month'

export interface SalesReportRow {
  /** Inicio del período, YYYY-MM-DD. */
  period: string
  count: number
  subtotal: number
  taxAmount: number
  total: number
  /** Costo de lo vendido (costo promedio del momento, sin IGV). */
  cost: number
  /** subtotal − cost */
  grossProfit: number
}

export interface SalesReport {
  rows: SalesReportRow[]
  totals: Omit<SalesReportRow, 'period'>
}

export interface ForecastPoint {
  periodStart: string
  periodEnd: string
  /** Vendido en la semana (semanas pasadas). */
  actualQuantity: number | null
  /** Predicción y su intervalo (semanas futuras). */
  predictedQuantity: number | null
  lowerBound: number | null
  upperBound: number | null
}

export interface DemandForecast {
  productId: Guid
  productName: string
  unitCode: string
  warehouseId: Guid
  modelVersion: string
  currentStock: number
  points: ForecastPoint[]
}

export type AlertType = 'LOW_STOCK' | 'PREDICTED_SHORTAGE'
export type AlertStatus = 'OPEN' | 'ACKNOWLEDGED' | 'RESOLVED'

export interface StockAlert {
  stockAlertId: Guid
  productId: Guid
  productName: string
  sku: string
  unitCode: string
  warehouseName: string
  alertType: AlertType
  currentStock: number
  /** Stock mínimo (LOW_STOCK) o demanda predicha de la semana (PREDICTED_SHORTAGE). */
  threshold: number
  suggestedOrderQty: number | null
  status: AlertStatus
  createdAt: IsoDate
  resolvedAt: IsoDate | null
  resolvedByName: string | null
}

export const reportsApi = {
  dashboard: () => http.get<DashboardData>('/reports/dashboard').then((r) => r.data),
  sales: (params: { from: string; to: string; groupBy: GroupBy }) =>
    http.get<SalesReport>('/reports/sales', { params }).then((r) => r.data),
  topProducts: (params: { from: string; to: string; limit?: number }) =>
    http.get<TopProduct[]>('/reports/top-products', { params }).then((r) => r.data),

  forecast: (productId: Guid, warehouseId?: Guid) =>
    http.get<DemandForecast>('/predictions', { params: { productId, warehouseId } }).then((r) => r.data),
  runPredictions: () => http.post<{ created: number; modelVersion: string }>('/predictions/run').then((r) => r.data),

  alerts: (status?: AlertStatus) => http.get<StockAlert[]>('/alerts', { params: { status } }).then((r) => r.data),
  acknowledge: (id: Guid) => http.post<StockAlert>(`/alerts/${id}/acknowledge`).then((r) => r.data),
  resolve: (id: Guid) => http.post<StockAlert>(`/alerts/${id}/resolve`).then((r) => r.data),
}
