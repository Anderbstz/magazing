import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import type { Guid } from '@/api/types'
import {
  brandsApi,
  categoriesApi,
  productsApi,
  unitsApi,
  type CreateCategoryRequest,
  type CreateProductRequest,
  type CreateUnitRequest,
  type ProductFilters,
  type UpdateCategoryRequest,
  type UpdateProductRequest,
} from './api'

export const catalogKeys = {
  products: ['products'] as const,
  productList: (filters: ProductFilters) => ['products', 'list', filters] as const,
  productPrices: (id: Guid) => ['products', id, 'prices'] as const,
  categories: ['categories'] as const,
  brands: ['brands'] as const,
  units: ['units'] as const,
}

// ── Productos ────────────────────────────────────────────────────────────────

export function useProducts(filters: ProductFilters) {
  return useQuery({
    queryKey: catalogKeys.productList(filters),
    queryFn: () => productsApi.list(filters),
    // Mantiene la página anterior visible mientras carga la siguiente.
    placeholderData: keepPreviousData,
  })
}

export function useProductPrices(id: Guid | null) {
  return useQuery({
    queryKey: catalogKeys.productPrices(id ?? ''),
    queryFn: () => productsApi.prices(id!),
    enabled: !!id,
  })
}

export function useSaveProduct() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: { id: Guid; body: UpdateProductRequest } | { id?: undefined; body: CreateProductRequest }) =>
      input.id !== undefined ? productsApi.update(input.id, input.body) : productsApi.create(input.body),
    onSuccess: (_data, input) => {
      toast.success(input.id ? 'Producto actualizado' : 'Producto creado')
      return qc.invalidateQueries({ queryKey: catalogKeys.products })
    },
  })
}

export function useChangePrice() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, price }: { id: Guid; price: number }) => productsApi.changePrice(id, price),
    onSuccess: () => {
      toast.success('Precio actualizado')
      return qc.invalidateQueries({ queryKey: catalogKeys.products })
    },
  })
}

// ── Categorías ───────────────────────────────────────────────────────────────

export function useCategories() {
  return useQuery({ queryKey: catalogKeys.categories, queryFn: () => categoriesApi.list() })
}

export function useSaveCategory() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: { id: Guid; body: UpdateCategoryRequest } | { id?: undefined; body: CreateCategoryRequest }) =>
      input.id !== undefined ? categoriesApi.update(input.id, input.body) : categoriesApi.create(input.body),
    onSuccess: (_data, input) => {
      toast.success(input.id ? 'Categoría actualizada' : 'Categoría creada')
      return qc.invalidateQueries({ queryKey: catalogKeys.categories })
    },
  })
}

export function useDeleteCategory() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: categoriesApi.remove,
    onSuccess: () => {
      toast.success('Categoría eliminada')
      return qc.invalidateQueries({ queryKey: catalogKeys.categories })
    },
  })
}

// ── Marcas ───────────────────────────────────────────────────────────────────

export function useBrands() {
  return useQuery({ queryKey: catalogKeys.brands, queryFn: () => brandsApi.list() })
}

export function useSaveBrand() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: { id?: Guid; name: string; isActive: boolean }) =>
      input.id ? brandsApi.update(input.id, { name: input.name, isActive: input.isActive }) : brandsApi.create(input.name),
    onSuccess: (_data, input) => {
      toast.success(input.id ? 'Marca actualizada' : 'Marca creada')
      return qc.invalidateQueries({ queryKey: catalogKeys.brands })
    },
  })
}

export function useDeleteBrand() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: brandsApi.remove,
    onSuccess: () => {
      toast.success('Marca eliminada')
      return qc.invalidateQueries({ queryKey: catalogKeys.brands })
    },
  })
}

// ── Unidades ─────────────────────────────────────────────────────────────────

export function useUnits() {
  return useQuery({ queryKey: catalogKeys.units, queryFn: unitsApi.list, staleTime: 5 * 60_000 })
}

export function useSaveUnit() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: { id?: Guid; body: CreateUnitRequest }) =>
      input.id
        ? unitsApi.update(input.id, { name: input.body.name, allowsDecimals: input.body.allowsDecimals })
        : unitsApi.create(input.body),
    onSuccess: (_data, input) => {
      toast.success(input.id ? 'Unidad actualizada' : 'Unidad creada')
      return qc.invalidateQueries({ queryKey: catalogKeys.units })
    },
  })
}
