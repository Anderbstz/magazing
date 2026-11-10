/** Espejo de `Magazing.Domain.Common.PagedResult<T>`. */
export interface PagedResult<T> {
  items: T[]
  page: number
  pageSize: number
  totalCount: number
  totalPages: number
}

export interface PageParams {
  page?: number
  pageSize?: number
  search?: string
}

/** Guid de .NET serializado como texto. */
export type Guid = string

/** Fecha de .NET serializada en ISO 8601. */
export type IsoDate = string
