/**
 * Espejo de `Magazing.Application.Security.Permissions` y del seed de `permissions`.
 * Si se agrega un permiso en el backend, se agrega aquí también.
 */
export const P = {
  UsersRead: 'users.read',
  UsersManage: 'users.manage',

  CatalogRead: 'catalog.read',
  CatalogManage: 'catalog.manage',
  PricesManage: 'prices.manage',

  InventoryRead: 'inventory.read',
  InventoryAdjust: 'inventory.adjust',
  TransfersManage: 'transfers.manage',
  WarehousesManage: 'warehouses.manage',

  SuppliersManage: 'suppliers.manage',
  PurchasesRead: 'purchases.read',
  PurchasesCreate: 'purchases.create',
  PurchasesApprove: 'purchases.approve',
  PurchasesReceive: 'purchases.receive',

  CustomersManage: 'customers.manage',
  SalesRead: 'sales.read',
  SalesCreate: 'sales.create',
  SalesCancel: 'sales.cancel',

  ReportsRead: 'reports.read',
  AlertsManage: 'alerts.manage',
  PredictionsRun: 'predictions.run',
} as const

export type Permission = (typeof P)[keyof typeof P]

/** Nombre legible de cada módulo (columna `permissions.module`). */
export const MODULE_LABELS: Record<string, string> = {
  security: 'Seguridad',
  catalog: 'Catálogo',
  inventory: 'Inventario',
  purchases: 'Compras',
  sales: 'Ventas',
  reports: 'Reportes',
  ml: 'Predicción y alertas',
}
