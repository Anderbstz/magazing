import { describe, expect, it } from 'vitest'
import { calculateLine, calculatePurchase, calculateSale } from './tax'

describe('calculateLine (precio con IGV incluido)', () => {
  it('desglosa base e IGV de un producto gravado', () => {
    // Arroz a S/ 24.90: base 21.10 + IGV 3.80
    expect(calculateLine({ quantity: 1, unitPrice: 24.9, discount: 0, isTaxable: true })).toEqual({
      lineTotal: 24.9,
      base: 21.1,
      taxAmount: 3.8,
      taxRate: 0.18,
    })
  })

  it('aplica el descuento antes de desglosar', () => {
    const t = calculateLine({ quantity: 2, unitPrice: 24.9, discount: 1.8, isTaxable: true })
    expect(t.lineTotal).toBe(48)
    expect(t.base + t.taxAmount).toBeCloseTo(48, 2)
  })

  it('no cobra IGV a productos exonerados', () => {
    expect(calculateLine({ quantity: 3, unitPrice: 2.5, discount: 0, isTaxable: false })).toEqual({
      lineTotal: 7.5,
      base: 7.5,
      taxAmount: 0,
      taxRate: 0,
    })
  })

  it('nunca da un total negativo', () => {
    expect(calculateLine({ quantity: 1, unitPrice: 5, discount: 10, isTaxable: true }).lineTotal).toBe(0)
  })
})

describe('calculateSale', () => {
  it('suma las líneas y la base + IGV cuadra con el total', () => {
    const totals = calculateSale([
      { quantity: 2, unitPrice: 24.9, discount: 0, isTaxable: true },
      { quantity: 1, unitPrice: 10.5, discount: 0.5, isTaxable: true },
      { quantity: 4, unitPrice: 1.2, discount: 0, isTaxable: false },
    ])
    expect(totals.total).toBe(64.6)
    expect(totals.discountTotal).toBe(0.5)
    expect(totals.subtotal + totals.taxAmount).toBeCloseTo(totals.total, 2)
  })
})

describe('calculatePurchase (costo sin IGV)', () => {
  it('suma el IGV encima del subtotal', () => {
    expect(calculatePurchase([{ quantity: 10, unitCost: 18.5 }])).toEqual({ subtotal: 185, taxAmount: 33.3, total: 218.3 })
  })
})
