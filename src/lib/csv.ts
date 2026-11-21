/** CSV con `;` (Excel en español lo abre en columnas) y BOM para que respete las tildes. */
export function toCsv(headers: string[], rows: (string | number | null)[][]) {
  const cell = (v: string | number | null) => {
    if (v === null) return ''
    const s = typeof v === 'number' ? String(v).replace('.', ',') : v
    return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  return '﻿' + [headers, ...rows].map((r) => r.map(cell).join(';')).join('\r\n')
}

export function downloadFile(content: string, filename: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type: `${type};charset=utf-8` }))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
