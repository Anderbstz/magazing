import { http } from 'msw'
import type { Product } from '@/features/catalog/api'
import { api, context } from '@/mocks/context'
import {
  approvePurchaseOrder,
  cancelPurchaseOrder,
  createPurchaseOrder,
  receivePurchaseOrder,
  requirePurchaseOrder,
  save,
  updatePurchaseOrder,
  type MockDb,
  type PurchaseOrderRec,
  type SupplierRec,
} from '@/mocks/db'
import { badRequest, contains, handle, newId, notFound, paginate, query } from '@/mocks/utils'
import type { PurchaseOrderDetail, PurchaseOrderSummary, SupplierRequest } from './api'

const idFrom = (request: Request, fromEnd = 1) => new URL(request.url).pathname.split('/').at(-fromEnd)!

function validateSupplier(d: MockDb, body: SupplierRequest, currentId?: string) {
  if (!/^\d{11}$/.test(body.ruc ?? '')) throw badRequest('El RUC debe tener 11 dígitos.')
  if (!body.businessName?.trim()) throw badRequest('La razón social es obligatoria.')
  if (d.suppliers.some((s) => s.ruc === body.ruc && s.supplierId !== currentId)) throw badRequest('Ya existe un proveedor con ese RUC.')
}

function toSummary(d: MockDb, po: PurchaseOrderRec): PurchaseOrderSummary {
  return {
    purchaseOrderId: po.purchaseOrderId,
    code: po.code,
    supplierId: po.supplierId,
    supplierName: d.suppliers.find((s) => s.supplierId === po.supplierId)?.businessName ?? '—',
    warehouseId: po.warehouseId,
    warehouseName: d.warehouses.find((w) => w.warehouseId === po.warehouseId)?.name ?? '—',
    status: po.status,
    orderDate: po.orderDate,
    expectedDate: po.expectedDate,
    subtotal: po.subtotal,
    taxAmount: po.taxAmount,
    total: po.total,
    itemCount: po.items.length,
    createdByName: po.createdByName,
    createdAt: po.createdAt,
  }
}

function toDetail(d: MockDb, products: Map<string, Product>, po: PurchaseOrderRec): PurchaseOrderDetail {
  return {
    ...toSummary(d, po),
    supplierRuc: d.suppliers.find((s) => s.supplierId === po.supplierId)?.ruc ?? '',
    notes: po.notes,
    approvedByName: po.approvedByName,
    approvedAt: po.approvedAt,
    receivedAt: po.receivedAt,
    items: po.items.map((i) => {
      const p = products.get(i.productId)
      return { ...i, sku: p?.sku ?? '—', productName: p?.name ?? 'Producto eliminado', unitCode: p?.unitCode ?? '' }
    }),
  }
}

export const purchasesHandlers = [
  http.get(
    api('/suppliers'),
    handle(async ({ request, user }) => {
      const { d } = await context(user)
      const q = query(request)
      const search = q.str('search')
      const isActive = q.bool('isActive')
      const rows = d.suppliers
        .filter((s) => (isActive === undefined || s.isActive === isActive) && (contains(s.businessName, search) || contains(s.ruc, search)))
        .sort((a, b) => a.businessName.localeCompare(b.businessName))
      return paginate(rows, q.int('page', 1), q.int('pageSize', 20))
    }),
  ),

  http.post(
    api('/suppliers'),
    handle(async ({ request, user }) => {
      const { d } = await context(user)
      const body = (await request.json()) as SupplierRequest
      validateSupplier(d, body)
      const supplier: SupplierRec = { ...body, supplierId: newId(), isActive: true, createdAt: new Date().toISOString() }
      d.suppliers.push(supplier)
      save()
      return supplier
    }, 201),
  ),

  http.put(
    api('/suppliers/:id'),
    handle(async ({ request, user }) => {
      const { d } = await context(user)
      const id = idFrom(request)
      const supplier = d.suppliers.find((s) => s.supplierId === id)
      if (!supplier) throw notFound('Proveedor')
      const body = (await request.json()) as SupplierRequest & { isActive: boolean }
      validateSupplier(d, body, id)
      Object.assign(supplier, body)
      save()
      return supplier
    }),
  ),

  http.get(
    api('/purchase-orders'),
    handle(async ({ request, user }) => {
      const { d } = await context(user)
      const q = query(request)
      const status = q.str('status')
      const supplierId = q.str('supplierId')
      const search = q.str('search')
      const rows = d.purchaseOrders
        .filter((po) => (!status || po.status === status) && (!supplierId || po.supplierId === supplierId))
        .map((po) => toSummary(d, po))
        .filter((po) => contains(po.code, search) || contains(po.supplierName, search))
        .reverse()
      return paginate(rows, q.int('page', 1), q.int('pageSize', 20))
    }),
  ),

  http.get(
    api('/purchase-orders/:id'),
    handle(async ({ request, user }) => {
      const { d, productMap } = await context(user)
      return toDetail(d, productMap, requirePurchaseOrder(d, idFrom(request)))
    }),
  ),

  http.post(
    api('/purchase-orders'),
    handle(async ({ request, user }) => {
      const { d, productMap } = await context(user)
      return toDetail(d, productMap, createPurchaseOrder(d, productMap, user, (await request.json()) as never))
    }, 201),
  ),

  http.put(
    api('/purchase-orders/:id'),
    handle(async ({ request, user }) => {
      const { d, productMap } = await context(user)
      return toDetail(d, productMap, updatePurchaseOrder(d, productMap, idFrom(request), (await request.json()) as never))
    }),
  ),

  http.post(
    api('/purchase-orders/:id/approve'),
    handle(async ({ request, user }) => {
      const { d, productMap } = await context(user)
      return toDetail(d, productMap, approvePurchaseOrder(d, user, idFrom(request, 2)))
    }),
  ),

  http.post(
    api('/purchase-orders/:id/receive'),
    handle(async ({ request, user }) => {
      const { d, productMap } = await context(user)
      return toDetail(d, productMap, receivePurchaseOrder(d, user, idFrom(request, 2)))
    }),
  ),

  http.post(
    api('/purchase-orders/:id/cancel'),
    handle(async ({ request, user }) => {
      const { d, productMap } = await context(user)
      return toDetail(d, productMap, cancelPurchaseOrder(d, idFrom(request, 2)))
    }),
  ),
]
