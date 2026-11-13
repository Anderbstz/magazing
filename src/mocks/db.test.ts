import { beforeEach, describe, expect, it } from 'vitest'
import type { Product } from '@/features/catalog/api'
import {
  adjustStock,
  approvePurchaseOrder,
  createPurchaseOrder,
  createSale,
  getDb,
  receivePurchaseOrder,
  resetDb,
  stockOf,
  totalStock,
  type MockDb,
} from './db'

const product = (id: string, name: string, price: number, cost: number, taxable = true): Product => ({
  productId: id,
  sku: id.toUpperCase(),
  barcode: null,
  name,
  description: null,
  categoryId: 'cat',
  categoryName: 'Abarrotes',
  brandId: null,
  brandName: null,
  unitId: 'u',
  unitCode: 'NIU',
  isTaxable: taxable,
  minStock: 10,
  maxStock: 200,
  averageCost: cost,
  currentPrice: price,
  imageUrl: null,
  isActive: true,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: null,
})

const products = [product('arroz', 'Arroz 5 kg', 24.9, 18.5), product('aceite', 'Aceite 1 L', 10.5, 7.2), product('pan', 'Pan', 0.5, 0.3, false)]
const productMap = new Map(products.map((p) => [p.productId, p]))
const user = { userId: 'u1', username: 'tester', token: '' }

let d: MockDb
beforeEach(() => {
  resetDb()
  d = getDb(products)
})

describe('semilla del historial', () => {
  it('genera ventas, compras y movimientos', () => {
    expect(d.sales.length).toBeGreaterThan(100)
    expect(d.purchaseOrders.some((po) => po.status === 'RECEIVED')).toBe(true)
    expect(d.purchaseOrders.some((po) => po.status === 'DRAFT')).toBe(true)
    expect(d.transfers.some((t) => t.status === 'PENDING')).toBe(true)
  })

  it('el kardex cuadra: el último saldo de cada almacén es el stock', () => {
    for (const s of d.stocks) {
      const last = d.movements.filter((m) => m.productId === s.productId && m.warehouseId === s.warehouseId).at(-1)
      expect(last?.balanceAfter).toBeCloseTo(s.quantity, 3)
      expect(s.quantity).toBeGreaterThanOrEqual(0)
    }
  })

  it('los correlativos de cada serie son consecutivos', () => {
    for (const series of d.documentSeries) {
      const numbers = d.sales.filter((s) => s.invoice.series === series.series).map((s) => s.invoice.number)
      expect(numbers).toEqual(numbers.map((_, i) => i + 1))
      expect(series.currentNumber).toBe(numbers.length)
    }
  })

  it('las facturas siempre tienen cliente con RUC', () => {
    for (const s of d.sales.filter((x) => x.invoice.documentType === 'FACTURA')) {
      expect(s.invoice.customerDocumentType).toBe('RUC')
    }
  })
})

describe('reglas de negocio', () => {
  const main = () => d.warehouses[0].warehouseId

  it('no permite vender más del stock disponible', () => {
    const varios = d.customers[0].customerId
    const cash = d.paymentMethods[0].paymentMethodId
    const qty = stockOf(d, 'arroz', main()) + 1
    expect(() =>
      createSale(d, productMap, user, {
        warehouseId: main(),
        customerId: varios,
        documentType: 'BOLETA',
        notes: null,
        items: [{ productId: 'arroz', quantity: qty, discount: 0 }],
        payments: [{ paymentMethodId: cash, amount: 99999, reference: null }],
      }),
    ).toThrow(/Stock insuficiente/)
  })

  it('rechaza factura para cliente con DNI', () => {
    const varios = d.customers[0].customerId
    expect(() =>
      createSale(d, productMap, user, {
        warehouseId: main(),
        customerId: varios,
        documentType: 'FACTURA',
        notes: null,
        items: [{ productId: 'pan', quantity: 1, discount: 0 }],
        payments: [{ paymentMethodId: d.paymentMethods[0].paymentMethodId, amount: 1, reference: null }],
      }),
    ).toThrow(/RUC/)
  })

  it('recalcula el costo promedio ponderado al recibir una compra', () => {
    const stockBefore = totalStock(d, 'arroz')
    const costBefore = d.productCosts.arroz
    const po = createPurchaseOrder(d, productMap, user, {
      supplierId: d.suppliers[0].supplierId,
      warehouseId: main(),
      expectedDate: null,
      notes: null,
      items: [{ productId: 'arroz', quantity: 100, unitCost: 20 }],
    })
    approvePurchaseOrder(d, user, po.purchaseOrderId)
    receivePurchaseOrder(d, user, po.purchaseOrderId)
    const expected = (stockBefore * costBefore + 100 * 20) / (stockBefore + 100)
    expect(d.productCosts.arroz).toBeCloseTo(expected, 3)
    expect(totalStock(d, 'arroz')).toBeCloseTo(stockBefore + 100, 3)
  })

  it('no recibe una orden que no está aprobada', () => {
    const po = createPurchaseOrder(d, productMap, user, {
      supplierId: d.suppliers[0].supplierId,
      warehouseId: main(),
      expectedDate: null,
      notes: null,
      items: [{ productId: 'arroz', quantity: 1, unitCost: 20 }],
    })
    expect(() => receivePurchaseOrder(d, user, po.purchaseOrderId)).toThrow(/aprobadas/)
  })

  it('el ajuste exige motivo', () => {
    expect(() =>
      adjustStock(d, productMap, user, { productId: 'arroz', warehouseId: main(), type: 'ADJUST_IN', quantity: 1, unitCost: null, reason: ' ' }),
    ).toThrow(/motivo/)
  })
})
