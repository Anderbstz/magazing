import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import type { Guid, PageParams } from '@/api/types'
import { inventoryKeys } from '@/features/inventory/queries'
import { customersApi, salesApi, type CreateSaleRequest, type CustomerRequest, type SaleFilters } from './api'

export const salesKeys = {
  paymentMethods: ['payment-methods'] as const,
  customers: ['customers'] as const,
  customerList: (p: object) => ['customers', 'list', p] as const,
  sales: ['sales'] as const,
  saleList: (f: SaleFilters) => ['sales', 'list', f] as const,
  sale: (id: Guid) => ['sales', id] as const,
}

export function usePaymentMethods() {
  return useQuery({ queryKey: salesKeys.paymentMethods, queryFn: salesApi.paymentMethods, staleTime: 10 * 60_000 })
}

export function useCustomers(params: PageParams & { isActive?: boolean }, enabled = true) {
  return useQuery({
    queryKey: salesKeys.customerList(params),
    queryFn: () => customersApi.list(params),
    placeholderData: keepPreviousData,
    enabled,
  })
}

export function useSaveCustomer() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: { id?: Guid; body: CustomerRequest; isActive: boolean }) =>
      input.id ? customersApi.update(input.id, { ...input.body, isActive: input.isActive }) : customersApi.create(input.body),
    onSuccess: (_d, input) => {
      toast.success(input.id ? 'Cliente actualizado' : 'Cliente registrado')
      return qc.invalidateQueries({ queryKey: salesKeys.customers })
    },
  })
}

export function useSales(filters: SaleFilters) {
  return useQuery({ queryKey: salesKeys.saleList(filters), queryFn: () => salesApi.list(filters), placeholderData: keepPreviousData })
}

export function useSale(id: Guid | null) {
  return useQuery({ queryKey: salesKeys.sale(id ?? ''), queryFn: () => salesApi.get(id!), enabled: !!id })
}

/** Toda venta o anulación mueve stock: refresca ventas, inventario y reportes. */
function invalidateAfterSale(qc: ReturnType<typeof useQueryClient>) {
  return Promise.all([
    qc.invalidateQueries({ queryKey: salesKeys.sales }),
    qc.invalidateQueries({ queryKey: inventoryKeys.stock }),
    qc.invalidateQueries({ queryKey: ['reports'] }),
  ])
}

export function useCreateSale() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: CreateSaleRequest) => salesApi.create(body),
    // El punto de venta muestra el error en su propio panel.
    meta: { silent: true },
    onSuccess: () => invalidateAfterSale(qc),
  })
}

export function useCancelSale() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, reason }: { id: Guid; reason: string }) => salesApi.cancel(id, reason),
    onSuccess: (sale) => {
      toast.success(`${sale.fullNumber} anulada: el stock volvió al almacén`)
      qc.setQueryData(salesKeys.sale(sale.saleId), sale)
      return invalidateAfterSale(qc)
    },
  })
}
