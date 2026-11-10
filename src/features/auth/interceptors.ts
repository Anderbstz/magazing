import { ApiError, http } from '@/api/http'
import { refreshSession, session } from './session'

let installed = false

/**
 * Conecta la sesión al cliente HTTP:
 * 1. Agrega `Authorization: Bearer <token>` a cada petición.
 * 2. Si la API responde 401, renueva el token una vez y repite la petición.
 */
export function installAuthInterceptors() {
  if (installed) return
  installed = true

  http.interceptors.request.use((config) => {
    const token = session.getAccessToken()
    if (token && !config.headers.has('Authorization')) {
      config.headers.set('Authorization', `Bearer ${token}`)
    }
    return config
  })

  http.interceptors.response.use(undefined, async (error: unknown) => {
    // `http.ts` ya convirtió el error en ApiError; el original trae la petición.
    if (!(error instanceof ApiError) || error.status !== 401) throw error

    const config = error.original?.config
    if (!config || config.skipAuthRefresh || config._retried) throw error

    const token = await refreshSession().catch((refreshError: unknown) => {
      if (refreshError instanceof ApiError && refreshError.status === 401) {
        throw new ApiError('Tu sesión expiró. Vuelve a iniciar sesión.', 401)
      }
      // Fallo de red o del servidor: se informa tal cual y la sesión se conserva.
      throw refreshError
    })

    config._retried = true
    config.headers.set('Authorization', `Bearer ${token}`)
    return http.request(config)
  })
}
