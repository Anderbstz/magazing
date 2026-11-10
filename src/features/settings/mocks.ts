import { http } from 'msw'
import { api, context } from '@/mocks/context'
import { processOutbox, save, type MockDb, type WarehouseRec } from '@/mocks/db'
import { badRequest, contains, handle, newId, notFound, paginate, query } from '@/mocks/utils'
import type {
  Branch,
  BranchRequest,
  CompanyRequest,
  DocumentSeries,
  DocumentSeriesRequest,
  WarehouseDetail,
  WarehouseRequest,
} from './api'

const idFrom = (request: Request, fromEnd = 1) => new URL(request.url).pathname.split('/').at(-fromEnd)!

const branchName = (d: MockDb, id: string) => d.branches.find((b) => b.branchId === id)?.name ?? '—'

function toBranch(d: MockDb, b: MockDb['branches'][number]): Branch {
  return { ...b, warehouseCount: d.warehouses.filter((w) => w.branchId === b.branchId).length }
}

function toWarehouse(d: MockDb, w: WarehouseRec): WarehouseDetail {
  return {
    ...w,
    branchName: branchName(d, w.branchId),
    productsWithStock: d.stocks.filter((s) => s.warehouseId === w.warehouseId && s.quantity > 0).length,
  }
}

function toSeries(d: MockDb, s: MockDb['documentSeries'][number]): DocumentSeries {
  return { ...s, branchName: branchName(d, s.branchId) }
}

const CODE = /^[A-Z0-9]{2,10}$/

export const settingsHandlers = [
  http.get(api('/company'), handle(async ({ user }) => (await context(user)).d.company)),

  http.put(
    api('/company'),
    handle(async ({ request, user }) => {
      const { d } = await context(user)
      const body = (await request.json()) as CompanyRequest
      if (!/^\d{11}$/.test(body.ruc ?? '')) throw badRequest('El RUC debe tener 11 dígitos.')
      if (!body.businessName?.trim()) throw badRequest('La razón social es obligatoria.')
      d.company = { ...d.company!, ...body }
      save()
      return d.company
    }),
  ),

  http.get(api('/branches'), handle(async ({ user }) => {
    const { d } = await context(user)
    return d.branches.map((b) => toBranch(d, b))
  })),

  ...(['post', 'put'] as const).map((method) =>
    http[method](
      api(method === 'post' ? '/branches' : '/branches/:id'),
      handle(async ({ request, user }) => {
        const { d } = await context(user)
        const body = (await request.json()) as BranchRequest
        const id = method === 'put' ? idFrom(request) : undefined
        if (!CODE.test(body.code ?? '')) throw badRequest('El código va en mayúsculas, de 2 a 10 caracteres.')
        if (!body.name?.trim()) throw badRequest('El nombre es obligatorio.')
        if (d.branches.some((b) => b.code === body.code && b.branchId !== id)) throw badRequest('Ya existe una sucursal con ese código.')
        if (id) {
          const branch = d.branches.find((b) => b.branchId === id)
          if (!branch) throw notFound('Sucursal')
          if (!body.isActive && d.warehouses.some((w) => w.branchId === id && w.isActive)) {
            throw badRequest('Desactiva primero los almacenes de esta sucursal.')
          }
          Object.assign(branch, body)
          save()
          return toBranch(d, branch)
        }
        const branch = { ...body, branchId: newId(), createdAt: new Date().toISOString() }
        d.branches.push(branch)
        save()
        return toBranch(d, branch)
      }, method === 'post' ? 201 : 200),
    ),
  ),

  // GET /warehouses?detail=true: vista de administración. Sin `detail`, sigue respondiendo el handler de inventario.
  http.get(api('/warehouses'), async (info) => {
    if (new URL(info.request.url).searchParams.get('detail') !== 'true') return undefined
    return handle(async ({ user }) => {
      const { d } = await context(user)
      return d.warehouses.map((w) => toWarehouse(d, w))
    })(info)
  }),

  ...(['post', 'put'] as const).map((method) =>
    http[method](
      api(method === 'post' ? '/warehouses' : '/warehouses/:id'),
      handle(async ({ request, user }) => {
        const { d } = await context(user)
        const body = (await request.json()) as WarehouseRequest
        const id = method === 'put' ? idFrom(request) : undefined
        if (!CODE.test(body.code ?? '')) throw badRequest('El código va en mayúsculas, de 2 a 10 caracteres.')
        if (!body.name?.trim()) throw badRequest('El nombre es obligatorio.')
        if (!d.branches.some((b) => b.branchId === body.branchId)) throw notFound('Sucursal')
        if (d.warehouses.some((w) => w.code === body.code && w.warehouseId !== id)) throw badRequest('Ya existe un almacén con ese código.')
        if (id) {
          const w = d.warehouses.find((x) => x.warehouseId === id)
          if (!w) throw notFound('Almacén')
          if (!body.isActive && d.stocks.some((s) => s.warehouseId === id && s.quantity > 0)) {
            throw badRequest('No se puede desactivar un almacén con stock. Transfiérelo primero.')
          }
          Object.assign(w, body)
          save()
          return toWarehouse(d, w)
        }
        const w: WarehouseRec = { ...body, warehouseId: newId() }
        d.warehouses.push(w)
        save()
        return toWarehouse(d, w)
      }, method === 'post' ? 201 : 200),
    ),
  ),

  http.get(api('/document-series'), handle(async ({ user }) => {
    const { d } = await context(user)
    return d.documentSeries.map((s) => toSeries(d, s))
  })),

  http.post(
    api('/document-series'),
    handle(async ({ request, user }) => {
      const { d } = await context(user)
      const body = (await request.json()) as DocumentSeriesRequest
      const prefix = body.documentType === 'FACTURA' ? 'F' : 'B'
      // Igual que el CHECK `document_series_series_format_check`.
      if (!new RegExp(`^${prefix}[0-9A-Z]{3}$`).test(body.series ?? '')) {
        throw badRequest(`La serie de ${body.documentType.toLowerCase()} empieza con ${prefix} y tiene 4 caracteres (ej. ${prefix}002).`)
      }
      if (d.documentSeries.some((s) => s.series === body.series)) throw badRequest('Esa serie ya existe.')
      if (!d.branches.some((b) => b.branchId === body.branchId)) throw notFound('Sucursal')
      const s = { ...body, documentSeriesId: newId(), currentNumber: 0, isActive: true }
      d.documentSeries.push(s)
      save()
      return toSeries(d, s)
    }, 201),
  ),

  http.put(
    api('/document-series/:id'),
    handle(async ({ request, user }) => {
      const { d } = await context(user)
      const s = d.documentSeries.find((x) => x.documentSeriesId === idFrom(request))
      if (!s) throw notFound('Serie')
      const { isActive } = (await request.json()) as { isActive: boolean }
      if (!isActive && !d.documentSeries.some((x) => x !== s && x.documentType === s.documentType && x.isActive)) {
        throw badRequest(`Debe quedar al menos una serie activa de ${s.documentType.toLowerCase()}.`)
      }
      s.isActive = isActive
      save()
      return toSeries(d, s)
    }),
  ),

  // GET /payment-methods?all=true: incluye inactivos (administración). Sin `all` responde el handler de ventas.
  http.get(api('/payment-methods'), async (info) => {
    if (new URL(info.request.url).searchParams.get('all') !== 'true') return undefined
    return handle(async ({ user }) => (await context(user)).d.paymentMethods)(info)
  }),

  http.put(
    api('/payment-methods/:id'),
    handle(async ({ request, user }) => {
      const { d } = await context(user)
      const m = d.paymentMethods.find((x) => x.paymentMethodId === idFrom(request))
      if (!m) throw notFound('Método de pago')
      const body = (await request.json()) as { name: string; isActive: boolean }
      if (!body.name?.trim()) throw badRequest('El nombre es obligatorio.')
      if (m.code === 'CASH' && !body.isActive) throw badRequest('El efectivo no se puede desactivar: es el único que admite vuelto.')
      Object.assign(m, { name: body.name.trim(), isActive: body.isActive })
      save()
      return m
    }),
  ),

  http.get(
    api('/emails'),
    handle(async ({ request, user }) => {
      const { d } = await context(user)
      processOutbox(d)
      const q = query(request)
      const status = q.str('status')
      const template = q.str('template')
      const search = q.str('search')
      const rows = d.emails
        .filter((e) => (!status || e.status === status) && (!template || e.template === template) && (contains(e.toEmail, search) || contains(e.subject, search)))
        .slice()
        .reverse()
      return paginate(rows, q.int('page', 1), q.int('pageSize', 20))
    }),
  ),

  http.post(
    api('/emails/:id/retry'),
    handle(async ({ request, user }) => {
      const { d } = await context(user)
      const e = d.emails.find((x) => x.emailOutboxId === idFrom(request, 2))
      if (!e) throw notFound('Correo')
      if (e.status === 'SENT') throw badRequest('El correo ya se envió.')
      // Se reencola: el "BackgroundService" lo vuelve a intentar en unos segundos.
      Object.assign(e, { status: 'PENDING', attempts: 0, lastError: null, createdAt: new Date().toISOString() })
      save()
      return e
    }),
  ),

  // El backend aún no tiene este endpoint: se simula la validación básica.
  http.post(
    api('/auth/change-password'),
    handle(async ({ request }) => {
      const body = (await request.json()) as { currentPassword: string; newPassword: string }
      if (!body.currentPassword) throw badRequest('Ingresa tu contraseña actual.')
      if ((body.newPassword ?? '').length < 8) throw badRequest('La nueva contraseña debe tener al menos 8 caracteres.')
      if (body.newPassword === body.currentPassword) throw badRequest('La nueva contraseña debe ser distinta de la actual.')
      return undefined
    }),
  ),
]
