/**
 * Contrato de configuración: empresa, sucursales, almacenes, series de comprobantes,
 * métodos de pago, bandeja de correos y cambio de contraseña.
 * Aún sin backend: en desarrollo responde MSW (ver ./mocks.ts).
 */
import { http } from '@/api/http'
import type { Guid, IsoDate, PagedResult, PageParams } from '@/api/types'

export interface Company {
  companyId: Guid
  ruc: string
  businessName: string
  tradeName: string | null
  address: string | null
  phone: string | null
  email: string | null
  logoUrl: string | null
}

export type CompanyRequest = Omit<Company, 'companyId'>

export interface Branch {
  branchId: Guid
  code: string
  name: string
  address: string | null
  phone: string | null
  isActive: boolean
  warehouseCount: number
  createdAt: IsoDate
}

export interface BranchRequest {
  code: string
  name: string
  address: string | null
  phone: string | null
  isActive: boolean
}

export interface WarehouseDetail {
  warehouseId: Guid
  branchId: Guid
  branchName: string
  code: string
  name: string
  address: string | null
  isActive: boolean
  /** Productos con stock > 0 en este almacén (no se puede desactivar si tiene stock). */
  productsWithStock: number
}

export interface WarehouseRequest {
  branchId: Guid
  code: string
  name: string
  address: string | null
  isActive: boolean
}

export interface DocumentSeries {
  documentSeriesId: Guid
  branchId: Guid
  branchName: string
  documentType: 'BOLETA' | 'FACTURA'
  /** B001, F001… (formato validado por CHECK en la BD) */
  series: string
  currentNumber: number
  isActive: boolean
}

export interface DocumentSeriesRequest {
  branchId: Guid
  documentType: 'BOLETA' | 'FACTURA'
  series: string
}

export interface PaymentMethodAdmin {
  paymentMethodId: Guid
  code: string
  name: string
  isActive: boolean
}

export type EmailStatus = 'PENDING' | 'SENT' | 'FAILED'
export type EmailTemplate = 'WELCOME' | 'INVOICE' | 'STOCK_ALERT' | 'PASSWORD_RESET'

export interface OutboxEmail {
  emailOutboxId: Guid
  toEmail: string
  subject: string
  htmlBody: string
  template: EmailTemplate
  status: EmailStatus
  attempts: number
  lastError: string | null
  createdAt: IsoDate
  sentAt: IsoDate | null
}

export interface EmailFilters extends PageParams {
  status?: EmailStatus
  template?: EmailTemplate
}

export interface ChangePasswordRequest {
  currentPassword: string
  newPassword: string
}

const clean = <T extends object>(params: T) =>
  Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== ''))

export const settingsApi = {
  company: () => http.get<Company>('/company').then((r) => r.data),
  updateCompany: (body: CompanyRequest) => http.put<Company>('/company', body).then((r) => r.data),

  branches: () => http.get<Branch[]>('/branches').then((r) => r.data),
  saveBranch: (id: Guid | undefined, body: BranchRequest) =>
    (id ? http.put<Branch>(`/branches/${id}`, body) : http.post<Branch>('/branches', body)).then((r) => r.data),

  /** Vista de administración (incluye inactivos, sucursal y stock). La lista simple vive en inventario. */
  warehouses: () => http.get<WarehouseDetail[]>('/warehouses', { params: { detail: true } }).then((r) => r.data),
  saveWarehouse: (id: Guid | undefined, body: WarehouseRequest) =>
    (id ? http.put<WarehouseDetail>(`/warehouses/${id}`, body) : http.post<WarehouseDetail>('/warehouses', body)).then((r) => r.data),

  documentSeries: () => http.get<DocumentSeries[]>('/document-series').then((r) => r.data),
  createSeries: (body: DocumentSeriesRequest) => http.post<DocumentSeries>('/document-series', body).then((r) => r.data),
  setSeriesActive: (id: Guid, isActive: boolean) =>
    http.put<DocumentSeries>(`/document-series/${id}`, { isActive }).then((r) => r.data),

  paymentMethods: () => http.get<PaymentMethodAdmin[]>('/payment-methods', { params: { all: true } }).then((r) => r.data),
  updatePaymentMethod: (id: Guid, body: { name: string; isActive: boolean }) =>
    http.put<PaymentMethodAdmin>(`/payment-methods/${id}`, body).then((r) => r.data),

  emails: (filters: EmailFilters) =>
    http.get<PagedResult<OutboxEmail>>('/emails', { params: clean(filters) }).then((r) => r.data),
  retryEmail: (id: Guid) => http.post<OutboxEmail>(`/emails/${id}/retry`).then((r) => r.data),

  changePassword: (body: ChangePasswordRequest) => http.post<void>('/auth/change-password', body).then(() => undefined),
}
