import type { RouteObject } from 'react-router'
import { P } from '@/config/permissions'
import { RequirePermission } from '@/features/auth/guards'

/** Rutas del catálogo. Cada página se descarga solo cuando se visita. */
export const catalogRoutes: RouteObject[] = [
  {
    element: <RequirePermission permission={P.CatalogRead} />,
    children: [
      {
        path: 'catalog/products',
        lazy: async () => ({ Component: (await import('./pages/products-page')).ProductsPage }),
      },
      {
        path: 'catalog/categories',
        lazy: async () => ({ Component: (await import('./pages/categories-page')).CategoriesPage }),
      },
      {
        path: 'catalog/brands',
        lazy: async () => ({ Component: (await import('./pages/brands-page')).BrandsPage }),
      },
      {
        path: 'catalog/units',
        lazy: async () => ({ Component: (await import('./pages/units-page')).UnitsPage }),
      },
    ],
  },
]
