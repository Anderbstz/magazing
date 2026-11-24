import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import type { Guid, PageParams } from '@/api/types'
import { rolesApi, sessionsApi, usersApi, type CreateRoleRequest, type CreateUserRequest, type UpdateUserRequest } from './api'

export const adminKeys = {
  users: ['users'] as const,
  userList: (params: PageParams) => ['users', 'list', params] as const,
  roles: ['roles'] as const,
  permissions: ['permissions'] as const,
  sessions: ['sessions'] as const,
}

export function useUsers(params: PageParams) {
  return useQuery({
    queryKey: adminKeys.userList(params),
    queryFn: () => usersApi.list(params),
    placeholderData: keepPreviousData,
  })
}

export function useCreateUser() {
  const qc = useQueryClient()
  return useMutation({
    meta: { errorTitle: 'No se pudo crear el usuario' },
    mutationFn: (body: CreateUserRequest) => usersApi.create(body),
    onSuccess: () => {
      toast.success('Usuario creado: se le envió su acceso por correo')
      return qc.invalidateQueries({ queryKey: adminKeys.users })
    },
  })
}

/** Genera una nueva contraseña temporal y la envía por correo (la anterior deja de servir). */
export function useResetUserAccess() {
  const qc = useQueryClient()
  return useMutation({
    meta: { errorTitle: 'No se pudo reenviar el acceso' },
    mutationFn: (id: Guid) => usersApi.resetAccess(id),
    onSuccess: (access) => {
      toast.success(`Acceso reenviado a ${access.user.email}`)
      return qc.invalidateQueries({ queryKey: adminKeys.users })
    },
  })
}

/** Guarda datos y roles del usuario en una sola acción de la UI (son dos endpoints). */
export function useUpdateUser() {
  const qc = useQueryClient()
  return useMutation({
    meta: { errorTitle: 'No se pudo guardar el usuario' },
    mutationFn: async ({ id, body, roleIds }: { id: Guid; body: UpdateUserRequest; roleIds: Guid[] | null }) => {
      await usersApi.update(id, body)
      if (roleIds) await usersApi.assignRoles(id, roleIds)
    },
    onSuccess: () => {
      toast.success('Usuario actualizado')
    },
    // También si falló a medias (datos sí, roles no): la tabla debe reflejar lo que quedó guardado.
    onSettled: () => qc.invalidateQueries({ queryKey: adminKeys.users }),
  })
}

export function useRoles() {
  return useQuery({ queryKey: adminKeys.roles, queryFn: rolesApi.list })
}

export function usePermissions() {
  return useQuery({ queryKey: adminKeys.permissions, queryFn: rolesApi.permissions, staleTime: 10 * 60_000 })
}

export function useCreateRole() {
  const qc = useQueryClient()
  return useMutation({
    meta: { errorTitle: 'No se pudo crear el rol' },
    mutationFn: (body: CreateRoleRequest) => rolesApi.create(body),
    onSuccess: () => {
      toast.success('Rol creado')
      return qc.invalidateQueries({ queryKey: adminKeys.roles })
    },
  })
}

export function useUpdateRolePermissions() {
  const qc = useQueryClient()
  return useMutation({
    meta: { errorTitle: 'No se pudieron guardar los permisos' },
    mutationFn: ({ id, permissionIds }: { id: Guid; permissionIds: Guid[] }) =>
      rolesApi.updatePermissions(id, permissionIds),
    onSuccess: () => {
      toast.success('Permisos actualizados. Se aplican cuando cada usuario renueve su sesión.')
      return qc.invalidateQueries({ queryKey: adminKeys.roles })
    },
  })
}

export function useActiveSessions() {
  return useQuery({ queryKey: adminKeys.sessions, queryFn: sessionsApi.list, refetchInterval: 60_000 })
}

export function useRevokeSession() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: sessionsApi.revoke,
    meta: { errorTitle: 'No se pudo cerrar la sesión' },
    onSuccess: () => toast.success('Sesión cerrada', { description: 'Ese equipo tendrá que volver a iniciar sesión.' }),
    onSettled: () => qc.invalidateQueries({ queryKey: adminKeys.sessions }),
  })
}

export function useRevokeInactiveSessions() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: sessionsApi.revokeInactive,
    meta: { errorTitle: 'No se pudieron cerrar las sesiones' },
    onSuccess: (revoked) => toast.success(revoked === 1 ? 'Se cerró 1 sesión inactiva' : `Se cerraron ${revoked} sesiones inactivas`),
    onSettled: () => qc.invalidateQueries({ queryKey: adminKeys.sessions }),
  })
}
