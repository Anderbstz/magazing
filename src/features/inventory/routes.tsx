import type { RouteObject } from 'react-router'
import { P } from '@/config/permissions'
import { RequirePermission } from '@/features/auth/guards'

export const inventoryRoutes: RouteObject[] = [
  {
    element: <RequirePermission permission={P.InventoryRead} />,
    children: [
      {
        path: 'inventory/stock',
        lazy: async () => ({ Component: (await import('./pages/stock-page')).StockPage }),
      },
      {
        path: 'inventory/kardex',
        lazy: async () => ({ Component: (await import('./pages/kardex-page')).KardexPage }),
      },
      {
        path: 'inventory/transfers',
        lazy: async () => ({ Component: (await import('./pages/transfers-page')).TransfersPage }),
      },
    ],
  },
]
