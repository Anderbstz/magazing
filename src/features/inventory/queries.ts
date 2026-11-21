import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import type { Guid, PageParams } from '@/api/types'
import {
  inventoryApi,
  type AdjustmentRequest,
  type CreateTransferRequest,
  type MovementFilters,
  type StockFilters,
  type TransferStatus,
} from './api'

export const inventoryKeys = {
  warehouses: ['warehouses'] as const,
  /** Todo lo que cambia cuando se mueve stock: se invalida junto. */
  stock: ['stock'] as const,
  stocks: (f: StockFilters) => ['stock', 'list', f] as const,
  summary: (warehouseId: Guid) => ['stock', 'summary', warehouseId] as const,
  movements: (f: MovementFilters) => ['stock', 'movements', f] as const,
  transfers: ['transfers'] as const,
  transferList: (p: object) => ['transfers', 'list', p] as const,
  transfer: (id: Guid) => ['transfers', id] as const,
}

export function useWarehouses() {
  return useQuery({ queryKey: inventoryKeys.warehouses, queryFn: inventoryApi.warehouses, staleTime: 5 * 60_000 })
}

export function useStocks(filters: StockFilters | null) {
  return useQuery({
    queryKey: inventoryKeys.stocks(filters!),
    queryFn: () => inventoryApi.stocks(filters!),
    enabled: !!filters,
    placeholderData: keepPreviousData,
  })
}

export function useStockSummary(warehouseId: Guid | undefined) {
  return useQuery({
    queryKey: inventoryKeys.summary(warehouseId ?? ''),
    queryFn: () => inventoryApi.stockSummary(warehouseId!),
    enabled: !!warehouseId,
  })
}

export function useMovements(filters: MovementFilters, enabled = true) {
  return useQuery({
    queryKey: inventoryKeys.movements(filters),
    queryFn: () => inventoryApi.movements(filters),
    enabled,
    placeholderData: keepPreviousData,
  })
}

export function useAdjustStock() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: AdjustmentRequest) => inventoryApi.adjust(body),
    onSuccess: () => {
      toast.success('Ajuste registrado en el kardex')
      return qc.invalidateQueries({ queryKey: inventoryKeys.stock })
    },
  })
}

export function useTransfers(params: PageParams & { status?: TransferStatus }) {
  return useQuery({
    queryKey: inventoryKeys.transferList(params),
    queryFn: () => inventoryApi.transfers(params),
    placeholderData: keepPreviousData,
  })
}

export function useTransfer(id: Guid | null) {
  return useQuery({
    queryKey: inventoryKeys.transfer(id ?? ''),
    queryFn: () => inventoryApi.transfer(id!),
    enabled: !!id,
  })
}

function useTransferMutation<T, R>(fn: (arg: T) => Promise<R>, message: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      toast.success(message)
      return Promise.all([
        qc.invalidateQueries({ queryKey: inventoryKeys.transfers }),
        qc.invalidateQueries({ queryKey: inventoryKeys.stock }),
      ])
    },
  })
}

export const useCreateTransfer = () =>
  useTransferMutation((body: CreateTransferRequest) => inventoryApi.createTransfer(body), 'Transferencia creada')
export const useCompleteTransfer = () =>
  useTransferMutation((id: Guid) => inventoryApi.completeTransfer(id), 'Transferencia completada: el stock ya se movió')
export const useCancelTransfer = () =>
  useTransferMutation((id: Guid) => inventoryApi.cancelTransfer(id), 'Transferencia cancelada')
