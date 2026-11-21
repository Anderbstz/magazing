/**
 * Base de datos simulada (solo desarrollo).
 *
 * Imita las tablas de `01_schema.sql` que todavía no tienen endpoint y aplica las mismas reglas
 * de negocio del MVP, para que el frontend se pueda terminar antes que el backend:
 *   1. El kardex es la verdad: cada entrada/salida crea un movimiento y actualiza el stock.
 *   2. Costo promedio ponderado al recibir compras.
 *   3. No hay stock negativo.
 *   6. Venta: IGV incluido en el precio, correlativo por serie, pagos.
 *   7. FACTURA exige RUC.
 *   8. Transferencias: TRANSFER_OUT en origen y TRANSFER_IN en destino.
 *   9. Ajustes con motivo obligatorio.
 *  11. Predicción semanal y alertas de stock.
 *
 * Los productos vienen del backend real (ver catalog-bridge.ts). El estado se guarda en
 * localStorage, así que sobrevive a recargas; "Reiniciar datos simulados" lo regenera.
 */
import type { Product } from '@/features/catalog/api'
import { calculateLine, calculatePurchase, calculateSale, round2 } from '@/lib/tax'
import { badRequest, newId, notFound, seededRandom, type MockUser } from './utils'

// ── Tablas ───────────────────────────────────────────────────────────────────

export interface CompanyRec {
  companyId: string
  ruc: string
  businessName: string
  tradeName: string | null
  address: string | null
  phone: string | null
  email: string | null
  logoUrl: string | null
}

export interface BranchRec {
  branchId: string
  code: string
  name: string
  address: string | null
  phone: string | null
  isActive: boolean
  createdAt: string
}

export type EmailStatus = 'PENDING' | 'SENT' | 'FAILED'
export type EmailTemplate = 'WELCOME' | 'INVOICE' | 'STOCK_ALERT' | 'PASSWORD_RESET'

/** `email_outbox`: el BackgroundService del backend los envía con Resend y reintenta. */
export interface EmailRec {
  emailOutboxId: string
  toEmail: string
  subject: string
  htmlBody: string
  template: EmailTemplate
  status: EmailStatus
  attempts: number
  lastError: string | null
  createdAt: string
  sentAt: string | null
}

export interface WarehouseRec {
  warehouseId: string
  branchId: string
  code: string
  name: string
  address: string | null
  isActive: boolean
}

export interface StockRec {
  productId: string
  warehouseId: string
  quantity: number
  updatedAt: string
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

export type ReferenceType = 'PURCHASE_ORDER' | 'SALE' | 'TRANSFER' | 'ADJUSTMENT' | 'INITIAL'

export const MOVEMENT_TYPES: Record<MovementCode, { name: string; direction: 1 | -1 }> = {
  INITIAL: { name: 'Saldo inicial', direction: 1 },
  PURCHASE_IN: { name: 'Ingreso por compra', direction: 1 },
  SALE_OUT: { name: 'Salida por venta', direction: -1 },
  TRANSFER_IN: { name: 'Ingreso por transferencia', direction: 1 },
  TRANSFER_OUT: { name: 'Salida por transferencia', direction: -1 },
  ADJUST_IN: { name: 'Ajuste positivo', direction: 1 },
  ADJUST_OUT: { name: 'Ajuste negativo', direction: -1 },
  SALE_CANCEL_IN: { name: 'Reingreso por anulación de venta', direction: 1 },
}

export interface MovementRec {
  inventoryMovementId: string
  productId: string
  warehouseId: string
  movementTypeCode: MovementCode
  quantity: number
  unitCost: number
  balanceAfter: number
  averageCostAfter: number
  referenceType: ReferenceType | null
  referenceId: string | null
  referenceCode: string | null
  notes: string | null
  createdByName: string
  createdAt: string
}

export interface SupplierRec {
  supplierId: string
  ruc: string
  businessName: string
  contactName: string | null
  email: string | null
  phone: string | null
  address: string | null
  isActive: boolean
  createdAt: string
}

export type PurchaseStatus = 'DRAFT' | 'APPROVED' | 'RECEIVED' | 'CANCELLED'

export interface PurchaseOrderRec {
  purchaseOrderId: string
  code: string
  supplierId: string
  warehouseId: string
  status: PurchaseStatus
  orderDate: string
  expectedDate: string | null
  subtotal: number
  taxAmount: number
  total: number
  notes: string | null
  createdByName: string
  approvedByName: string | null
  approvedAt: string | null
  receivedAt: string | null
  createdAt: string
  items: { productId: string; quantity: number; unitCost: number; subtotal: number }[]
}

export type TransferStatus = 'PENDING' | 'COMPLETED' | 'CANCELLED'

export interface TransferRec {
  transferId: string
  code: string
  originWarehouseId: string
  destinationWarehouseId: string
  status: TransferStatus
  notes: string | null
  requestedByName: string
  completedByName: string | null
  completedAt: string | null
  createdAt: string
  items: { productId: string; quantity: number }[]
}

export type DocumentType = 'DNI' | 'RUC' | 'CE' | 'PASSPORT'

export interface CustomerRec {
  customerId: string
  documentType: DocumentType
  documentNumber: string
  fullName: string
  email: string | null
  phone: string | null
  address: string | null
  isActive: boolean
  createdAt: string
}

export interface PaymentMethodRec {
  paymentMethodId: string
  code: string
  name: string
  isActive: boolean
}

export type InvoiceType = 'BOLETA' | 'FACTURA'

export interface DocumentSeriesRec {
  documentSeriesId: string
  branchId: string
  documentType: InvoiceType
  series: string
  currentNumber: number
  isActive: boolean
}

export interface SaleItemRec {
  productId: string
  productName: string
  sku: string
  unitCode: string
  quantity: number
  unitPrice: number
  discount: number
  taxRate: number
  taxAmount: number
  unitCost: number
  lineTotal: number
}

export interface PaymentRec {
  paymentId: string
  paymentMethodId: string
  amount: number
  reference: string | null
  paidAt: string
}

export interface InvoiceRec {
  invoiceId: string
  documentType: InvoiceType
  series: string
  number: number
  fullNumber: string
  customerDocumentType: DocumentType
  customerDocumentNumber: string
  customerName: string
  subtotal: number
  taxAmount: number
  total: number
  status: 'ISSUED' | 'CANCELLED'
  issuedAt: string
}

export interface SaleRec {
  saleId: string
  warehouseId: string
  customerId: string
  sellerName: string
  status: 'COMPLETED' | 'CANCELLED'
  subtotal: number
  discountTotal: number
  taxAmount: number
  total: number
  notes: string | null
  soldAt: string
  cancelledAt: string | null
  cancelReason: string | null
  items: SaleItemRec[]
  payments: PaymentRec[]
  invoice: InvoiceRec
}

export type AlertType = 'LOW_STOCK' | 'PREDICTED_SHORTAGE'
export type AlertStatus = 'OPEN' | 'ACKNOWLEDGED' | 'RESOLVED'

export interface AlertRec {
  stockAlertId: string
  productId: string
  warehouseId: string
  alertType: AlertType
  currentStock: number
  threshold: number
  suggestedOrderQty: number | null
  status: AlertStatus
  createdAt: string
  resolvedAt: string | null
  resolvedByName: string | null
}

export interface MockDb {
  version: number
  company: CompanyRec | null
  branches: BranchRec[]
  emails: EmailRec[]
  warehouses: WarehouseRec[]
  stocks: StockRec[]
  /** `products.average_cost` simulado: el real no cambia porque las compras no llegan al backend. */
  productCosts: Record<string, number>
  movements: MovementRec[]
  suppliers: SupplierRec[]
  purchaseOrders: PurchaseOrderRec[]
  transfers: TransferRec[]
  customers: CustomerRec[]
  paymentMethods: PaymentMethodRec[]
  documentSeries: DocumentSeriesRec[]
  sales: SaleRec[]
  alerts: AlertRec[]
  counters: { purchaseOrder: number; transfer: number }
  seededProducts: string[]
}

// ── Persistencia ─────────────────────────────────────────────────────────────

const STORAGE_KEY = 'magazing.mockdb'
// v2: empresa, sucursales y bandeja de correos. Subir la versión regenera los datos.
const VERSION = 2

let db: MockDb | null = null
/** Mientras se siembra el historial no se guarda en cada operación (serían cientos de escrituras). */
let suspendSave = false

function emptyDb(): MockDb {
  return {
    version: VERSION,
    company: null,
    branches: [],
    emails: [],
    warehouses: [],
    stocks: [],
    productCosts: {},
    movements: [],
    suppliers: [],
    purchaseOrders: [],
    transfers: [],
    customers: [],
    paymentMethods: [],
    documentSeries: [],
    sales: [],
    alerts: [],
    counters: { purchaseOrder: 0, transfer: 0 },
    seededProducts: [],
  }
}

function load(): MockDb {
  if (db) return db
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const parsed = raw ? (JSON.parse(raw) as MockDb) : null
    db = parsed?.version === VERSION ? parsed : emptyDb()
  } catch {
    db = emptyDb()
  }
  return db
}

export function save() {
  if (suspendSave) return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(load()))
  } catch {
    // Sin almacenamiento: los datos duran lo que dure la pestaña.
  }
}

export function resetDb() {
  db = emptyDb()
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    /* nada */
  }
}

/** Devuelve la BD con todos los productos reales ya sembrados. */
export function getDb(products: Product[]): MockDb {
  const d = load()
  if (d.warehouses.length === 0) seedStatic(d)
  const pending = products.filter((p) => !d.seededProducts.includes(p.productId))
  if (pending.length > 0) {
    // Primera vez: historial completo. Productos creados después: solo costo, sin stock.
    if (d.seededProducts.length === 0) {
      suspendSave = true
      try {
        seedHistory(d, pending)
      } finally {
        suspendSave = false
      }
    } else for (const p of pending) d.productCosts[p.productId] = p.averageCost
    d.seededProducts.push(...pending.map((p) => p.productId))
    save()
  }
  return d
}

// ── Helpers de consulta ──────────────────────────────────────────────────────

export const stockOf = (d: MockDb, productId: string, warehouseId: string) =>
  d.stocks.find((s) => s.productId === productId && s.warehouseId === warehouseId)?.quantity ?? 0

export const totalStock = (d: MockDb, productId: string) =>
  round3(d.stocks.filter((s) => s.productId === productId).reduce((sum, s) => sum + s.quantity, 0))

export const averageCost = (d: MockDb, productId: string) => d.productCosts[productId] ?? 0

export const round3 = (n: number) => Math.round((n + Number.EPSILON) * 1000) / 1000
const round4 = (n: number) => Math.round((n + Number.EPSILON) * 10000) / 10000

export function requireWarehouse(d: MockDb, id: string) {
  const w = d.warehouses.find((x) => x.warehouseId === id)
  if (!w) throw notFound('Almacén')
  return w
}

export function requireProduct(products: Map<string, Product>, id: string) {
  const p = products.get(id)
  if (!p) throw notFound('Producto')
  return p
}

// ── Regla 1, 2 y 3: kardex, costo promedio y stock no negativo ──────────────

interface MovementInput {
  productId: string
  warehouseId: string
  code: MovementCode
  quantity: number
  /** Costo unitario sin IGV. En salidas se ignora y se usa el costo promedio vigente. */
  unitCost?: number
  referenceType: ReferenceType
  referenceId: string | null
  referenceCode: string | null
  notes?: string | null
  userName: string
  at: string
  productName?: string
}

export function applyMovement(d: MockDb, input: MovementInput): MovementRec {
  if (!(input.quantity > 0)) throw badRequest('La cantidad debe ser mayor a cero.')
  const { direction } = MOVEMENT_TYPES[input.code]
  const current = stockOf(d, input.productId, input.warehouseId)
  const total = totalStock(d, input.productId)
  let avg = averageCost(d, input.productId)

  const balance = round3(current + direction * input.quantity)
  if (balance < 0) {
    throw badRequest(
      `Stock insuficiente${input.productName ? ` de ${input.productName}` : ''}: hay ${current} y se piden ${input.quantity}.`,
    )
  }

  let unitCost = avg
  // Las entradas con costo propio recalculan el promedio ponderado (sobre el stock de todos los almacenes).
  // Las transferencias no cambian el costo: la mercadería es la misma.
  const recalculates = input.code === 'INITIAL' || input.code === 'PURCHASE_IN' || input.code === 'ADJUST_IN' || input.code === 'SALE_CANCEL_IN'
  if (direction === 1 && recalculates && input.unitCost !== undefined) {
    unitCost = input.unitCost
    avg = total + input.quantity === 0 ? unitCost : (total * avg + input.quantity * unitCost) / (total + input.quantity)
    d.productCosts[input.productId] = round4(avg)
  }

  const stock = d.stocks.find((s) => s.productId === input.productId && s.warehouseId === input.warehouseId)
  if (stock) {
    stock.quantity = balance
    stock.updatedAt = input.at
  } else {
    d.stocks.push({ productId: input.productId, warehouseId: input.warehouseId, quantity: balance, updatedAt: input.at })
  }

  const movement: MovementRec = {
    inventoryMovementId: newId(),
    productId: input.productId,
    warehouseId: input.warehouseId,
    movementTypeCode: input.code,
    quantity: input.quantity,
    unitCost: round4(unitCost),
    balanceAfter: balance,
    averageCostAfter: round4(averageCost(d, input.productId)),
    referenceType: input.referenceType,
    referenceId: input.referenceId,
    referenceCode: input.referenceCode,
    notes: input.notes ?? null,
    createdByName: input.userName,
    createdAt: input.at,
  }
  d.movements.push(movement)
  return movement
}

/**
 * Valida todas las salidas antes de mover nada: así una venta o transferencia con un producto
 * sin stock no deja movimientos a medias (en el backend esto lo garantiza la transacción).
 */
function assertStock(d: MockDb, warehouseId: string, lines: { productId: string; quantity: number; name: string }[]) {
  const needed = new Map<string, { quantity: number; name: string }>()
  for (const l of lines) {
    const prev = needed.get(l.productId)
    needed.set(l.productId, { quantity: (prev?.quantity ?? 0) + l.quantity, name: l.name })
  }
  for (const [productId, { quantity, name }] of needed) {
    const available = stockOf(d, productId, warehouseId)
    if (available < quantity) throw badRequest(`Stock insuficiente de ${name}: hay ${available} y se piden ${quantity}.`)
  }
}

// ── Correos (regla 10) ───────────────────────────────────────────────────────

export function enqueueEmail(
  d: MockDb,
  input: { to: string; subject: string; template: EmailTemplate; html: string },
  at = new Date().toISOString(),
  outcome: { status: EmailStatus; attempts: number; error?: string } = { status: 'PENDING', attempts: 0 },
) {
  d.emails.push({
    emailOutboxId: newId(),
    toEmail: input.to,
    subject: input.subject,
    htmlBody: input.html,
    template: input.template,
    status: outcome.status,
    attempts: outcome.attempts,
    lastError: outcome.error ?? null,
    createdAt: at,
    sentAt: outcome.status === 'SENT' ? new Date(new Date(at).getTime() + 4000).toISOString() : null,
  })
}

/** En el historial sembrado los correos ya se procesaron: los de dominio `.test` fallaron. */
function seedOutcome(to: string): { status: EmailStatus; attempts: number; error?: string } {
  return to.endsWith('.test')
    ? { status: 'FAILED', attempts: 3, error: 'Resend 403: el dominio del destinatario no está verificado.' }
    : { status: 'SENT', attempts: 1 }
}

/**
 * Imita al BackgroundService: los correos pendientes con más de unos segundos se "envían".
 * Las direcciones de prueba que no existen fallan como lo haría Resend sin dominio verificado.
 */
export function processOutbox(d: MockDb) {
  const now = Date.now()
  let changed = false
  for (const e of d.emails) {
    if (e.status !== 'PENDING' || now - new Date(e.createdAt).getTime() < 6000) continue
    e.attempts += 1
    if (e.toEmail.endsWith('.test')) {
      e.status = e.attempts >= 3 ? 'FAILED' : 'PENDING'
      e.lastError = 'Resend 403: el dominio del destinatario no está verificado.'
    } else {
      e.status = 'SENT'
      e.sentAt = new Date().toISOString()
      e.lastError = null
    }
    changed = true
  }
  if (changed) save()
}

// ── Ajustes (regla 9) ────────────────────────────────────────────────────────

export function adjustStock(
  d: MockDb,
  products: Map<string, Product>,
  user: MockUser,
  input: { productId: string; warehouseId: string; type: 'ADJUST_IN' | 'ADJUST_OUT'; quantity: number; unitCost: number | null; reason: string },
) {
  const product = requireProduct(products, input.productId)
  requireWarehouse(d, input.warehouseId)
  if (!input.reason?.trim()) throw badRequest('El motivo del ajuste es obligatorio.')
  const movement = applyMovement(d, {
    productId: input.productId,
    warehouseId: input.warehouseId,
    code: input.type,
    quantity: input.quantity,
    unitCost: input.type === 'ADJUST_IN' ? (input.unitCost ?? undefined) : undefined,
    referenceType: 'ADJUSTMENT',
    referenceId: null,
    referenceCode: 'AJUSTE',
    notes: input.reason.trim(),
    userName: user.username,
    at: new Date().toISOString(),
    productName: product.name,
  })
  save()
  return movement
}

// ── Transferencias (regla 8) ────────────────────────────────────────────────

export function createTransfer(
  d: MockDb,
  products: Map<string, Product>,
  user: MockUser,
  input: { originWarehouseId: string; destinationWarehouseId: string; notes: string | null; items: { productId: string; quantity: number }[] },
  at = new Date().toISOString(),
) {
  requireWarehouse(d, input.originWarehouseId)
  requireWarehouse(d, input.destinationWarehouseId)
  if (input.originWarehouseId === input.destinationWarehouseId) throw badRequest('El almacén de origen y destino deben ser distintos.')
  if (!input.items?.length) throw badRequest('Agrega al menos un producto.')
  if (new Set(input.items.map((i) => i.productId)).size !== input.items.length) throw badRequest('Hay productos repetidos.')
  for (const item of input.items) {
    requireProduct(products, item.productId)
    if (!(item.quantity > 0)) throw badRequest('Las cantidades deben ser mayores a cero.')
  }
  d.counters.transfer += 1
  const transfer: TransferRec = {
    transferId: newId(),
    code: `TR-${String(d.counters.transfer).padStart(6, '0')}`,
    originWarehouseId: input.originWarehouseId,
    destinationWarehouseId: input.destinationWarehouseId,
    status: 'PENDING',
    notes: input.notes,
    requestedByName: user.username,
    completedByName: null,
    completedAt: null,
    createdAt: at,
    items: input.items.map((i) => ({ productId: i.productId, quantity: i.quantity })),
  }
  d.transfers.push(transfer)
  save()
  return transfer
}

export function completeTransfer(d: MockDb, products: Map<string, Product>, user: MockUser, transferId: string, at = new Date().toISOString()) {
  const t = d.transfers.find((x) => x.transferId === transferId)
  if (!t) throw notFound('Transferencia')
  if (t.status !== 'PENDING') throw badRequest('Solo se pueden completar transferencias pendientes.')
  assertStock(
    d,
    t.originWarehouseId,
    t.items.map((i) => ({ ...i, name: products.get(i.productId)?.name ?? 'producto' })),
  )
  for (const item of t.items) {
    const common = {
      productId: item.productId,
      quantity: item.quantity,
      referenceType: 'TRANSFER' as const,
      referenceId: t.transferId,
      referenceCode: t.code,
      userName: user.username,
      at,
    }
    applyMovement(d, { ...common, warehouseId: t.originWarehouseId, code: 'TRANSFER_OUT' })
    applyMovement(d, { ...common, warehouseId: t.destinationWarehouseId, code: 'TRANSFER_IN' })
  }
  t.status = 'COMPLETED'
  t.completedByName = user.username
  t.completedAt = at
  save()
  return t
}

export function cancelTransfer(d: MockDb, transferId: string) {
  const t = d.transfers.find((x) => x.transferId === transferId)
  if (!t) throw notFound('Transferencia')
  if (t.status !== 'PENDING') throw badRequest('Solo se pueden cancelar transferencias pendientes.')
  t.status = 'CANCELLED'
  save()
  return t
}

// ── Compras (regla 5) ────────────────────────────────────────────────────────

export interface PurchaseInput {
  supplierId: string
  warehouseId: string
  expectedDate: string | null
  notes: string | null
  items: { productId: string; quantity: number; unitCost: number }[]
}

function validatePurchase(d: MockDb, products: Map<string, Product>, input: PurchaseInput) {
  const supplier = d.suppliers.find((s) => s.supplierId === input.supplierId)
  if (!supplier) throw notFound('Proveedor')
  if (!supplier.isActive) throw badRequest('El proveedor está inactivo.')
  requireWarehouse(d, input.warehouseId)
  if (!input.items?.length) throw badRequest('Agrega al menos un producto.')
  if (new Set(input.items.map((i) => i.productId)).size !== input.items.length) throw badRequest('Hay productos repetidos.')
  for (const item of input.items) {
    requireProduct(products, item.productId)
    if (!(item.quantity > 0)) throw badRequest('Las cantidades deben ser mayores a cero.')
    if (!(item.unitCost >= 0)) throw badRequest('El costo no puede ser negativo.')
  }
}

function purchaseItems(input: PurchaseInput) {
  return input.items.map((i) => ({ ...i, subtotal: round2(i.quantity * i.unitCost) }))
}

export function createPurchaseOrder(d: MockDb, products: Map<string, Product>, user: MockUser, input: PurchaseInput, at = new Date().toISOString()) {
  validatePurchase(d, products, input)
  d.counters.purchaseOrder += 1
  const po: PurchaseOrderRec = {
    purchaseOrderId: newId(),
    code: `OC-${String(d.counters.purchaseOrder).padStart(6, '0')}`,
    supplierId: input.supplierId,
    warehouseId: input.warehouseId,
    status: 'DRAFT',
    orderDate: at.slice(0, 10),
    expectedDate: input.expectedDate,
    ...calculatePurchase(input.items),
    notes: input.notes,
    createdByName: user.username,
    approvedByName: null,
    approvedAt: null,
    receivedAt: null,
    createdAt: at,
    items: purchaseItems(input),
  }
  d.purchaseOrders.push(po)
  save()
  return po
}

export function requirePurchaseOrder(d: MockDb, id: string) {
  const po = d.purchaseOrders.find((x) => x.purchaseOrderId === id)
  if (!po) throw notFound('Orden de compra')
  return po
}

export function updatePurchaseOrder(d: MockDb, products: Map<string, Product>, id: string, input: PurchaseInput) {
  const po = requirePurchaseOrder(d, id)
  if (po.status !== 'DRAFT') throw badRequest('Solo se pueden editar órdenes en borrador.')
  validatePurchase(d, products, input)
  Object.assign(po, {
    supplierId: input.supplierId,
    warehouseId: input.warehouseId,
    expectedDate: input.expectedDate,
    notes: input.notes,
    items: purchaseItems(input),
    ...calculatePurchase(input.items),
  })
  save()
  return po
}

export function approvePurchaseOrder(d: MockDb, user: MockUser, id: string, at = new Date().toISOString()) {
  const po = requirePurchaseOrder(d, id)
  if (po.status !== 'DRAFT') throw badRequest('Solo se pueden aprobar órdenes en borrador.')
  po.status = 'APPROVED'
  po.approvedByName = user.username
  po.approvedAt = at
  save()
  return po
}

/** DRAFT → APPROVED → RECEIVED: el stock entra y el costo promedio se recalcula al recibir. */
export function receivePurchaseOrder(d: MockDb, user: MockUser, id: string, at = new Date().toISOString()) {
  const po = requirePurchaseOrder(d, id)
  if (po.status !== 'APPROVED') throw badRequest('Solo se pueden recibir órdenes aprobadas.')
  for (const item of po.items) {
    applyMovement(d, {
      productId: item.productId,
      warehouseId: po.warehouseId,
      code: 'PURCHASE_IN',
      quantity: item.quantity,
      unitCost: item.unitCost,
      referenceType: 'PURCHASE_ORDER',
      referenceId: po.purchaseOrderId,
      referenceCode: po.code,
      userName: user.username,
      at,
    })
  }
  po.status = 'RECEIVED'
  po.receivedAt = at
  save()
  return po
}

export function cancelPurchaseOrder(d: MockDb, id: string) {
  const po = requirePurchaseOrder(d, id)
  if (po.status === 'RECEIVED' || po.status === 'CANCELLED') throw badRequest('Esta orden ya no se puede cancelar.')
  po.status = 'CANCELLED'
  save()
  return po
}

// ── Ventas (reglas 6 y 7) ────────────────────────────────────────────────────

export interface SaleInput {
  warehouseId: string
  customerId: string
  documentType: InvoiceType
  notes: string | null
  items: { productId: string; quantity: number; discount: number }[]
  payments: { paymentMethodId: string; amount: number; reference: string | null }[]
}

export function createSale(d: MockDb, products: Map<string, Product>, user: MockUser, input: SaleInput, at = new Date().toISOString()) {
  requireWarehouse(d, input.warehouseId)
  const customer = d.customers.find((c) => c.customerId === input.customerId)
  if (!customer) throw notFound('Cliente')
  if (input.documentType === 'FACTURA' && customer.documentType !== 'RUC') {
    throw badRequest('La factura exige un cliente con RUC.')
  }
  if (!input.items?.length) throw badRequest('Agrega al menos un producto.')
  if (new Set(input.items.map((i) => i.productId)).size !== input.items.length) throw badRequest('Hay productos repetidos.')

  const lines = input.items.map((item) => {
    const product = requireProduct(products, item.productId)
    if (!product.isActive) throw badRequest(`${product.name} está inactivo.`)
    if (product.currentPrice == null) throw badRequest(`${product.name} no tiene precio vigente.`)
    if (!(item.quantity > 0)) throw badRequest('Las cantidades deben ser mayores a cero.')
    if (item.discount < 0 || item.discount > item.quantity * product.currentPrice) throw badRequest(`Descuento no válido en ${product.name}.`)
    return { product, item }
  })

  assertStock(d, input.warehouseId, lines.map(({ product, item }) => ({ productId: product.productId, quantity: item.quantity, name: product.name })))

  const saleInputs = lines.map(({ product, item }) => ({
    quantity: item.quantity,
    unitPrice: product.currentPrice!,
    discount: item.discount,
    isTaxable: product.isTaxable,
  }))
  const totals = calculateSale(saleInputs)

  const paid = round2(input.payments.reduce((sum, p) => sum + p.amount, 0))
  if (!input.payments.length) throw badRequest('Registra al menos un pago.')
  if (input.payments.some((p) => !(p.amount > 0))) throw badRequest('Los pagos deben ser mayores a cero.')
  for (const p of input.payments) {
    if (!d.paymentMethods.some((m) => m.paymentMethodId === p.paymentMethodId)) throw notFound('Método de pago')
  }
  // Solo el efectivo puede exceder el total (se da vuelto); el resto debe cuadrar.
  const cash = d.paymentMethods.find((m) => m.code === 'CASH')?.paymentMethodId
  const nonCash = round2(input.payments.filter((p) => p.paymentMethodId !== cash).reduce((s, p) => s + p.amount, 0))
  if (paid < totals.total) throw badRequest(`Los pagos (S/ ${paid.toFixed(2)}) no cubren el total (S/ ${totals.total.toFixed(2)}).`)
  if (nonCash > totals.total) throw badRequest('Solo el pago en efectivo puede superar el total.')

  const series = d.documentSeries.find((s) => s.documentType === input.documentType && s.isActive)
  if (!series) throw badRequest(`No hay serie activa para ${input.documentType}.`)
  series.currentNumber += 1

  const saleId = newId()
  const fullNumber = `${series.series}-${String(series.currentNumber).padStart(8, '0')}`

  const items: SaleItemRec[] = lines.map(({ product, item }) => {
    const t = calculateLine({ quantity: item.quantity, unitPrice: product.currentPrice!, discount: item.discount, isTaxable: product.isTaxable })
    applyMovement(d, {
      productId: product.productId,
      warehouseId: input.warehouseId,
      code: 'SALE_OUT',
      quantity: item.quantity,
      referenceType: 'SALE',
      referenceId: saleId,
      referenceCode: fullNumber,
      userName: user.username,
      at,
      productName: product.name,
    })
    return {
      productId: product.productId,
      productName: product.name,
      sku: product.sku,
      unitCode: product.unitCode,
      quantity: item.quantity,
      unitPrice: product.currentPrice!,
      discount: item.discount,
      taxRate: t.taxRate,
      taxAmount: t.taxAmount,
      // Regla 4: la venta copia el costo del momento para calcular la utilidad.
      unitCost: averageCost(d, product.productId),
      lineTotal: t.lineTotal,
    }
  })

  // El vuelto no se registra como pago: se descuenta del efectivo.
  let change = round2(paid - totals.total)
  const payments: PaymentRec[] = input.payments.map((p) => {
    let amount = p.amount
    if (p.paymentMethodId === cash && change > 0) {
      const used = Math.min(change, amount)
      amount = round2(amount - used)
      change = round2(change - used)
    }
    return { paymentId: newId(), paymentMethodId: p.paymentMethodId, amount, reference: p.reference, paidAt: at }
  }).filter((p) => p.amount > 0)

  const sale: SaleRec = {
    saleId,
    warehouseId: input.warehouseId,
    customerId: customer.customerId,
    sellerName: user.username,
    status: 'COMPLETED',
    ...totals,
    notes: input.notes,
    soldAt: at,
    cancelledAt: null,
    cancelReason: null,
    items,
    payments,
    invoice: {
      invoiceId: newId(),
      documentType: input.documentType,
      series: series.series,
      number: series.currentNumber,
      fullNumber,
      customerDocumentType: customer.documentType,
      customerDocumentNumber: customer.documentNumber,
      customerName: customer.fullName,
      subtotal: totals.subtotal,
      taxAmount: totals.taxAmount,
      total: totals.total,
      status: 'ISSUED',
      issuedAt: at,
    },
  }
  d.sales.push(sale)
  if (customer.email) {
    enqueueEmail(
      d,
      {
        to: customer.email,
        subject: `Tu ${input.documentType === 'FACTURA' ? 'factura' : 'boleta'} ${fullNumber} de Magazing`,
        template: 'INVOICE',
        html: `<p>Hola ${customer.fullName}, adjuntamos tu comprobante ${fullNumber} por S/ ${totals.total.toFixed(2)}.</p>`,
      },
      at,
      suspendSave ? seedOutcome(customer.email) : undefined,
    )
  }
  save()
  return sale
}

export function cancelSale(d: MockDb, user: MockUser, saleId: string, reason: string) {
  const sale = d.sales.find((s) => s.saleId === saleId)
  if (!sale) throw notFound('Venta')
  if (sale.status === 'CANCELLED') throw badRequest('La venta ya está anulada.')
  if (!reason?.trim()) throw badRequest('El motivo de anulación es obligatorio.')
  const at = new Date().toISOString()
  for (const item of sale.items) {
    applyMovement(d, {
      productId: item.productId,
      warehouseId: sale.warehouseId,
      code: 'SALE_CANCEL_IN',
      quantity: item.quantity,
      unitCost: item.unitCost,
      referenceType: 'SALE',
      referenceId: sale.saleId,
      referenceCode: sale.invoice.fullNumber,
      notes: reason.trim(),
      userName: user.username,
      at,
    })
  }
  sale.status = 'CANCELLED'
  sale.cancelledAt = at
  sale.cancelReason = reason.trim()
  sale.invoice.status = 'CANCELLED'
  save()
  return sale
}

// ── Predicción de demanda (regla 11) ─────────────────────────────────────────

export const MODEL_VERSION = 'mock-wma-1'

/** Lunes (local) de la semana de `date`, como YYYY-MM-DD. */
export function weekStart(date: Date) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const day = (d.getDay() + 6) % 7
  d.setDate(d.getDate() - day)
  return toLocalDate(d)
}

export function toLocalDate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function addDays(isoDate: string, days: number) {
  const [y, m, dd] = isoDate.split('-').map(Number)
  const d = new Date(y, m - 1, dd + days)
  return toLocalDate(d)
}

export interface ForecastPoint {
  periodStart: string
  periodEnd: string
  actualQuantity: number | null
  predictedQuantity: number | null
  lowerBound: number | null
  upperBound: number | null
}

/**
 * "Modelo" simulado: promedio móvil ponderado de las últimas 4 semanas más la tendencia
 * de las últimas 8. Sirve para armar la UI; el real será el ONNX entrenado en Python.
 */
export function forecast(d: MockDb, productId: string, warehouseId: string, historyWeeks = 12, horizon = 4): ForecastPoint[] {
  const current = weekStart(new Date())
  const weeks = Array.from({ length: historyWeeks }, (_, i) => addDays(current, -7 * (historyWeeks - i)))
  const sold = new Map<string, number>(weeks.map((w) => [w, 0]))
  for (const s of d.sales) {
    if (s.status !== 'COMPLETED' || s.warehouseId !== warehouseId) continue
    const w = weekStart(new Date(s.soldAt))
    if (!sold.has(w)) continue
    for (const item of s.items) if (item.productId === productId) sold.set(w, sold.get(w)! + item.quantity)
  }
  const series = weeks.map((w) => sold.get(w)!)

  const last4 = series.slice(-4)
  const weights = [1, 2, 3, 4]
  const wma = last4.reduce((sum, v, i) => sum + v * weights[i], 0) / weights.reduce((a, b) => a + b, 0)
  const last8 = series.slice(-8)
  const mean8 = last8.reduce((a, b) => a + b, 0) / Math.max(last8.length, 1)
  const slope = linearSlope(last8)
  const residualSd = Math.sqrt(last8.reduce((s, v) => s + (v - mean8) ** 2, 0) / Math.max(last8.length - 1, 1))

  const history: ForecastPoint[] = weeks.map((w, i) => ({
    periodStart: w,
    periodEnd: addDays(w, 6),
    actualQuantity: series[i],
    predictedQuantity: null,
    lowerBound: null,
    upperBound: null,
  }))
  const future: ForecastPoint[] = Array.from({ length: horizon }, (_, i) => {
    const start = addDays(current, 7 * i)
    const predicted = Math.max(0, wma + slope * (i + 1))
    const spread = 1.28 * residualSd * Math.sqrt(1 + i * 0.25)
    return {
      periodStart: start,
      periodEnd: addDays(start, 6),
      actualQuantity: null,
      predictedQuantity: round3(Math.round(predicted * 10) / 10),
      lowerBound: round3(Math.max(0, Math.round((predicted - spread) * 10) / 10)),
      upperBound: round3(Math.round((predicted + spread) * 10) / 10),
    }
  })
  return [...history, ...future]
}

function linearSlope(values: number[]) {
  const n = values.length
  if (n < 2) return 0
  const xMean = (n - 1) / 2
  const yMean = values.reduce((a, b) => a + b, 0) / n
  let num = 0
  let den = 0
  values.forEach((y, x) => {
    num += (x - xMean) * (y - yMean)
    den += (x - xMean) ** 2
  })
  return num / den
}

/** Corre la predicción para todos los productos y abre/actualiza alertas. */
export function runPredictions(d: MockDb, products: Product[]) {
  const warehouse = d.warehouses[0]
  const now = new Date().toISOString()
  let created = 0
  for (const p of products.filter((x) => x.isActive)) {
    const stock = stockOf(d, p.productId, warehouse.warehouseId)
    const next = forecast(d, p.productId, warehouse.warehouseId).find((f) => f.predictedQuantity !== null)
    const predicted = next?.predictedQuantity ?? 0

    const checks: { type: AlertType; threshold: number; suggested: number; active: boolean }[] = [
      {
        type: 'LOW_STOCK',
        threshold: p.minStock,
        suggested: Math.max(0, Math.ceil((p.maxStock ?? p.minStock * 3) - stock)),
        active: p.minStock > 0 && stock < p.minStock,
      },
      {
        type: 'PREDICTED_SHORTAGE',
        threshold: predicted,
        suggested: Math.max(0, Math.ceil(predicted * 2 - stock)),
        active: predicted > 0 && stock < predicted,
      },
    ]
    for (const c of checks) {
      const open = d.alerts.find((a) => a.productId === p.productId && a.alertType === c.type && a.status !== 'RESOLVED')
      if (c.active && !open) {
        d.alerts.push({
          stockAlertId: newId(),
          productId: p.productId,
          warehouseId: warehouse.warehouseId,
          alertType: c.type,
          currentStock: stock,
          threshold: round3(c.threshold),
          suggestedOrderQty: c.suggested,
          status: 'OPEN',
          createdAt: now,
          resolvedAt: null,
          resolvedByName: null,
        })
        enqueueEmail(
          d,
          {
            to: d.company?.email ?? 'contacto@magazing.pe',
            subject: `Alerta de stock: ${p.name}`,
            template: 'STOCK_ALERT',
            html: `<p>${p.name}: stock ${stock}, umbral ${round3(c.threshold)}. Sugerido pedir ${c.suggested}.</p>`,
          },
          now,
          suspendSave ? seedOutcome(d.company?.email ?? '') : undefined,
        )
        created++
      } else if (c.active && open) {
        open.currentStock = stock
        open.threshold = round3(c.threshold)
        open.suggestedOrderQty = c.suggested
      } else if (!c.active && open) {
        open.status = 'RESOLVED'
        open.resolvedAt = now
        open.resolvedByName = 'sistema'
      }
    }
  }
  save()
  return { created, modelVersion: MODEL_VERSION }
}

// ── Semilla ──────────────────────────────────────────────────────────────────

/** Catálogos fijos, iguales a `02_seed.sql` (más un segundo almacén para probar transferencias). */
function seedStatic(d: MockDb) {
  const created = new Date(Date.now() - 120 * 86_400_000).toISOString()
  d.company = {
    companyId: newId(),
    ruc: '20123456789',
    businessName: 'MAGAZING S.A.C.',
    tradeName: 'Magazing',
    address: 'Av. Ejercito 123, Arequipa',
    phone: '054123456',
    email: 'contacto@magazing.pe',
    logoUrl: null,
  }
  d.branches = [
    { branchId: newId(), code: 'PRI', name: 'Tienda Principal', address: 'Av. Ejercito 123, Arequipa', phone: '054123456', isActive: true, createdAt: created },
    { branchId: newId(), code: 'CAY', name: 'Tienda Cayma', address: 'Av. Cayma 450, Arequipa', phone: null, isActive: true, createdAt: created },
  ]
  const [pri, cay] = d.branches
  d.warehouses = [
    { warehouseId: newId(), branchId: pri.branchId, code: 'ALM01', name: 'Almacen Principal', address: 'Av. Ejercito 123, Arequipa', isActive: true },
    { warehouseId: newId(), branchId: cay.branchId, code: 'ALM02', name: 'Almacen Tienda Cayma', address: 'Av. Cayma 450, Arequipa', isActive: true },
  ]
  d.paymentMethods = [
    ['CASH', 'Efectivo'],
    ['CARD', 'Tarjeta'],
    ['YAPE', 'Yape'],
    ['PLIN', 'Plin'],
    ['TRANSFER', 'Transferencia bancaria'],
  ].map(([code, name]) => ({ paymentMethodId: newId(), code, name, isActive: true }))
  d.documentSeries = [
    { documentSeriesId: newId(), branchId: pri.branchId, documentType: 'BOLETA', series: 'B001', currentNumber: 0, isActive: true },
    { documentSeriesId: newId(), branchId: pri.branchId, documentType: 'FACTURA', series: 'F001', currentNumber: 0, isActive: true },
  ]
  const customer = (documentType: DocumentType, documentNumber: string, fullName: string, email: string | null = null): CustomerRec => ({
    customerId: newId(),
    documentType,
    documentNumber,
    fullName,
    email,
    phone: null,
    address: null,
    isActive: true,
    createdAt: created,
  })
  d.customers = [
    customer('DNI', '00000000', 'CLIENTES VARIOS'),
    customer('DNI', '45879632', 'María Quispe Huamán', 'maria.quispe@gmail.com'),
    customer('DNI', '70214589', 'Luis Mamani Condori'),
    customer('RUC', '20456789123', 'Bodega El Misti E.I.R.L.', 'compras@elmisti.pe'),
    customer('RUC', '10457896321', 'Rosa Apaza Ccama', 'rosa.apaza@correo.test'),
  ]
  const supplier = (ruc: string, businessName: string, contactName: string, email: string, phone: string): SupplierRec => ({
    supplierId: newId(),
    ruc,
    businessName,
    contactName,
    email,
    phone,
    address: null,
    isActive: true,
    createdAt: created,
  })
  d.suppliers = [
    supplier('20100000001', 'Distribuidora del Sur S.A.C.', 'Juan Perez', 'ventas@distsur.pe', '054987654'),
    supplier('20512345678', 'Comercial Andina S.R.L.', 'Ana Torres', 'pedidos@candina.pe', '054223344'),
    supplier('20600123456', 'Mayorista Arequipa S.A.', 'Carlos Ramos', 'carlos@mayoristaaqp.pe', '959111222'),
  ]
}

/**
 * Genera ~16 semanas de historia para los productos reales: saldo inicial, ventas diarias con
 * estacionalidad semanal, reposiciones con órdenes de compra recibidas, una transferencia y
 * algunas órdenes abiertas. Todo pasa por las mismas funciones que usan los endpoints, así que
 * el kardex, los costos y los correlativos quedan consistentes.
 */
function seedHistory(d: MockDb, products: Product[]) {
  const rand = seededRandom(20261109)
  const system: MockUser = { userId: 'seed', username: 'admin', token: '' }
  const productMap = new Map(products.map((p) => [p.productId, p]))
  const main = d.warehouses[0]
  const days = 112
  const today = new Date()
  const dayAt = (offset: number, hour: number, minute = 0) => {
    const t = new Date(today.getFullYear(), today.getMonth(), today.getDate() - offset, hour, minute)
    return t.toISOString()
  }

  const active = products.filter((p) => p.isActive && p.currentPrice != null)
  // Demanda diaria base por producto (unidades) y ligera tendencia al alza.
  const demand = new Map(active.map((p) => [p.productId, 1.5 + rand() * 5]))

  for (const p of products) {
    d.productCosts[p.productId] = p.averageCost > 0 ? p.averageCost : round2((p.currentPrice ?? 10) / 1.35)
  }
  for (const p of active) {
    const qty = Math.round(demand.get(p.productId)! * 21)
    applyMovement(d, {
      productId: p.productId,
      warehouseId: main.warehouseId,
      code: 'INITIAL',
      quantity: qty,
      unitCost: d.productCosts[p.productId],
      referenceType: 'INITIAL',
      referenceId: null,
      referenceCode: 'INICIAL',
      notes: 'Saldo inicial',
      userName: 'admin',
      at: dayAt(days, 8),
    })
  }

  const varios = d.customers[0]
  const rucCustomers = d.customers.filter((c) => c.documentType === 'RUC')
  const dniCustomers = d.customers.filter((c) => c.documentType === 'DNI' && c !== varios)
  const methods = d.paymentMethods

  for (let offset = days - 1; offset >= 0; offset--) {
    const date = new Date(today.getFullYear(), today.getMonth(), today.getDate() - offset)
    const weekday = date.getDay()
    const factor = weekday === 6 ? 1.5 : weekday === 0 ? 0.6 : weekday === 5 ? 1.2 : 1
    const trend = 1 + ((days - offset) / days) * 0.25

    // Reposición: si el stock no alcanza para ~6 días, se compra para ~3 semanas.
    const toBuy = active.filter((p) => stockOf(d, p.productId, main.warehouseId) < demand.get(p.productId)! * 6)
    if (toBuy.length > 0 && offset > 0) {
      const supplier = d.suppliers[Math.floor(rand() * d.suppliers.length)]
      const at = dayAt(offset, 8, 30)
      const po = createPurchaseOrder(
        d,
        productMap,
        system,
        {
          supplierId: supplier.supplierId,
          warehouseId: main.warehouseId,
          expectedDate: toLocalDate(date),
          notes: 'Reposición automática',
          items: toBuy.map((p) => ({
            productId: p.productId,
            quantity: Math.round(demand.get(p.productId)! * 21),
            unitCost: round2(d.productCosts[p.productId] * (0.94 + rand() * 0.12)),
          })),
        },
        dayAt(offset + 2, 10),
      )
      approvePurchaseOrder(d, system, po.purchaseOrderId, dayAt(offset + 1, 11))
      receivePurchaseOrder(d, system, po.purchaseOrderId, at)
    }

    // Ventas del día: la demanda de cada producto se reparte entre varios tickets.
    const tickets = 2 + Math.floor(rand() * 5 * factor)
    const lines: { productId: string; quantity: number }[][] = Array.from({ length: tickets }, () => [])
    for (const p of active) {
      let qty = Math.round(demand.get(p.productId)! * factor * trend * (0.6 + rand() * 0.8))
      qty = Math.min(qty, Math.floor(stockOf(d, p.productId, main.warehouseId)))
      while (qty > 0) {
        const take = Math.min(qty, 1 + Math.floor(rand() * 3))
        const ticket = lines[Math.floor(rand() * tickets)]
        const existing = ticket.find((l) => l.productId === p.productId)
        if (existing) existing.quantity += take
        else ticket.push({ productId: p.productId, quantity: take })
        qty -= take
      }
    }
    lines.forEach((items, i) => {
      if (items.length === 0) return
      const factura = rand() < 0.12
      const customer = factura
        ? rucCustomers[Math.floor(rand() * rucCustomers.length)]
        : rand() < 0.8
          ? varios
          : dniCustomers[Math.floor(rand() * dniCustomers.length)]
      const total = calculateSale(
        items.map((l) => {
          const p = productMap.get(l.productId)!
          return { quantity: l.quantity, unitPrice: p.currentPrice!, discount: 0, isTaxable: p.isTaxable }
        }),
      ).total
      const r = rand()
      const method = r < 0.55 ? methods[0] : r < 0.75 ? methods[2] : r < 0.85 ? methods[3] : methods[1]
      createSale(
        d,
        productMap,
        system,
        {
          warehouseId: main.warehouseId,
          customerId: customer.customerId,
          documentType: factura ? 'FACTURA' : 'BOLETA',
          notes: null,
          items: items.map((l) => ({ ...l, discount: 0 })),
          payments: [{ paymentMethodId: method.paymentMethodId, amount: total, reference: method.code === 'CASH' ? null : `OP-${Math.floor(rand() * 1e6)}` }],
        },
        dayAt(offset, 9 + Math.floor((i / tickets) * 11), Math.floor(rand() * 60)),
      )
    })

    // Hace 30 días se abasteció el segundo almacén.
    if (offset === 30 && active.length > 0) {
      const items = active.slice(0, 3).map((p) => ({ productId: p.productId, quantity: Math.max(1, Math.floor(stockOf(d, p.productId, main.warehouseId) / 5)) }))
      const t = createTransfer(d, productMap, system, { originWarehouseId: main.warehouseId, destinationWarehouseId: d.warehouses[1].warehouseId, notes: 'Abastecimiento tienda Cayma', items }, dayAt(offset, 9))
      completeTransfer(d, productMap, system, t.transferId, dayAt(offset, 15))
    }
  }

  // Una venta anulada para que el flujo se vea en el historial.
  const toCancel = d.sales.filter((s) => s.status === 'COMPLETED').at(-6)
  if (toCancel) cancelSale(d, system, toCancel.saleId, 'Cliente desistió de la compra')

  // Pendientes de hoy: una orden en borrador, una aprobada y una transferencia pendiente.
  if (active.length > 0) {
    const sample = active.slice(0, 2)
    const items = sample.map((p) => ({ productId: p.productId, quantity: 24, unitCost: round2(d.productCosts[p.productId]) }))
    createPurchaseOrder(d, productMap, system, { supplierId: d.suppliers[1].supplierId, warehouseId: main.warehouseId, expectedDate: addDays(toLocalDate(today), 5), notes: null, items }, dayAt(0, 9))
    const approved = createPurchaseOrder(d, productMap, system, { supplierId: d.suppliers[0].supplierId, warehouseId: main.warehouseId, expectedDate: addDays(toLocalDate(today), 2), notes: 'Pedido semanal', items }, dayAt(1, 9))
    approvePurchaseOrder(d, system, approved.purchaseOrderId, dayAt(1, 12))
    createTransfer(d, productMap, system, { originWarehouseId: main.warehouseId, destinationWarehouseId: d.warehouses[1].warehouseId, notes: 'Reposición tienda', items: sample.map((p) => ({ productId: p.productId, quantity: 5 })) }, dayAt(0, 10))
  }

  runPredictions(d, products)

  // Correo de bienvenida del usuario admin (plantilla WELCOME), el más antiguo de la bandeja.
  d.emails.unshift({
    emailOutboxId: newId(),
    toEmail: 'admin@magazing.pe',
    subject: 'Bienvenido a Magazing',
    htmlBody: '<p>Tu cuenta de administrador está lista.</p>',
    template: 'WELCOME',
    status: 'SENT',
    attempts: 1,
    lastError: null,
    createdAt: dayAt(days + 1, 9),
    sentAt: dayAt(days + 1, 9, 1),
  })
}
