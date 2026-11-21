import { createBrowserRouter } from 'react-router'
import { AppShell } from '@/components/layout/app-shell'
import { adminRoutes } from '@/features/admin/routes'
import { RequireAuth } from '@/features/auth/guards'
import { LoginPage } from '@/features/auth/pages/login-page'
import { catalogRoutes } from '@/features/catalog/routes'
import { inventoryRoutes } from '@/features/inventory/routes'
import { purchasesRoutes } from '@/features/purchases/routes'
import { reportsRoutes } from '@/features/reports/routes'
import { salesRoutes } from '@/features/sales/routes'
import { settingsRoutes } from '@/features/settings/routes'
import { NotFoundPage } from './not-found-page'

/**
 * Rutas de la app. Cada rama `feature/*` agrega las rutas de su módulo dentro de `AppShell`.
 */
export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  {
    element: <RequireAuth />,
    children: [
      {
        element: <AppShell />,
        children: [
          {
            index: true,
            lazy: async () => ({ Component: (await import('@/features/dashboard/dashboard-page')).DashboardPage }),
          },
          ...catalogRoutes,
          ...salesRoutes,
          ...inventoryRoutes,
          ...purchasesRoutes,
          ...reportsRoutes,
          ...adminRoutes,
          ...settingsRoutes,
          { path: '*', element: <NotFoundPage /> },
        ],
      },
    ],
  },
])
