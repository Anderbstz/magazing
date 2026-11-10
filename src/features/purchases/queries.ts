import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import type { Guid, PageParams } from '@/api/types'
import { inventoryKeys } from '@/features/inventory/queries'
import {
  purchaseOrdersApi,
  suppliersApi,
  type PurchaseOrderFilters,
  type PurchaseOrderRequest,
  type SupplierRequest,
} from './api'

export const purchaseKeys = {
  suppliers: ['suppliers'] as const,
  supplierList: (p: object) => ['suppliers', 'list', p] as const,
  orders: ['purchase-orders'] as const,
  orderList: (f: PurchaseOrderFilters) => ['purchase-orders', 'list', f] as const,
  order: (id: Guid) => ['purchase-orders', id] as const,
}

export function useSuppliers(params: PageParams & { isActive?: boolean }) {
  return useQuery({
    queryKey: purchaseKeys.supplierList(params),
    queryFn: () => suppliersApi.list(params),
    placeholderData: keepPreviousData,
  })
}

export function useSaveSupplier() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: { id?: Guid; body: SupplierRequest; isActive: boolean }) =>
      input.id ? suppliersApi.update(input.id, { ...input.body, isActive: input.isActive }) : suppliersApi.create(input.body),
    onSuccess: (_d, input) => {
      toast.success(input.id ? 'Proveedor actualizado' : 'Proveedor creado')
      return qc.invalidateQueries({ queryKey: purchaseKeys.suppliers })
    },
  })
}

export function usePurchaseOrders(filters: PurchaseOrderFilters) {
  return useQuery({
    queryKey: purchaseKeys.orderList(filters),
    queryFn: () => purchaseOrdersApi.list(filters),
    placeholderData: keepPreviousData,
  })
}

export function usePurchaseOrder(id: Guid | undefined) {
  return useQuery({
    queryKey: purchaseKeys.order(id ?? ''),
    queryFn: () => purchaseOrdersApi.get(id!),
    enabled: !!id,
  })
}

export function useSavePurchaseOrder() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: { id?: Guid; body: PurchaseOrderRequest }) =>
      input.id ? purchaseOrdersApi.update(input.id, input.body) : purchaseOrdersApi.create(input.body),
    onSuccess: (po, input) => {
      toast.success(input.id ? 'Orden actualizada' : `Orden ${po.code} creada en borrador`)
      return qc.invalidateQueries({ queryKey: purchaseKeys.orders })
    },
  })
}

type Transition = 'approve' | 'receive' | 'cancel'

const MESSAGES: Record<Transition, string> = {
  approve: 'Orden aprobada',
  receive: 'Mercadería recibida: el stock y el costo promedio se actualizaron',
  cancel: 'Orden cancelada',
}

export function usePurchaseTransition() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, action }: { id: Guid; action: Transition }) => purchaseOrdersApi[action](id),
    onSuccess: (po, { action }) => {
      toast.success(MESSAGES[action])
      qc.setQueryData(purchaseKeys.order(po.purchaseOrderId), po)
      return Promise.all([
        qc.invalidateQueries({ queryKey: purchaseKeys.orders }),
        // Recibir mueve stock: refresca inventario y kardex.
        action === 'receive' ? qc.invalidateQueries({ queryKey: inventoryKeys.stock }) : undefined,
      ])
    },
  })
}
