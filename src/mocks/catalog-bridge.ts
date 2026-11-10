import { bypass } from 'msw'
import type { PagedResult } from '@/api/types'
import type { Product } from '@/features/catalog/api'
import { MockError } from './utils'

/**
 * El catálogo SÍ existe en el backend. Los módulos simulados (stock, ventas, compras…)
 * leen los productos reales para que los IDs, nombres y precios coincidan con tu base de datos.
 * `bypass` hace que esta petición salga al backend real en vez de pasar por los mocks.
 */
let cache: { at: number; token: string; products: Product[] } | null = null

export async function getRealProducts(token: string): Promise<Product[]> {
  if (cache && cache.token === token && Date.now() - cache.at < 30_000) return cache.products

  const products: Product[] = []
  for (let page = 1; page <= 20; page++) {
    const res = await fetch(
      bypass(new Request(`/api/products?page=${page}&pageSize=100`, { headers: { Authorization: `Bearer ${token}` } })),
    )
    if (!res.ok) {
      throw new MockError(
        502,
        'Los datos simulados necesitan el catálogo real: levanta el backend (dotnet run) e inicia sesión.',
      )
    }
    const data = (await res.json()) as PagedResult<Product>
    products.push(...data.items)
    if (page >= data.totalPages) break
  }

  cache = { at: Date.now(), token, products }
  return products
}

export async function getProductMap(token: string) {
  return new Map((await getRealProducts(token)).map((p) => [p.productId, p]))
}

export function invalidateProductCache() {
  cache = null
}
