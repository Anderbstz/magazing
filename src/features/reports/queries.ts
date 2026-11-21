import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import type { Guid } from '@/api/types'
import { reportsApi, type AlertStatus, type GroupBy } from './api'

export const reportKeys = {
  all: ['reports'] as const,
  dashboard: ['reports', 'dashboard'] as const,
  sales: (p: object) => ['reports', 'sales', p] as const,
  top: (p: object) => ['reports', 'top', p] as const,
  forecast: (productId: Guid) => ['reports', 'forecast', productId] as const,
  alerts: (status?: AlertStatus) => ['reports', 'alerts', status ?? 'all'] as const,
}

export function useDashboard(enabled = true) {
  return useQuery({ queryKey: reportKeys.dashboard, queryFn: reportsApi.dashboard, enabled, refetchInterval: 60_000 })
}

export function useSalesReport(params: { from: string; to: string; groupBy: GroupBy }) {
  return useQuery({ queryKey: reportKeys.sales(params), queryFn: () => reportsApi.sales(params), placeholderData: keepPreviousData })
}

export function useTopProducts(params: { from: string; to: string; limit?: number }) {
  return useQuery({ queryKey: reportKeys.top(params), queryFn: () => reportsApi.topProducts(params), placeholderData: keepPreviousData })
}

export function useForecast(productId: Guid | null) {
  return useQuery({ queryKey: reportKeys.forecast(productId ?? ''), queryFn: () => reportsApi.forecast(productId!), enabled: !!productId })
}

export function useAlerts(status?: AlertStatus) {
  return useQuery({ queryKey: reportKeys.alerts(status), queryFn: () => reportsApi.alerts(status) })
}

export function useRunPredictions() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: reportsApi.runPredictions,
    onSuccess: (r) => {
      toast.success(r.created ? `Predicción lista: ${r.created} alertas nuevas` : 'Predicción lista: sin alertas nuevas')
      return qc.invalidateQueries({ queryKey: reportKeys.all })
    },
  })
}

export function useAlertAction() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, action }: { id: Guid; action: 'acknowledge' | 'resolve' }) => reportsApi[action](id),
    onSuccess: (_a, { action }) => {
      toast.success(action === 'resolve' ? 'Alerta resuelta' : 'Alerta marcada como vista')
      return qc.invalidateQueries({ queryKey: reportKeys.all })
    },
  })
}
