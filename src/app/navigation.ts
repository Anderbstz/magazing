import {
  ArrowLeftRight,
  BarChart3,
  BrainCircuit,
  ClipboardList,
  Building2,
  Contact,
  FileText,
  Mail,
  Receipt,
  ShoppingCart,
  Boxes,
  KeyRound,
  LayoutDashboard,
  Ruler,
  ScrollText,
  Tag,
  Tags,
  Truck,
  Users,
  Warehouse,
  Store,
  type LucideIcon,
} from 'lucide-react'
import { P, type Permission } from '@/config/permissions'

export interface NavItem {
  to: string
  label: string
  icon: LucideIcon
  /** Si se define, el ítem solo aparece para quien tenga el permiso. */
  permission?: Permission
  /** Resaltar solo con la ruta exacta (cuando otra opción del menú cuelga de esta ruta). */
  end?: boolean
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
    items: [{ to: '/', label: 'Inicio', icon: LayoutDashboard, end: true }],
  },
  {
    title: 'Ventas',
    items: [
      { to: '/sales/pos', label: 'Punto de venta', icon: ShoppingCart, permission: P.SalesCreate },
      { to: '/sales', label: 'Ventas', icon: Receipt, permission: P.SalesRead, end: true },
      { to: '/sales/customers', label: 'Clientes', icon: Contact, permission: P.CustomersManage },
    ],
  },
  {
    title: 'Inventario',
    items: [
      { to: '/inventory/stock', label: 'Stock', icon: Warehouse, permission: P.InventoryRead },
      { to: '/inventory/kardex', label: 'Kardex', icon: ScrollText, permission: P.InventoryRead },
      { to: '/inventory/transfers', label: 'Transferencias', icon: ArrowLeftRight, permission: P.InventoryRead },
    ],
  },
  {
    title: 'Compras',
    items: [
      { to: '/purchases/orders', label: 'Órdenes de compra', icon: ClipboardList, permission: P.PurchasesRead },
      { to: '/purchases/suppliers', label: 'Proveedores', icon: Truck, permission: P.SuppliersManage },
    ],
  },
  {
    title: 'Análisis',
    items: [
      { to: '/reports', label: 'Reportes', icon: BarChart3, permission: P.ReportsRead },
      { to: '/forecast', label: 'Predicción y alertas', icon: BrainCircuit, permission: P.InventoryRead },
    ],
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
  {
    title: 'Administración',
    items: [
      { to: '/admin/users', label: 'Usuarios', icon: Users, permission: P.UsersRead },
      { to: '/admin/roles', label: 'Roles y permisos', icon: KeyRound, permission: P.UsersRead },
    ],
  },
  {
    title: 'Configuración',
    items: [
      { to: '/settings/company', label: 'Empresa y sucursales', icon: Building2, permission: P.UsersManage },
      { to: '/settings/warehouses', label: 'Almacenes', icon: Store, permission: P.WarehousesManage },
      { to: '/settings/documents', label: 'Comprobantes y pagos', icon: FileText, permission: P.UsersManage },
      { to: '/settings/emails', label: 'Correos', icon: Mail, permission: P.UsersManage },
    ],
  },
]
