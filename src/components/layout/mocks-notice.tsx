import { FlaskConical, RotateCcw } from 'lucide-react'
import { useState } from 'react'
import { http } from '@/api/http'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { queryClient } from '@/lib/query-client'
import { mocksEnabled } from '@/mocks/flag'

/** Avisa que hay módulos con datos simulados y permite regenerarlos. Solo aparece en desarrollo. */
export function MocksNotice() {
  const [confirm, setConfirm] = useState(false)
  const [loading, setLoading] = useState(false)

  if (!mocksEnabled) return null

  async function reset() {
    setLoading(true)
    try {
      await http.post('/_mocks/reset')
      await queryClient.resetQueries()
    } finally {
      setLoading(false)
      setConfirm(false)
    }
  }

  return (
    <div className="mx-3 mb-3 rounded-lg bg-amber-50 p-3 text-xs text-amber-900 ring-1 ring-amber-200">
      <div className="flex items-center gap-1.5 font-semibold">
        <FlaskConical className="size-3.5" aria-hidden /> Datos simulados
      </div>
      <p className="mt-1 text-amber-800/90">
        Inventario, compras, ventas y reportes usan datos de prueba hasta que el backend tenga sus endpoints.
      </p>
      <button
        type="button"
        onClick={() => setConfirm(true)}
        className="mt-2 inline-flex items-center gap-1 font-medium text-amber-900 underline-offset-2 hover:underline"
      >
        <RotateCcw className="size-3" aria-hidden /> Reiniciar datos
      </button>
      <ConfirmDialog
        open={confirm}
        title="Reiniciar datos simulados"
        message="Se borran las ventas, compras, movimientos y alertas simulados y se vuelve a generar el historial. El catálogo real y los usuarios no se tocan."
        confirmLabel="Reiniciar"
        loading={loading}
        onClose={() => setConfirm(false)}
        onConfirm={reset}
      />
    </div>
  )
}
