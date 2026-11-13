import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import type { Guid } from '@/api/types'
import { inventoryKeys } from '@/features/inventory/queries'
import { salesKeys } from '@/features/sales/queries'
import { settingsApi, type BranchRequest, type CompanyRequest, type DocumentSeriesRequest, type EmailFilters, type WarehouseRequest } from './api'

export const settingsKeys = {
  company: ['settings', 'company'] as const,
  branches: ['settings', 'branches'] as const,
  warehouses: ['settings', 'warehouses'] as const,
  series: ['settings', 'series'] as const,
  paymentMethods: ['settings', 'payment-methods'] as const,
  emails: (f: EmailFilters) => ['settings', 'emails', f] as const,
}

export const useCompany = () => useQuery({ queryKey: settingsKeys.company, queryFn: settingsApi.company })
export const useBranches = () => useQuery({ queryKey: settingsKeys.branches, queryFn: settingsApi.branches })
export const useWarehouseDetails = () => useQuery({ queryKey: settingsKeys.warehouses, queryFn: settingsApi.warehouses })
export const useDocumentSeries = () => useQuery({ queryKey: settingsKeys.series, queryFn: settingsApi.documentSeries })
export const usePaymentMethodsAdmin = () => useQuery({ queryKey: settingsKeys.paymentMethods, queryFn: settingsApi.paymentMethods })

export function useEmails(filters: EmailFilters) {
  return useQuery({
    queryKey: settingsKeys.emails(filters),
    queryFn: () => settingsApi.emails(filters),
    placeholderData: keepPreviousData,
    // La bandeja cambia sola (el envío es en segundo plano): se refresca cada 10 s.
    refetchInterval: 10_000,
  })
}

/** Mutación que avisa y refresca los datos de configuración (y lo que dependa de ellos). */
function useSettingsMutation<T, R>(fn: (arg: T) => Promise<R>, message: string, extra: readonly (readonly string[])[] = []) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      toast.success(message)
      return Promise.all([qc.invalidateQueries({ queryKey: ['settings'] }), ...extra.map((queryKey) => qc.invalidateQueries({ queryKey }))])
    },
  })
}

export const useSaveCompany = () => useSettingsMutation((body: CompanyRequest) => settingsApi.updateCompany(body), 'Datos de la empresa guardados')

export const useSaveBranch = () =>
  useSettingsMutation(({ id, body }: { id?: Guid; body: BranchRequest }) => settingsApi.saveBranch(id, body), 'Sucursal guardada')

export const useSaveWarehouse = () =>
  useSettingsMutation(
    ({ id, body }: { id?: Guid; body: WarehouseRequest }) => settingsApi.saveWarehouse(id, body),
    'Almacén guardado',
    [inventoryKeys.warehouses],
  )

export const useCreateSeries = () =>
  useSettingsMutation((body: DocumentSeriesRequest) => settingsApi.createSeries(body), 'Serie creada')

export const useToggleSeries = () =>
  useSettingsMutation(({ id, isActive }: { id: Guid; isActive: boolean }) => settingsApi.setSeriesActive(id, isActive), 'Serie actualizada')

export const useUpdatePaymentMethod = () =>
  useSettingsMutation(
    ({ id, name, isActive }: { id: Guid; name: string; isActive: boolean }) => settingsApi.updatePaymentMethod(id, { name, isActive }),
    'Método de pago actualizado',
    [salesKeys.paymentMethods],
  )

export const useRetryEmail = () => useSettingsMutation((id: Guid) => settingsApi.retryEmail(id), 'Correo reencolado: se reintentará en unos segundos')

export function useChangePassword() {
  return useMutation({ mutationFn: settingsApi.changePassword, onSuccess: () => toast.success('Contraseña actualizada') })
}
