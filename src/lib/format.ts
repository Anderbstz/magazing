const currency = new Intl.NumberFormat('es-PE', {
  style: 'currency',
  currency: 'PEN',
  minimumFractionDigits: 2,
})

const quantity = new Intl.NumberFormat('es-PE', { maximumFractionDigits: 3 })

const dateTime = new Intl.DateTimeFormat('es-PE', {
  dateStyle: 'medium',
  timeStyle: 'short',
})

const date = new Intl.DateTimeFormat('es-PE', { dateStyle: 'medium' })

/** S/ 24.90 */
export function formatMoney(value: number | null | undefined) {
  return value == null ? '—' : currency.format(value)
}

/** 1,250.5 (hasta 3 decimales, como `numeric(12,3)` en la BD) */
export function formatQuantity(value: number | null | undefined) {
  return value == null ? '—' : quantity.format(value)
}

export function formatDateTime(value: string | null | undefined) {
  return value ? dateTime.format(new Date(value)) : '—'
}

export function formatDate(value: string | null | undefined) {
  return value ? date.format(new Date(value)) : '—'
}
