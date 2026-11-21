import type { RouteObject } from 'react-router'
import { P } from '@/config/permissions'
import { RequirePermission } from '@/features/auth/guards'

export const adminRoutes: RouteObject[] = [
  {
    element: <RequirePermission permission={P.UsersRead} />,
    children: [
      {
        path: 'admin/users',
        lazy: async () => ({ Component: (await import('./pages/users-page')).UsersPage }),
      },
      {
        path: 'admin/roles',
        lazy: async () => ({ Component: (await import('./pages/roles-page')).RolesPage }),
      },
    ],
  },
]
