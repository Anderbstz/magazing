/**
 * Contrato del asistente con la API .NET (`POST /api/assistant/chat`).
 * El asistente consulta con herramientas de solo lectura y, para crear algo, devuelve una
 * propuesta: se guarda recién cuando el usuario la confirma (con los endpoints de siempre).
 */
import { http } from '@/api/http'
import type { CreateProductRequest } from '@/features/catalog/api'
import type { PurchaseOrderRequest } from '@/features/purchases/api'

export interface AssistantMessage {
  role: 'user' | 'assistant'
  content: string
}

export type AssistantProposal =
  | { kind: 'create_product'; title: string; lines: string[]; request: CreateProductRequest }
  | { kind: 'create_purchase_order'; title: string; lines: string[]; request: PurchaseOrderRequest }

export interface AssistantReply {
  message: string
  proposal: AssistantProposal | null
  toolsUsed: string[]
}

export const assistantApi = {
  // El modelo puede tardar: más margen que el resto de llamadas.
  chat: (messages: AssistantMessage[]) =>
    http.post<AssistantReply>('/assistant/chat', { messages }, { timeout: 90_000 }).then((r) => r.data),
}
