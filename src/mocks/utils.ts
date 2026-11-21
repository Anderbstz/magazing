import { HttpResponse, delay } from 'msw'
import type { PagedResult } from '@/api/types'

/** Error con el mismo formato que el middleware del backend: `{ "error": "..." }`. */
export class MockError extends Error {
  readonly status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

export const badRequest = (message: string) => new MockError(400, message)
export const notFound = (what: string) => new MockError(404, `${what} no encontrado.`)

/**
 * Envuelve un resolver: simula latencia, exige sesión y traduce `MockError` a respuesta.
 * El token no se valida (eso lo hace el backend real); solo se exige que exista.
 */
export function handle<T>(resolver: (ctx: { request: Request; user: MockUser }) => Promise<T> | T, status = 200) {
  return async ({ request }: { request: Request }) => {
    await delay(150 + Math.random() * 250)
    const user = userFromRequest(request)
    if (!user) return HttpResponse.json({ error: 'No autenticado.' }, { status: 401 })
    try {
      const result = await resolver({ request, user })
      if (result === undefined) return new HttpResponse(null, { status: 204 })
      return HttpResponse.json(result as never, { status })
    } catch (error) {
      if (error instanceof MockError) return HttpResponse.json({ error: error.message }, { status: error.status })
      console.error('[mocks]', error)
      return HttpResponse.json({ error: 'Ocurrio un error inesperado.' }, { status: 500 })
    }
  }
}

export interface MockUser {
  userId: string
  username: string
  token: string
}

/** Lee `sub` y `unique_name` del JWT sin verificar la firma. */
function userFromRequest(request: Request): MockUser | null {
  const header = request.headers.get('Authorization')
  if (!header?.startsWith('Bearer ')) return null
  const token = header.slice(7)
  try {
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')))
    return { userId: payload.sub, username: payload.unique_name ?? 'usuario', token }
  } catch {
    return null
  }
}

export function query(request: Request) {
  const params = new URL(request.url).searchParams
  return {
    str: (key: string) => params.get(key) || undefined,
    int: (key: string, fallback: number) => {
      const v = Number(params.get(key))
      return Number.isFinite(v) && v > 0 ? Math.floor(v) : fallback
    },
    bool: (key: string) => (params.has(key) ? params.get(key) === 'true' : undefined),
  }
}

/** Pagina igual que `GenericRepository.GetPagedAsync` (máximo 100 por página). */
export function paginate<T>(items: T[], page: number, pageSize: number): PagedResult<T> {
  const size = Math.min(Math.max(pageSize, 1), 100)
  const totalCount = items.length
  return {
    items: items.slice((page - 1) * size, page * size),
    page,
    pageSize: size,
    totalCount,
    totalPages: Math.ceil(totalCount / size),
  }
}

export const contains = (value: string | null | undefined, search: string | undefined) =>
  !search || (value ?? '').toLowerCase().includes(search.toLowerCase())

export const newId = () => crypto.randomUUID()

export const nowIso = () => new Date().toISOString()

/** Generador pseudoaleatorio con semilla: el historial simulado sale igual en cada reinicio. */
export function seededRandom(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
