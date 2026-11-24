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
  {
    element: <RequirePermission permission={P.UsersManage} />,
    children: [
      {
        path: 'admin/sessions',
        lazy: async () => ({ Component: (await import('./pages/sessions-page')).SessionsPage }),
      },
    ],
  },
]
