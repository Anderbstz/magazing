import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import type { Guid, PageParams } from '@/api/types'
import { rolesApi, usersApi, type CreateRoleRequest, type CreateUserRequest, type UpdateUserRequest } from './api'

export const adminKeys = {
  users: ['users'] as const,
  userList: (params: PageParams) => ['users', 'list', params] as const,
  roles: ['roles'] as const,
  permissions: ['permissions'] as const,
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
    mutationFn: (body: CreateUserRequest) => usersApi.create(body),
    onSuccess: () => {
      toast.success('Usuario creado')
      return qc.invalidateQueries({ queryKey: adminKeys.users })
    },
  })
}

/** Guarda datos y roles del usuario en una sola acción de la UI (son dos endpoints). */
export function useUpdateUser() {
  const qc = useQueryClient()
  return useMutation({
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
    mutationFn: ({ id, permissionIds }: { id: Guid; permissionIds: Guid[] }) =>
      rolesApi.updatePermissions(id, permissionIds),
    onSuccess: () => {
      toast.success('Permisos actualizados. Se aplican cuando cada usuario renueve su sesión.')
      return qc.invalidateQueries({ queryKey: adminKeys.roles })
    },
  })
}
