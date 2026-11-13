import { Boxes, LayoutDashboard, Ruler, Tag, Tags, type LucideIcon } from 'lucide-react'
import { P, type Permission } from '@/config/permissions'

export interface NavItem {
  to: string
  label: string
  icon: LucideIcon
  /** Si se define, el ítem solo aparece para quien tenga el permiso. */
  permission?: Permission
}

export interface NavSection {
  title?: string
  items: NavItem[]
}

/**
 * Menú lateral. Cada rama `feature/*` agrega aquí su sección.
 * Los ítems sin permiso suficiente se ocultan solos.
 */
export const navigation: NavSection[] = [
  {
    items: [{ to: '/', label: 'Inicio', icon: LayoutDashboard }],
  },
  {
    title: 'Catálogo',
    items: [
      { to: '/catalog/products', label: 'Productos', icon: Boxes, permission: P.CatalogRead },
      { to: '/catalog/categories', label: 'Categorías', icon: Tags, permission: P.CatalogRead },
      { to: '/catalog/brands', label: 'Marcas', icon: Tag, permission: P.CatalogRead },
      { to: '/catalog/units', label: 'Unidades', icon: Ruler, permission: P.CatalogRead },
    ],
  },
]
