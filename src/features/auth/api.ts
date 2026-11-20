import { http } from '@/api/http'
import type { Guid, IsoDate } from '@/api/types'

/** Espejo de `AuthResponse`. */
export interface AuthResponse {
  accessToken: string
  accessTokenExpiresAt: IsoDate
  refreshToken: string
  refreshTokenExpiresAt: IsoDate
  userId: Guid
  username: string
  roles: string[]
  permissions: string[]
}

export interface LoginRequest {
  username: string
  password: string
}

export const authApi = {
  login: (body: LoginRequest) =>
    http.post<AuthResponse>('/auth/login', body, { skipAuthRefresh: true }).then((r) => r.data),

  refresh: (refreshToken: string) =>
    http
      .post<AuthResponse>('/auth/refresh', { refreshToken }, { skipAuthRefresh: true })
      .then((r) => r.data),

  /** `/auth/logout` exige estar autenticado: se pasa el access token explícito. */
  logout: (refreshToken: string, accessToken: string) =>
    http
      .post<void>(
        '/auth/logout',
        { refreshToken },
        { skipAuthRefresh: true, headers: { Authorization: `Bearer ${accessToken}` } },
      )
      .then(() => undefined),
}

declare module 'axios' {
  interface AxiosRequestConfig {
    /** No intentar renovar el token si esta petición responde 401 (login, refresh, logout). */
    skipAuthRefresh?: boolean
    /** Marca interna: la petición ya se reintentó tras renovar el token. */
    _retried?: boolean
  }
}
