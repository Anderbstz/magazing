import type { MovementCode, TransferStatus } from './api'

export const MOVEMENT_LABELS: Record<MovementCode, string> = {
  INITIAL: 'Saldo inicial',
  PURCHASE_IN: 'Compra',
  SALE_OUT: 'Venta',
  TRANSFER_IN: 'Transf. entrada',
  TRANSFER_OUT: 'Transf. salida',
  ADJUST_IN: 'Ajuste +',
  ADJUST_OUT: 'Ajuste −',
  SALE_CANCEL_IN: 'Anulación venta',
}

export const TRANSFER_STATUS: Record<TransferStatus, { label: string; tone: 'warning' | 'success' | 'neutral' }> = {
  PENDING: { label: 'Pendiente', tone: 'warning' },
  COMPLETED: { label: 'Completada', tone: 'success' },
  CANCELLED: { label: 'Cancelada', tone: 'neutral' },
}
