import { http } from '@/api/http'
import type { Guid, IsoDate, PagedResult, PageParams } from '@/api/types'

// ── Tipos (espejo de los DTO de Magazing.Application/DTOs/Catalog) ──────────────

export interface Product {
  productId: Guid
  sku: string
  barcode: string | null
  name: string
  description: string | null
  categoryId: Guid
  categoryName: string
  brandId: Guid | null
  brandName: string | null
  unitId: Guid
  unitCode: string
  isTaxable: boolean
  minStock: number
  maxStock: number | null
  averageCost: number
  currentPrice: number | null
  imageUrl: string | null
  isActive: boolean
  createdAt: IsoDate
  updatedAt: IsoDate | null
}

export interface ProductPrice {
  productPriceId: Guid
  price: number
  validFrom: IsoDate
  validTo: IsoDate | null
  isCurrent: boolean
  createdBy: Guid | null
}

export interface CreateProductRequest {
  sku: string
  barcode: string | null
  name: string
  description: string | null
  categoryId: Guid
  brandId: Guid | null
  unitId: Guid
  isTaxable: boolean
  minStock: number
  maxStock: number | null
  price: number
  imageUrl: string | null
}

export type UpdateProductRequest = Omit<CreateProductRequest, 'sku' | 'price'> & { isActive: boolean }

export interface ProductFilters extends PageParams {
  categoryId?: Guid
  brandId?: Guid
  isActive?: boolean
}

export interface Category {
  categoryId: Guid
  parentCategoryId: Guid | null
  parentCategoryName: string | null
  name: string
  description: string | null
  isActive: boolean
  createdAt: IsoDate
}

export interface CreateCategoryRequest {
  name: string
  description: string | null
  parentCategoryId: Guid | null
}

export type UpdateCategoryRequest = CreateCategoryRequest & { isActive: boolean }

export interface Brand {
  brandId: Guid
  name: string
  isActive: boolean
  createdAt: IsoDate
}

export interface Unit {
  unitId: Guid
  code: string
  name: string
  allowsDecimals: boolean
}

export interface CreateUnitRequest {
  code: string
  name: string
  allowsDecimals: boolean
}

// ── Llamadas ─────────────────────────────────────────────────────────────────

/** Quita parámetros vacíos para no mandar `?search=&brandId=`. */
function clean<T extends object>(params: T) {
  return Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== '' && v !== null))
}

export const productsApi = {
  list: (filters: ProductFilters) =>
    http.get<PagedResult<Product>>('/products', { params: clean(filters) }).then((r) => r.data),
  get: (id: Guid) => http.get<Product>(`/products/${id}`).then((r) => r.data),
  prices: (id: Guid) => http.get<ProductPrice[]>(`/products/${id}/prices`).then((r) => r.data),
  create: (body: CreateProductRequest) => http.post<Product>('/products', body).then((r) => r.data),
  update: (id: Guid, body: UpdateProductRequest) => http.put<Product>(`/products/${id}`, body).then((r) => r.data),
  changePrice: (id: Guid, price: number) =>
    http.put<ProductPrice>(`/products/${id}/price`, { price }).then((r) => r.data),
}

export const categoriesApi = {
  list: (isActive?: boolean) =>
    http.get<Category[]>('/categories', { params: clean({ isActive }) }).then((r) => r.data),
  create: (body: CreateCategoryRequest) => http.post<Category>('/categories', body).then((r) => r.data),
  update: (id: Guid, body: UpdateCategoryRequest) =>
    http.put<Category>(`/categories/${id}`, body).then((r) => r.data),
  remove: (id: Guid) => http.delete(`/categories/${id}`).then(() => undefined),
}

export const brandsApi = {
  list: (isActive?: boolean) => http.get<Brand[]>('/brands', { params: clean({ isActive }) }).then((r) => r.data),
  create: (name: string) => http.post<Brand>('/brands', { name }).then((r) => r.data),
  update: (id: Guid, body: { name: string; isActive: boolean }) =>
    http.put<Brand>(`/brands/${id}`, body).then((r) => r.data),
  remove: (id: Guid) => http.delete(`/brands/${id}`).then(() => undefined),
}

export const unitsApi = {
  list: () => http.get<Unit[]>('/units').then((r) => r.data),
  create: (body: CreateUnitRequest) => http.post<Unit>('/units', body).then((r) => r.data),
  update: (id: Guid, body: { name: string; allowsDecimals: boolean }) =>
    http.put<Unit>(`/units/${id}`, body).then((r) => r.data),
}
