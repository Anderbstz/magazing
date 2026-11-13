import { getRealProducts } from './catalog-bridge'
import { getDb } from './db'
import type { MockUser } from './utils'

/** `*` delante: coincide con la API aunque `VITE_API_URL` apunte a otro origen. */
export const api = (path: string) => `*/api${path}`

/** Productos reales + BD simulada ya sembrada con ellos. */
export async function context(user: MockUser) {
  const products = await getRealProducts(user.token)
  const d = getDb(products)
  return { d, products, productMap: new Map(products.map((p) => [p.productId, p])) }
}
