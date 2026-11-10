import { ApiError } from '@/api/http'
import type { Guid } from '@/api/types'
import { authApi, type AuthResponse } from './api'

/**
 * Sesión del usuario, fuera de React para que el cliente HTTP también la use.
 *
 * - El access token vive solo en memoria (se pierde al recargar).
 * - El refresh token y los datos del usuario van a localStorage para sobrevivir a la recarga.
 *   Con cookies httpOnly sería más seguro, pero exige cambiar el backend (ver roadmap).
 */
export interface SessionUser {
  userId: Guid
  username: string
  roles: string[]
  permissions: string[]
}

export type SessionStatus = 'loading' | 'authenticated' | 'anonymous'

export interface SessionState {
  status: SessionStatus
  user: SessionUser | null
}

const STORAGE_KEY = 'magazing.session'

interface StoredSession {
  refreshToken: string
  user: SessionUser
}

function readStorage(): StoredSession | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as StoredSession) : null
  } catch {
    return null
  }
}

function writeStorage(value: StoredSession | null) {
  try {
    if (value) localStorage.setItem(STORAGE_KEY, JSON.stringify(value))
    else localStorage.removeItem(STORAGE_KEY)
  } catch {
    // Modo privado o almacenamiento bloqueado: la sesión dura lo que dure la pestaña.
  }
}

const stored = readStorage()

let accessToken: string | null = null
let refreshToken: string | null = stored?.refreshToken ?? null
let state: SessionState = {
  // Si hay refresh token guardado, falta renovar el access token antes de saber si hay sesión.
  status: stored ? 'loading' : 'anonymous',
  user: stored?.user ?? null,
}

const listeners = new Set<() => void>()

function setState(next: SessionState) {
  state = next
  listeners.forEach((listener) => listener())
}

export const session = {
  getState: () => state,
  getAccessToken: () => accessToken,
  getRefreshToken: () => refreshToken,

  subscribe(listener: () => void) {
    listeners.add(listener)
    return () => listeners.delete(listener)
  },

  /** Guarda la respuesta de login o refresh. */
  start(response: AuthResponse) {
    const user: SessionUser = {
      userId: response.userId,
      username: response.username,
      roles: response.roles,
      permissions: response.permissions,
    }
    accessToken = response.accessToken
    refreshToken = response.refreshToken
    writeStorage({ refreshToken: response.refreshToken, user })
    setState({ status: 'authenticated', user })
  },

  clear() {
    accessToken = null
    refreshToken = null
    writeStorage(null)
    setState({ status: 'anonymous', user: null })
  },
}

let refreshing: Promise<string> | null = null

/**
 * Pide un access token nuevo con el refresh token.
 * Si varias peticiones fallan con 401 a la vez, todas esperan la misma renovación:
 * el backend rota el refresh token, así que dos renovaciones en paralelo harían fallar la segunda.
 */
export function refreshSession(): Promise<string> {
  if (refreshing) return refreshing

  const token = refreshToken
  if (!token) {
    session.clear()
    return Promise.reject(new Error('No hay sesión activa.'))
  }

  refreshing = authApi
    .refresh(token)
    .then((response) => {
      session.start(response)
      return response.accessToken
    })
    .catch((error) => {
      // Solo un 401 significa que el refresh token ya no sirve. Un corte de red, un 5xx
      // o un fallo pasajero de la BD no deben sacar al usuario: el token sigue siendo válido.
      if (error instanceof ApiError && error.status === 401) session.clear()
      throw error
    })
    .finally(() => {
      refreshing = null
    })

  return refreshing
}

export async function logout() {
  const token = refreshToken
  // Se limpia primero: aunque el backend falle, el usuario queda fuera en este navegador.
  const bearer = accessToken
  session.clear()
  if (token && bearer) {
    await authApi.logout(token, bearer).catch(() => undefined)
  }
}
