import { toast } from 'sonner'
import { ApiError } from '@/api/http'

/** Título según el tipo de fallo; el motivo concreto va en la descripción. */
function titleFor(error: unknown) {
  if (!(error instanceof ApiError)) return 'Algo salió mal'
  if (error.status === 0) return 'Sin conexión con el servidor'
  if (error.status === 401) return 'Tu sesión expiró'
  if (error.status === 403) return 'No tienes permiso'
  if (error.status === 404) return 'No se encontró el registro'
  if (error.status >= 500) return 'Error del servidor'
  return 'No se pudo completar la acción'
}

/** Motivo legible: el mensaje del backend y, si vienen, los errores por campo. */
function reasonFor(error: unknown) {
  if (!(error instanceof Error)) return 'Error desconocido.'
  const details = error instanceof ApiError && error.details ? Object.values(error.details).flat() : []
  const reason = [error.message, ...details].filter(Boolean).join(' · ')
  return /[.!?]$/.test(reason) ? reason : `${reason}.`
}

/**
 * Aviso de error con el porqué: "No se pudo guardar el producto" + "El SKU ya existe.".
 * `title` describe la acción que falló; si no se pasa, se deduce del tipo de error.
 */
export function notifyError(error: unknown, title?: string) {
  toast.error(title ?? titleFor(error), { description: reasonFor(error) })
}
