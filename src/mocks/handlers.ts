import { http, HttpResponse, type AnyHandler } from 'msw'
import { inventoryHandlers } from '@/features/inventory/mocks'
import { purchasesHandlers } from '@/features/purchases/mocks'
import { invalidateProductCache } from './catalog-bridge'
import { api } from './context'
import { resetDb } from './db'

/**
 * Endpoints simulados. Cada rama `feature/*` agrega los de su módulo.
 * Lo que no esté aquí sale al backend real (`onUnhandledRequest: 'bypass'`).
 *
 * Cuando el backend implemente un endpoint, se borra su handler y el frontend no cambia.
 */
export const handlers: AnyHandler[] = [
  http.post(api('/_mocks/reset'), () => {
    resetDb()
    invalidateProductCache()
    return new HttpResponse(null, { status: 204 })
  }),
  ...inventoryHandlers,
  ...purchasesHandlers,
]
