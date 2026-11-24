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

    // Validación automática de ASP.NET: viene en inglés ("The Password field is required."),
    // así que se traduce a un motivo corto en español en vez de mostrarla tal cual.
    if (data?.errors && Object.keys(data.errors).length > 0 && !data.error) {
      return new ApiError(describeValidation(data.errors), status, undefined, error)
    }

    const message =
      data?.error ??
      data?.detail ??
      data?.title ??
      (status === 403
        ? 'No tienes permiso para realizar esta acción.'
        : status === 404 || status === 405
          ? 'El servidor todavía no tiene esta función. Puede que esté desactualizado; intenta más tarde.'
        : status >= 500
          ? 'El servidor no está disponible en este momento. Intenta de nuevo en unos segundos.'
          : `Error ${status}`)

    return new ApiError(message, status, data?.errors, error)
  }

  return new ApiError(error instanceof Error ? error.message : 'Error desconocido', 0)
}

const FIELD_LABELS: Record<string, string> = {
  username: 'el usuario',
  password: 'la contraseña',
  currentpassword: 'la contraseña actual',
  newpassword: 'la nueva contraseña',
  email: 'el correo',
  fullname: 'el nombre completo',
  roleids: 'los roles',
  name: 'el nombre',
  sku: 'el SKU',
  price: 'el precio',
  quantity: 'la cantidad',
  unitcost: 'el costo unitario',
  items: 'los ítems',
  idtoken: 'la cuenta de Google',
}

function fieldLabel(field: string) {
  const key = field.replace(/^\$\.?/, '').replace(/\[\d+\]/g, '').split('.').pop() ?? ''
  return FIELD_LABELS[key.toLowerCase()] ?? (key ? `el campo «${key.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase()}»` : '')
}

/** "The Password field is required." → "Revisa los datos: falta la contraseña." */
function describeValidation(errors: Record<string, string[]>) {
  const parts = Object.entries(errors).map(([field, messages]) => {
    const label = fieldLabel(field)
    const text = messages.join(' ')
    if (!label || field.toLowerCase() === 'request') return 'faltan datos en la solicitud'
    if (/required/i.test(text)) return `falta ${label}`
    if (/could not be converted|not a valid|invalid/i.test(text)) return `${label} tiene un formato inválido`
    if (/maximum length|too long/i.test(text)) return `${label} es demasiado largo`
    if (/minimum length|too short/i.test(text)) return `${label} es demasiado corto`
    return `revisa ${label}`
  })
  return `Revisa los datos: ${[...new Set(parts)].join(', ')}.`
}

http.interceptors.response.use(undefined, (error) => Promise.reject(toApiError(error)))
