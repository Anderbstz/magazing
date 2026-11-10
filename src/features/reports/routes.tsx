import type { RouteObject } from 'react-router'
import { P } from '@/config/permissions'
import { RequirePermission } from '@/features/auth/guards'

export const reportsRoutes: RouteObject[] = [
  {
    element: <RequirePermission permission={P.ReportsRead} />,
    children: [
      {
        path: 'reports',
        lazy: async () => ({ Component: (await import('./pages/reports-page')).ReportsPage }),
      },
    ],
  },
  {
    // Ver la predicción y las alertas: inventario. Ejecutar y resolver tienen sus propios permisos.
    element: <RequirePermission permission={P.InventoryRead} />,
    children: [
      {
        path: 'forecast',
        lazy: async () => ({ Component: (await import('./pages/forecast-page')).ForecastPage }),
      },
    ],
  },
]
