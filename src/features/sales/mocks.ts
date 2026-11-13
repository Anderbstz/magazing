import { http } from 'msw'
import { api, context } from '@/mocks/context'
import { cancelSale, createSale, save, toLocalDate, type CustomerRec, type MockDb, type SaleRec } from '@/mocks/db'
import { badRequest, contains, handle, newId, notFound, paginate, query } from '@/mocks/utils'
import { round2 } from '@/lib/tax'
import type { CreateSaleRequest, CustomerRequest, SaleDetail, SaleSummary } from './api'

const idFrom = (request: Request, fromEnd = 1) => new URL(request.url).pathname.split('/').at(-fromEnd)!

const DOC_RULES: Record<string, RegExp> = {
  DNI: /^\d{8}$/,
  RUC: /^\d{11}$/,
  CE: /^.{6,20}$/,
  PASSPORT: /^.{6,20}$/,
}

function validateCustomer(d: MockDb, body: CustomerRequest, currentId?: string) {
  const rule = DOC_RULES[body.documentType]
  if (!rule) throw badRequest('Tipo de documento no válido.')
  if (!rule.test(body.documentNumber ?? '')) throw badRequest(`Número de ${body.documentType} no válido.`)
  if (!body.fullName?.trim()) throw badRequest('El nombre es obligatorio.')
  if (d.customers.some((c) => c.documentType === body.documentType && c.documentNumber === body.documentNumber && c.customerId !== currentId)) {
    throw badRequest('Ya existe un cliente con ese documento.')
  }
}

function methodName(d: MockDb, id: string) {
  return d.paymentMethods.find((m) => m.paymentMethodId === id)?.name ?? '—'
}

function toSummary(d: MockDb, s: SaleRec): SaleSummary {
  return {
    saleId: s.saleId,
    fullNumber: s.invoice.fullNumber,
    documentType: s.invoice.documentType,
    customerName: s.invoice.customerName,
    customerDocumentType: s.invoice.customerDocumentType,
    customerDocumentNumber: s.invoice.customerDocumentNumber,
    sellerName: s.sellerName,
    status: s.status,
    itemCount: s.items.length,
    total: s.total,
    paymentMethods: [...new Set(s.payments.map((p) => methodName(d, p.paymentMethodId)))],
    soldAt: s.soldAt,
  }
}

function toDetail(d: MockDb, s: SaleRec, change = 0): SaleDetail {
  return {
    ...toSummary(d, s),
    warehouseId: s.warehouseId,
    warehouseName: d.warehouses.find((w) => w.warehouseId === s.warehouseId)?.name ?? '—',
    subtotal: s.subtotal,
    discountTotal: s.discountTotal,
    taxAmount: s.taxAmount,
    notes: s.notes,
    cancelledAt: s.cancelledAt,
    cancelReason: s.cancelReason,
    change,
    items: s.items.map(({ unitCost: _cost, ...i }) => i),
    payments: s.payments.map((p) => ({ ...p, methodName: methodName(d, p.paymentMethodId) })),
  }
}

export const salesHandlers = [
  http.get(
    api('/payment-methods'),
    handle(async ({ user }) => (await context(user)).d.paymentMethods.filter((m) => m.isActive)),
  ),

  http.get(
    api('/customers'),
    handle(async ({ request, user }) => {
      const { d } = await context(user)
      const q = query(request)
      const search = q.str('search')
      const isActive = q.bool('isActive')
      const rows = d.customers
        .filter((c) => (isActive === undefined || c.isActive === isActive) && (contains(c.fullName, search) || contains(c.documentNumber, search)))
        // "CLIENTES VARIOS" siempre primero: es el cliente por defecto del punto de venta.
        .sort((a, b) => (a.documentNumber === '00000000' ? -1 : b.documentNumber === '00000000' ? 1 : a.fullName.localeCompare(b.fullName)))
      return paginate(rows, q.int('page', 1), q.int('pageSize', 20))
    }),
  ),

  http.post(
    api('/customers'),
    handle(async ({ request, user }) => {
      const { d } = await context(user)
      const body = (await request.json()) as CustomerRequest
      validateCustomer(d, body)
      const customer: CustomerRec = { ...body, fullName: body.fullName.trim(), customerId: newId(), isActive: true, createdAt: new Date().toISOString() }
      d.customers.push(customer)
      save()
      return customer
    }, 201),
  ),

  http.put(
    api('/customers/:id'),
    handle(async ({ request, user }) => {
      const { d } = await context(user)
      const id = idFrom(request)
      const customer = d.customers.find((c) => c.customerId === id)
      if (!customer) throw notFound('Cliente')
      const body = (await request.json()) as CustomerRequest & { isActive: boolean }
      validateCustomer(d, body, id)
      Object.assign(customer, body)
      save()
      return customer
    }),
  ),

  http.get(
    api('/sales'),
    handle(async ({ request, user }) => {
      const { d } = await context(user)
      const q = query(request)
      const status = q.str('status')
      const documentType = q.str('documentType')
      const from = q.str('from')
      const to = q.str('to')
      const search = q.str('search')
      const rows = d.sales
        .filter((s) => {
          const day = toLocalDate(new Date(s.soldAt))
          return (
            (!status || s.status === status) &&
            (!documentType || s.invoice.documentType === documentType) &&
            (!from || day >= from) &&
            (!to || day <= to) &&
            (contains(s.invoice.fullNumber, search) || contains(s.invoice.customerName, search) || contains(s.invoice.customerDocumentNumber, search))
          )
        })
        .map((s) => toSummary(d, s))
        .reverse()
      return paginate(rows, q.int('page', 1), q.int('pageSize', 20))
    }),
  ),

  http.get(
    api('/sales/:id'),
    handle(async ({ request, user }) => {
      const { d } = await context(user)
      const sale = d.sales.find((s) => s.saleId === idFrom(request))
      if (!sale) throw notFound('Venta')
      return toDetail(d, sale)
    }),
  ),

  http.post(
    api('/sales'),
    handle(async ({ request, user }) => {
      const { d, productMap } = await context(user)
      const body = (await request.json()) as CreateSaleRequest
      const sale = createSale(d, productMap, user, body)
      const paid = body.payments.reduce((s, p) => s + p.amount, 0)
      return toDetail(d, sale, round2(paid - sale.total))
    }, 201),
  ),

  http.post(
    api('/sales/:id/cancel'),
    handle(async ({ request, user }) => {
      const { d } = await context(user)
      const { reason } = (await request.json()) as { reason: string }
      return toDetail(d, cancelSale(d, user, idFrom(request, 2), reason))
    }),
  ),
]
