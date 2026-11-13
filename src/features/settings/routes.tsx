import type { RouteObject } from 'react-router'
import { P } from '@/config/permissions'
import { RequirePermission } from '@/features/auth/guards'

export const settingsRoutes: RouteObject[] = [
  // Cualquier usuario autenticado ve su perfil.
  { path: 'profile', lazy: async () => ({ Component: (await import('./pages/profile-page')).ProfilePage }) },
  {
    element: <RequirePermission permission={P.WarehousesManage} />,
    children: [{ path: 'settings/warehouses', lazy: async () => ({ Component: (await import('./pages/warehouses-page')).WarehousesPage }) }],
  },
  {
    // Configuración general: solo administradores (no hay un permiso más específico en el seed).
    element: <RequirePermission permission={P.UsersManage} />,
    children: [
      { path: 'settings/company', lazy: async () => ({ Component: (await import('./pages/company-page')).CompanyPage }) },
      { path: 'settings/documents', lazy: async () => ({ Component: (await import('./pages/documents-page')).DocumentsPage }) },
      { path: 'settings/emails', lazy: async () => ({ Component: (await import('./pages/emails-page')).EmailsPage }) },
    ],
  },
]
