/**
 * Contrato del módulo de inventario.
 * El backend aún no lo implementa: en desarrollo responde MSW (ver ./mocks.ts).
 * Estos tipos son la especificación que deben cumplir los DTO de .NET.
 */
import { http } from '@/api/http'
import type { Guid, IsoDate, PagedResult, PageParams } from '@/api/types'

export interface Warehouse {
  warehouseId: Guid
  code: string
  name: string
  address: string | null
  isActive: boolean
}

export type StockStatus = 'OK' | 'LOW' | 'OUT'

/** GET /stocks — una fila por producto en el almacén pedido (0 si no tiene stock). */
export interface StockItem {
  productId: Guid
  sku: string
  productName: string
  unitCode: string
  categoryName: string
  warehouseId: Guid
  quantity: number
  minStock: number
  maxStock: number | null
  averageCost: number
  /** quantity × averageCost */
  stockValue: number
  status: StockStatus
}

export interface StockFilters extends PageParams {
  warehouseId: Guid
  status?: StockStatus
}

export interface StockSummary {
  productCount: number
  totalUnits: number
  totalValue: number
  lowCount: number
  outCount: number
}

export type MovementCode =
  | 'INITIAL'
  | 'PURCHASE_IN'
  | 'SALE_OUT'
  | 'TRANSFER_IN'
  | 'TRANSFER_OUT'
  | 'ADJUST_IN'
  | 'ADJUST_OUT'
  | 'SALE_CANCEL_IN'

/** GET /inventory/movements — una fila del kardex (`inventory_movements`). */
export interface Movement {
  inventoryMovementId: Guid
  productId: Guid
  productName: string
  sku: string
  warehouseId: Guid
  warehouseCode: string
  movementTypeCode: MovementCode
  movementTypeName: string
  /** 1 entrada, -1 salida (`movement_types.direction`). */
  direction: 1 | -1
  quantity: number
  unitCost: number
  balanceAfter: number
  averageCostAfter: number
  referenceType: 'PURCHASE_ORDER' | 'SALE' | 'TRANSFER' | 'ADJUSTMENT' | 'INITIAL' | null
  referenceId: Guid | null
  /** Código legible del documento: OC-000012, B001-00000045, TR-000003… */
  referenceCode: string | null
  notes: string | null
  createdByName: string
  createdAt: IsoDate
}

export interface MovementFilters extends PageParams {
  productId?: Guid
  warehouseId?: Guid
  type?: MovementCode
  /** YYYY-MM-DD inclusive */
  from?: string
  to?: string
}

export interface AdjustmentRequest {
  productId: Guid
  warehouseId: Guid
  type: 'ADJUST_IN' | 'ADJUST_OUT'
  quantity: number
  /** Solo en ingresos: costo unitario sin IGV. Vacío = costo promedio actual. */
  unitCost: number | null
  reason: string
}

export type TransferStatus = 'PENDING' | 'COMPLETED' | 'CANCELLED'

export interface TransferSummary {
  transferId: Guid
  code: string
  originWarehouseId: Guid
  originWarehouseName: string
  destinationWarehouseId: Guid
  destinationWarehouseName: string
  status: TransferStatus
  itemCount: number
  totalQuantity: number
  notes: string | null
  requestedByName: string
  completedByName: string | null
  createdAt: IsoDate
  completedAt: IsoDate | null
}

export interface TransferDetail extends TransferSummary {
  items: {
    productId: Guid
    sku: string
    productName: string
    unitCode: string
    quantity: number
    /** Stock actual en el almacén de origen, para avisar antes de completar. */
    availableAtOrigin: number
  }[]
}

export interface CreateTransferRequest {
  originWarehouseId: Guid
  destinationWarehouseId: Guid
  notes: string | null
  items: { productId: Guid; quantity: number }[]
}

const clean = <T extends object>(params: T) =>
  Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== ''))

export const inventoryApi = {
  warehouses: () => http.get<Warehouse[]>('/warehouses').then((r) => r.data),

  stocks: (filters: StockFilters) =>
    http.get<PagedResult<StockItem>>('/stocks', { params: clean(filters) }).then((r) => r.data),
  stockSummary: (warehouseId: Guid) =>
    http.get<StockSummary>('/stocks/summary', { params: { warehouseId } }).then((r) => r.data),

  movements: (filters: MovementFilters) =>
    http.get<PagedResult<Movement>>('/inventory/movements', { params: clean(filters) }).then((r) => r.data),
  adjust: (body: AdjustmentRequest) => http.post<Movement>('/inventory/adjustments', body).then((r) => r.data),

  transfers: (params: PageParams & { status?: TransferStatus }) =>
    http.get<PagedResult<TransferSummary>>('/transfers', { params: clean(params) }).then((r) => r.data),
  transfer: (id: Guid) => http.get<TransferDetail>(`/transfers/${id}`).then((r) => r.data),
  createTransfer: (body: CreateTransferRequest) => http.post<TransferDetail>('/transfers', body).then((r) => r.data),
  completeTransfer: (id: Guid) => http.post<TransferDetail>(`/transfers/${id}/complete`).then((r) => r.data),
  cancelTransfer: (id: Guid) => http.post<TransferDetail>(`/transfers/${id}/cancel`).then((r) => r.data),
}
