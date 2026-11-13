/**
 * Contrato del módulo de compras (aún sin backend: en desarrollo responde MSW, ver ./mocks.ts).
 * Flujo de la orden: DRAFT → APPROVED → RECEIVED, o CANCELLED antes de recibir.
 */
import { http } from '@/api/http'
import type { Guid, IsoDate, PagedResult, PageParams } from '@/api/types'

export interface Supplier {
  supplierId: Guid
  ruc: string
  businessName: string
  contactName: string | null
  email: string | null
  phone: string | null
  address: string | null
  isActive: boolean
  createdAt: IsoDate
}

export interface SupplierRequest {
  ruc: string
  businessName: string
  contactName: string | null
  email: string | null
  phone: string | null
  address: string | null
}

export type PurchaseStatus = 'DRAFT' | 'APPROVED' | 'RECEIVED' | 'CANCELLED'

export interface PurchaseOrderSummary {
  purchaseOrderId: Guid
  code: string
  supplierId: Guid
  supplierName: string
  warehouseId: Guid
  warehouseName: string
  status: PurchaseStatus
  /** YYYY-MM-DD */
  orderDate: string
  expectedDate: string | null
  /** Montos sin IGV / IGV / total. */
  subtotal: number
  taxAmount: number
  total: number
  itemCount: number
  createdByName: string
  createdAt: IsoDate
}

export interface PurchaseOrderDetail extends PurchaseOrderSummary {
  supplierRuc: string
  notes: string | null
  approvedByName: string | null
  approvedAt: IsoDate | null
  receivedAt: IsoDate | null
  items: {
    productId: Guid
    sku: string
    productName: string
    unitCode: string
    quantity: number
    /** Costo unitario sin IGV. */
    unitCost: number
    subtotal: number
  }[]
}

export interface PurchaseOrderRequest {
  supplierId: Guid
  warehouseId: Guid
  expectedDate: string | null
  notes: string | null
  items: { productId: Guid; quantity: number; unitCost: number }[]
}

export interface PurchaseOrderFilters extends PageParams {
  status?: PurchaseStatus
  supplierId?: Guid
}

const clean = <T extends object>(params: T) =>
  Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== ''))

export const suppliersApi = {
  list: (params: PageParams & { isActive?: boolean }) =>
    http.get<PagedResult<Supplier>>('/suppliers', { params: clean(params) }).then((r) => r.data),
  create: (body: SupplierRequest) => http.post<Supplier>('/suppliers', body).then((r) => r.data),
  update: (id: Guid, body: SupplierRequest & { isActive: boolean }) =>
    http.put<Supplier>(`/suppliers/${id}`, body).then((r) => r.data),
}

export const purchaseOrdersApi = {
  list: (filters: PurchaseOrderFilters) =>
    http.get<PagedResult<PurchaseOrderSummary>>('/purchase-orders', { params: clean(filters) }).then((r) => r.data),
  get: (id: Guid) => http.get<PurchaseOrderDetail>(`/purchase-orders/${id}`).then((r) => r.data),
  create: (body: PurchaseOrderRequest) => http.post<PurchaseOrderDetail>('/purchase-orders', body).then((r) => r.data),
  update: (id: Guid, body: PurchaseOrderRequest) =>
    http.put<PurchaseOrderDetail>(`/purchase-orders/${id}`, body).then((r) => r.data),
  approve: (id: Guid) => http.post<PurchaseOrderDetail>(`/purchase-orders/${id}/approve`).then((r) => r.data),
  receive: (id: Guid) => http.post<PurchaseOrderDetail>(`/purchase-orders/${id}/receive`).then((r) => r.data),
  cancel: (id: Guid) => http.post<PurchaseOrderDetail>(`/purchase-orders/${id}/cancel`).then((r) => r.data),
}
