import { createBrowserRouter } from 'react-router'
import { AppShell } from '@/components/layout/app-shell'
import { adminRoutes } from '@/features/admin/routes'
import { RequireAuth } from '@/features/auth/guards'
import { LoginPage } from '@/features/auth/pages/login-page'
import { catalogRoutes } from '@/features/catalog/routes'
import { DashboardPage } from '@/features/dashboard/dashboard-page'
import { inventoryRoutes } from '@/features/inventory/routes'
import { purchasesRoutes } from '@/features/purchases/routes'
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
          { index: true, element: <DashboardPage /> },
          ...catalogRoutes,
          ...inventoryRoutes,
          ...purchasesRoutes,
          ...adminRoutes,
          { path: '*', element: <NotFoundPage /> },
        ],
      },
    ],
  },
])
