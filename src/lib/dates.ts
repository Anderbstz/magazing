/** Fecha local en formato YYYY-MM-DD (el que esperan los filtros de la API). */
export const isoDate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

export const daysAgo = (n: number, from = new Date()) => {
  const d = new Date(from)
  d.setDate(d.getDate() - n)
  return isoDate(d)
}

/** Primer día del mes, `n` meses atrás (0 = este mes). */
export const monthStart = (n: number, from = new Date()) => isoDate(new Date(from.getFullYear(), from.getMonth() - n, 1))
