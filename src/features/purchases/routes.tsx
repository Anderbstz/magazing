import type { RouteObject } from 'react-router'
import { P } from '@/config/permissions'
import { RequirePermission } from '@/features/auth/guards'

export const purchasesRoutes: RouteObject[] = [
  {
    element: <RequirePermission permission={P.SuppliersManage} />,
    children: [
      {
        path: 'purchases/suppliers',
        lazy: async () => ({ Component: (await import('./pages/suppliers-page')).SuppliersPage }),
      },
    ],
  },
  {
    element: <RequirePermission permission={P.PurchasesRead} />,
    children: [
      {
        path: 'purchases/orders',
        lazy: async () => ({ Component: (await import('./pages/purchase-orders-page')).PurchaseOrdersPage }),
      },
      {
        path: 'purchases/orders/:id',
        lazy: async () => ({ Component: (await import('./pages/purchase-order-page')).PurchaseOrderPage }),
      },
    ],
  },
  {
    element: <RequirePermission permission={P.PurchasesCreate} />,
    children: [
      {
        path: 'purchases/orders/new',
        lazy: async () => ({ Component: (await import('./pages/purchase-order-form-page')).PurchaseOrderFormPage }),
      },
      {
        path: 'purchases/orders/:id/edit',
        lazy: async () => ({ Component: (await import('./pages/purchase-order-form-page')).PurchaseOrderFormPage }),
      },
    ],
  },
]
