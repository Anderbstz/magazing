import { http } from '@/api/http'
import type { Guid, IsoDate, PagedResult, PageParams } from '@/api/types'

// ── Tipos (espejo de DTOs/Users y DTOs/Roles) ─────────────────────────────────

export interface User {
  userId: Guid
  username: string
  email: string
  fullName: string
  branchId: Guid | null
  isActive: boolean
  emailConfirmed: boolean
  lastLoginAt: IsoDate | null
  createdAt: IsoDate
  /** Nombres de rol, no IDs. */
  roles: string[]
  /** Tiene una contraseña temporal sin cambiar (cuenta nueva o acceso reenviado). */
  mustChangePassword: boolean
  tempPasswordExpiresAt: IsoDate | null
}

/** Respuesta al crear una cuenta o reenviar el acceso: la contraseña temporal se ve una sola vez. */
export interface UserAccess {
  user: User
  temporaryPassword: string
  expiresAt: IsoDate
}

export interface CreateUserRequest {
  username: string
  email: string
  fullName: string
  branchId: Guid | null
  roleIds: Guid[]
}

export interface UpdateUserRequest {
  email: string
  fullName: string
  branchId: Guid | null
  isActive: boolean
}

export interface Role {
  roleId: Guid
  name: string
  description: string | null
  /** Códigos de permiso (`catalog.read`…), no IDs. */
  permissions: string[]
}

export interface PermissionItem {
  permissionId: Guid
  code: string
  module: string
  description: string | null
}

export interface CreateRoleRequest {
  name: string
  description: string | null
  permissionIds: Guid[]
}

// ── Llamadas ─────────────────────────────────────────────────────────────────

export const usersApi = {
  list: ({ page, pageSize, search }: PageParams) =>
    http
      .get<PagedResult<User>>('/users', { params: { page, pageSize, search: search || undefined } })
      .then((r) => r.data),
  create: (body: CreateUserRequest) => http.post<UserAccess>('/users', body).then((r) => r.data),
  resetAccess: (id: Guid) => http.post<UserAccess>(`/users/${id}/reset-access`).then((r) => r.data),
  update: (id: Guid, body: UpdateUserRequest) => http.put<User>(`/users/${id}`, body).then((r) => r.data),
  assignRoles: (id: Guid, roleIds: Guid[]) => http.put<User>(`/users/${id}/roles`, { roleIds }).then((r) => r.data),
}

export const rolesApi = {
  list: () => http.get<Role[]>('/roles').then((r) => r.data),
  permissions: () => http.get<PermissionItem[]>('/roles/permissions').then((r) => r.data),
  create: (body: CreateRoleRequest) => http.post<Role>('/roles', body).then((r) => r.data),
  updatePermissions: (id: Guid, permissionIds: Guid[]) =>
    http.put<Role>(`/roles/${id}/permissions`, { permissionIds }).then((r) => r.data),
}

/** Espejo de `SessionDto`: una sesión = un refresh token vigente (un navegador o equipo). */
export interface ActiveSession {
  sessionId: Guid
  userId: Guid
  username: string
  fullName: string
  ipAddress: string | null
  userAgent: string | null
  startedAt: IsoDate
  lastActivityAt: IsoDate
  expiresAt: IsoDate
}

export const sessionsApi = {
  list: () => http.get<ActiveSession[]>('/sessions').then((r) => r.data),
  revoke: (id: Guid) => http.delete<void>(`/sessions/${id}`).then(() => undefined),
  /** Cierra las sesiones sin actividad en las últimas `hours` horas (menos la propia). Devuelve cuántas cerró. */
  revokeInactive: (hours: number) =>
    http.post<{ revoked: number }>('/sessions/revoke-inactive', null, { params: { hours } }).then((r) => r.data.revoked),
}
