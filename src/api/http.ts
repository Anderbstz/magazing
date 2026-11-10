import axios, { AxiosError } from 'axios'

/**
 * Cliente HTTP único de la app. Todos los módulos de `features/*` llaman a la API por aquí.
 *
 * - En desarrollo `VITE_API_URL` queda vacío y Vite reenvía `/api` al backend.
 * - En producción apunta a la URL pública de la API en Render.
 */
export const http = axios.create({
  baseURL: `${import.meta.env.VITE_API_URL ?? ''}/api`,
  headers: { 'Content-Type': 'application/json' },
  // Render gratis tarda 30-50 s en despertar; damos margen antes de cortar.
  timeout: 60_000,
})

/** Error normalizado que la UI puede mostrar tal cual. */
export class ApiError extends Error {
  readonly status: number
  readonly details?: Record<string, string[]>
  /** Error original de axios: guarda la petición, por si hay que reintentarla. */
  readonly original?: AxiosError

  constructor(
    message: string,
    status: number,
    details?: Record<string, string[]>,
    original?: AxiosError,
  ) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.details = details
    this.original = original
  }
}

interface BackendErrorBody {
  // Formato actual del middleware: { error: "..." }
  error?: string
  // Formato ProblemDetails (por si el backend se migra): { title, detail, errors }
  title?: string
  detail?: string
  errors?: Record<string, string[]>
}

/** Convierte cualquier error de axios en un `ApiError` con un mensaje legible. */
export function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error

  if (error instanceof AxiosError) {
    if (error.code === 'ECONNABORTED') {
      return new ApiError('El servidor tardó demasiado en responder. Intenta de nuevo.', 0, undefined, error)
    }
    if (!error.response) {
      return new ApiError('No se pudo conectar con el servidor.', 0, undefined, error)
    }

    const { status, data } = error.response as { status: number; data?: BackendErrorBody }
    const message =
      data?.error ??
      data?.detail ??
      data?.title ??
      (status === 403
        ? 'No tienes permiso para realizar esta acción.'
        : status >= 500
          ? 'El servidor no está disponible en este momento. Intenta de nuevo en unos segundos.'
          : `Error ${status}`)

    return new ApiError(message, status, data?.errors, error)
  }

  return new ApiError(error instanceof Error ? error.message : 'Error desconocido', 0)
}

http.interceptors.response.use(undefined, (error) => Promise.reject(toApiError(error)))
