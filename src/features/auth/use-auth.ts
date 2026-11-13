import { useCallback, useSyncExternalStore } from 'react'
import type { Permission } from '@/config/permissions'
import { session } from './session'

export function useSession() {
  return useSyncExternalStore(session.subscribe, session.getState)
}

/** `can('catalog.manage')` → true si el usuario tiene ese permiso. */
export function useCan() {
  const { user } = useSession()
  return useCallback(
    (permission: Permission | Permission[]) => {
      if (!user) return false
      const required = Array.isArray(permission) ? permission : [permission]
      return required.every((p) => user.permissions.includes(p))
    },
    [user],
  )
}
