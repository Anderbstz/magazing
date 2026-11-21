import type { PurchaseStatus } from './api'

export const PURCHASE_STATUS: Record<PurchaseStatus, { label: string; tone: 'neutral' | 'info' | 'success' | 'danger' }> = {
  DRAFT: { label: 'Borrador', tone: 'neutral' },
  APPROVED: { label: 'Aprobada', tone: 'info' },
  RECEIVED: { label: 'Recibida', tone: 'success' },
  CANCELLED: { label: 'Cancelada', tone: 'danger' },
}
