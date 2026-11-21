/**
 * Contrato del módulo de ventas (aún sin backend: en desarrollo responde MSW, ver ./mocks.ts).
 * Regla 6: la venta valida stock, calcula IGV (precios con IGV incluido), descuenta stock,
 * genera comprobante con serie y correlativo y registra los pagos.
 * Regla 7: la FACTURA exige cliente con RUC; la BOLETA acepta DNI o "CLIENTES VARIOS".
 */
import { http } from '@/api/http'
import type { Guid, IsoDate, PagedResult, PageParams } from '@/api/types'

export type CustomerDocumentType = 'DNI' | 'RUC' | 'CE' | 'PASSPORT'
export type InvoiceType = 'BOLETA' | 'FACTURA'

export interface Customer {
  customerId: Guid
  documentType: CustomerDocumentType
  documentNumber: string
  fullName: string
  email: string | null
  phone: string | null
  address: string | null
  isActive: boolean
  createdAt: IsoDate
}

export interface CustomerRequest {
  documentType: CustomerDocumentType
  documentNumber: string
  fullName: string
  email: string | null
  phone: string | null
  address: string | null
}

export interface PaymentMethod {
  paymentMethodId: Guid
  /** CASH, CARD, YAPE, PLIN, TRANSFER */
  code: string
  name: string
  isActive: boolean
}

export interface CreateSaleRequest {
  warehouseId: Guid
  customerId: Guid
  documentType: InvoiceType
  notes: string | null
  /** El precio lo pone el backend (precio vigente); el front solo manda cantidad y descuento. */
  items: { productId: Guid; quantity: number; discount: number }[]
  /** En efectivo se puede pagar de más: el backend registra el monto exacto y devuelve el vuelto. */
  payments: { paymentMethodId: Guid; amount: number; reference: string | null }[]
}

export type SaleStatus = 'COMPLETED' | 'CANCELLED'

export interface SaleSummary {
  saleId: Guid
  fullNumber: string
  documentType: InvoiceType
  customerName: string
  customerDocumentType: CustomerDocumentType
  customerDocumentNumber: string
  sellerName: string
  status: SaleStatus
  itemCount: number
  total: number
  paymentMethods: string[]
  soldAt: IsoDate
}

export interface SaleDetail extends SaleSummary {
  warehouseId: Guid
  warehouseName: string
  /** Base imponible (sin IGV). */
  subtotal: number
  discountTotal: number
  taxAmount: number
  notes: string | null
  cancelledAt: IsoDate | null
  cancelReason: string | null
  /** Vuelto entregado (solo en la respuesta de creación; 0 en consultas posteriores). */
  change: number
  items: {
    productId: Guid
    sku: string
    productName: string
    unitCode: string
    quantity: number
    unitPrice: number
    discount: number
    taxRate: number
    taxAmount: number
    lineTotal: number
  }[]
  payments: { paymentMethodId: Guid; methodName: string; amount: number; reference: string | null; paidAt: IsoDate }[]
}

export interface SaleFilters extends PageParams {
  status?: SaleStatus
  documentType?: InvoiceType
  from?: string
  to?: string
}

const clean = <T extends object>(params: T) =>
  Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== ''))

export const customersApi = {
  list: (params: PageParams & { isActive?: boolean }) =>
    http.get<PagedResult<Customer>>('/customers', { params: clean(params) }).then((r) => r.data),
  create: (body: CustomerRequest) => http.post<Customer>('/customers', body).then((r) => r.data),
  update: (id: Guid, body: CustomerRequest & { isActive: boolean }) =>
    http.put<Customer>(`/customers/${id}`, body).then((r) => r.data),
}

export const salesApi = {
  paymentMethods: () => http.get<PaymentMethod[]>('/payment-methods').then((r) => r.data),
  list: (filters: SaleFilters) => http.get<PagedResult<SaleSummary>>('/sales', { params: clean(filters) }).then((r) => r.data),
  get: (id: Guid) => http.get<SaleDetail>(`/sales/${id}`).then((r) => r.data),
  create: (body: CreateSaleRequest) => http.post<SaleDetail>('/sales', body).then((r) => r.data),
  cancel: (id: Guid, reason: string) => http.post<SaleDetail>(`/sales/${id}/cancel`, { reason }).then((r) => r.data),
}
