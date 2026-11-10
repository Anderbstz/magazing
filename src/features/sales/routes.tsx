import type { RouteObject } from 'react-router'
import { P } from '@/config/permissions'
import { RequirePermission } from '@/features/auth/guards'

export const salesRoutes: RouteObject[] = [
  {
    element: <RequirePermission permission={P.SalesCreate} />,
    children: [
      {
        path: 'sales/pos',
        lazy: async () => ({ Component: (await import('./pages/pos-page')).PosPage }),
      },
    ],
  },
  {
    element: <RequirePermission permission={P.SalesRead} />,
    children: [
      {
        path: 'sales',
        lazy: async () => ({ Component: (await import('./pages/sales-page')).SalesPage }),
      },
    ],
  },
  {
    element: <RequirePermission permission={P.CustomersManage} />,
    children: [
      {
        path: 'sales/customers',
        lazy: async () => ({ Component: (await import('./pages/customers-page')).CustomersPage }),
      },
    ],
  },
]
