import { LayoutDashboard, type LucideIcon } from 'lucide-react'
import type { Permission } from '@/config/permissions'

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
]
