/** IGV vigente en Perú. */
export const IGV_RATE = 0.18

export const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100

export interface SaleLineInput {
  quantity: number
  /** Precio unitario con IGV incluido (así se guarda en `product_prices`). */
  unitPrice: number
  /** Descuento en soles sobre la línea, con IGV incluido. */
  discount: number
  isTaxable: boolean
}

export interface SaleLineTotals {
  /** Total de la línea con IGV (lo que paga el cliente). */
  lineTotal: number
  /** Base imponible (sin IGV). */
  base: number
  taxAmount: number
  taxRate: number
}

/**
 * Regla 6 del MVP: los precios incluyen IGV, así que se desglosa hacia atrás.
 * total = cantidad × precio − descuento; base = total / 1.18; IGV = total − base.
 * Los productos exonerados no llevan IGV.
 */
export function calculateLine(line: SaleLineInput): SaleLineTotals {
  const lineTotal = round2(Math.max(0, line.quantity * line.unitPrice - line.discount))
  const taxRate = line.isTaxable ? IGV_RATE : 0
  const base = round2(lineTotal / (1 + taxRate))
  return { lineTotal, base, taxAmount: round2(lineTotal - base), taxRate }
}

export interface SaleTotals {
  subtotal: number
  discountTotal: number
  taxAmount: number
  total: number
}

export function calculateSale(lines: SaleLineInput[]): SaleTotals {
  let subtotal = 0
  let taxAmount = 0
  let total = 0
  let discountTotal = 0
  for (const line of lines) {
    const t = calculateLine(line)
    subtotal += t.base
    taxAmount += t.taxAmount
    total += t.lineTotal
    discountTotal += line.discount
  }
  return {
    subtotal: round2(subtotal),
    discountTotal: round2(discountTotal),
    taxAmount: round2(taxAmount),
    total: round2(total),
  }
}

/** Compras: el costo se registra sin IGV y el IGV se suma encima. */
export function calculatePurchase(lines: { quantity: number; unitCost: number }[]) {
  const subtotal = round2(lines.reduce((sum, l) => sum + round2(l.quantity * l.unitCost), 0))
  const taxAmount = round2(subtotal * IGV_RATE)
  return { subtotal, taxAmount, total: round2(subtotal + taxAmount) }
}
