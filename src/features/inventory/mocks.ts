import { http } from 'msw'
import type { Product } from '@/features/catalog/api'
import { api, context } from '@/mocks/context'
import {
  adjustStock,
  averageCost,
  cancelTransfer,
  completeTransfer,
  createTransfer,
  MOVEMENT_TYPES,
  round3,
  stockOf,
  type MockDb,
  type MovementCode,
  type TransferRec,
  toLocalDate,
} from '@/mocks/db'
import { contains, handle, notFound, paginate, query } from '@/mocks/utils'
import type { Movement, StockItem, StockStatus, TransferDetail, TransferSummary } from './api'

function stockStatus(quantity: number, minStock: number): StockStatus {
  if (quantity <= 0) return 'OUT'
  if (quantity < minStock) return 'LOW'
  return 'OK'
}

function stockRows(d: MockDb, products: Product[], warehouseId: string): StockItem[] {
  return products
    .filter((p) => p.isActive)
    .map((p) => {
      const quantity = stockOf(d, p.productId, warehouseId)
      const cost = averageCost(d, p.productId)
      return {
        productId: p.productId,
        sku: p.sku,
        productName: p.name,
        unitCode: p.unitCode,
        categoryName: p.categoryName,
        warehouseId,
        quantity,
        minStock: p.minStock,
        maxStock: p.maxStock,
        averageCost: cost,
        stockValue: Math.round(quantity * cost * 100) / 100,
        status: stockStatus(quantity, p.minStock),
      }
    })
    .sort((a, b) => a.productName.localeCompare(b.productName))
}

function toTransferSummary(d: MockDb, t: TransferRec): TransferSummary {
  const name = (id: string) => d.warehouses.find((w) => w.warehouseId === id)?.name ?? '—'
  return {
    transferId: t.transferId,
    code: t.code,
    originWarehouseId: t.originWarehouseId,
    originWarehouseName: name(t.originWarehouseId),
    destinationWarehouseId: t.destinationWarehouseId,
    destinationWarehouseName: name(t.destinationWarehouseId),
    status: t.status,
    itemCount: t.items.length,
    totalQuantity: round3(t.items.reduce((s, i) => s + i.quantity, 0)),
    notes: t.notes,
    requestedByName: t.requestedByName,
    completedByName: t.completedByName,
    createdAt: t.createdAt,
    completedAt: t.completedAt,
  }
}

function toTransferDetail(d: MockDb, products: Map<string, Product>, t: TransferRec): TransferDetail {
  return {
    ...toTransferSummary(d, t),
    items: t.items.map((i) => {
      const p = products.get(i.productId)
      return {
        productId: i.productId,
        sku: p?.sku ?? '—',
        productName: p?.name ?? 'Producto eliminado',
        unitCode: p?.unitCode ?? '',
        quantity: i.quantity,
        availableAtOrigin: stockOf(d, i.productId, t.originWarehouseId),
      }
    }),
  }
}

export const inventoryHandlers = [
  http.get(
    api('/warehouses'),
    handle(async ({ user }) => (await context(user)).d.warehouses),
  ),

  http.get(
    api('/stocks'),
    handle(async ({ request, user }) => {
      const { d, products } = await context(user)
      const q = query(request)
      const warehouseId = q.str('warehouseId') ?? d.warehouses[0].warehouseId
      const search = q.str('search')
      const status = q.str('status')
      const rows = stockRows(d, products, warehouseId).filter(
        (r) => (contains(r.productName, search) || contains(r.sku, search)) && (!status || r.status === status),
      )
      return paginate(rows, q.int('page', 1), q.int('pageSize', 20))
    }),
  ),

  http.get(
    api('/stocks/summary'),
    handle(async ({ request, user }) => {
      const { d, products } = await context(user)
      const warehouseId = query(request).str('warehouseId') ?? d.warehouses[0].warehouseId
      const rows = stockRows(d, products, warehouseId)
      return {
        productCount: rows.length,
        totalUnits: round3(rows.reduce((s, r) => s + r.quantity, 0)),
        totalValue: Math.round(rows.reduce((s, r) => s + r.stockValue, 0) * 100) / 100,
        lowCount: rows.filter((r) => r.status === 'LOW').length,
        outCount: rows.filter((r) => r.status === 'OUT').length,
      }
    }),
  ),

  http.get(
    api('/inventory/movements'),
    handle(async ({ request, user }) => {
      const { d, productMap } = await context(user)
      const q = query(request)
      const productId = q.str('productId')
      const warehouseId = q.str('warehouseId')
      const type = q.str('type')
      const from = q.str('from')
      const to = q.str('to')
      const search = q.str('search')
      const rows: Movement[] = d.movements
        .filter(
          (m) =>
            (!productId || m.productId === productId) &&
            (!warehouseId || m.warehouseId === warehouseId) &&
            (!type || m.movementTypeCode === type) &&
            // Filtro por día local (Perú es UTC-5): una venta de las 9 p. m. es de hoy, no de mañana.
            (!from || toLocalDate(new Date(m.createdAt)) >= from) &&
            (!to || toLocalDate(new Date(m.createdAt)) <= to),
        )
        .map((m) => {
          const p = productMap.get(m.productId)
          const t = MOVEMENT_TYPES[m.movementTypeCode as MovementCode]
          return {
            ...m,
            productName: p?.name ?? 'Producto eliminado',
            sku: p?.sku ?? '—',
            warehouseCode: d.warehouses.find((w) => w.warehouseId === m.warehouseId)?.code ?? '—',
            movementTypeName: t.name,
            direction: t.direction,
          }
        })
        .filter((m) => contains(m.productName, search) || contains(m.referenceCode, search))
        // Más recientes primero; a igual fecha, el último insertado primero.
        .reverse()
      return paginate(rows, q.int('page', 1), q.int('pageSize', 25))
    }),
  ),

  http.post(
    api('/inventory/adjustments'),
    handle(async ({ request, user }) => {
      const { d, productMap } = await context(user)
      const body = await request.json()
      const m = adjustStock(d, productMap, user, body as never)
      const p = productMap.get(m.productId)!
      const t = MOVEMENT_TYPES[m.movementTypeCode]
      return {
        ...m,
        productName: p.name,
        sku: p.sku,
        warehouseCode: d.warehouses.find((w) => w.warehouseId === m.warehouseId)?.code ?? '—',
        movementTypeName: t.name,
        direction: t.direction,
      } satisfies Movement
    }, 201),
  ),

  http.get(
    api('/transfers'),
    handle(async ({ request, user }) => {
      const { d } = await context(user)
      const q = query(request)
      const status = q.str('status')
      const search = q.str('search')
      const rows = d.transfers
        .filter((t) => (!status || t.status === status) && contains(t.code, search))
        .slice()
        .reverse()
        .map((t) => toTransferSummary(d, t))
      return paginate(rows, q.int('page', 1), q.int('pageSize', 20))
    }),
  ),

  http.get(
    api('/transfers/:id'),
    handle(async ({ request, user }) => {
      const { d, productMap } = await context(user)
      const id = new URL(request.url).pathname.split('/').at(-1)
      const t = d.transfers.find((x) => x.transferId === id)
      if (!t) throw notFound('Transferencia')
      return toTransferDetail(d, productMap, t)
    }),
  ),

  http.post(
    api('/transfers'),
    handle(async ({ request, user }) => {
      const { d, productMap } = await context(user)
      const t = createTransfer(d, productMap, user, (await request.json()) as never)
      return toTransferDetail(d, productMap, t)
    }, 201),
  ),

  http.post(
    api('/transfers/:id/complete'),
    handle(async ({ request, user }) => {
      const { d, productMap } = await context(user)
      const id = new URL(request.url).pathname.split('/').at(-2)!
      return toTransferDetail(d, productMap, completeTransfer(d, productMap, user, id))
    }),
  ),

  http.post(
    api('/transfers/:id/cancel'),
    handle(async ({ request, user }) => {
      const { d, productMap } = await context(user)
      const id = new URL(request.url).pathname.split('/').at(-2)!
      return toTransferDetail(d, productMap, cancelTransfer(d, id))
    }),
  ),
]
