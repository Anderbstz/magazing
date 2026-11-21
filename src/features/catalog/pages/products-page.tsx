import { History, Pencil, Plus, Search } from 'lucide-react'
import { useState } from 'react'
import { useSearchParams } from 'react-router'
import { PageHeader } from '@/components/page-header'
import { ActiveBadge, Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input, Select } from '@/components/ui/input'
import { Pagination } from '@/components/ui/pagination'
import { LoadingBlock } from '@/components/ui/spinner'
import { EmptyState, ErrorState } from '@/components/ui/states'
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table'
import { P } from '@/config/permissions'
import { Can } from '@/features/auth/guards'
import { useDebouncedValue } from '@/hooks/use-debounced-value'
import { formatMoney, formatQuantity } from '@/lib/format'
import type { Product } from '../api'
import { PriceDialog } from '../components/price-dialog'
import { ProductFormDialog } from '../components/product-form-dialog'
import { useBrands, useCategories, useProducts } from '../queries'

const PAGE_SIZE = 20

export function ProductsPage() {
  // Los filtros viven en la URL: se pueden compartir y sobreviven a la recarga.
  const [params, setParams] = useSearchParams()
  const page = Number(params.get('page') ?? 1)
  const categoryId = params.get('categoryId') ?? ''
  const brandId = params.get('brandId') ?? ''
  const status = params.get('status') ?? 'active'

  const [search, setSearch] = useState(params.get('search') ?? '')
  const debouncedSearch = useDebouncedValue(search.trim())

  const products = useProducts({
    page,
    pageSize: PAGE_SIZE,
    search: debouncedSearch || undefined,
    categoryId: categoryId || undefined,
    brandId: brandId || undefined,
    isActive: status === 'all' ? undefined : status === 'active',
  })
  const categories = useCategories()
  const brands = useBrands()

  const [editing, setEditing] = useState<Product | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [pricing, setPricing] = useState<Product | null>(null)

  function setFilter(key: string, value: string) {
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        if (value) next.set(key, value)
        else next.delete(key)
        if (key !== 'page') next.delete('page')
        return next
      },
      { replace: true },
    )
  }

  function openForm(product: Product | null) {
    setEditing(product)
    setFormOpen(true)
  }

  const hasFilters = !!(debouncedSearch || categoryId || brandId || status !== 'active')

  return (
    <>
      <PageHeader
        title="Productos"
        description="Catálogo de productos, precios y costo promedio."
        actions={
          <Can permission={P.CatalogManage}>
            <Button onClick={() => openForm(null)}>
              <Plus className="size-4" /> Nuevo producto
            </Button>
          </Can>
        }
      />

      <Card>
        <div className="grid gap-3 border-b border-slate-200 p-4 sm:grid-cols-2 lg:grid-cols-[1fr_200px_200px_150px]">
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" />
            <Input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setFilter('search', e.target.value.trim())
              }}
              placeholder="Buscar por nombre, SKU o código de barras"
              className="pl-9"
              aria-label="Buscar productos"
            />
          </div>
          <Select value={categoryId} onChange={(e) => setFilter('categoryId', e.target.value)} aria-label="Categoría">
            <option value="">Todas las categorías</option>
            {categories.data?.map((c) => (
              <option key={c.categoryId} value={c.categoryId}>
                {c.name}
              </option>
            ))}
          </Select>
          <Select value={brandId} onChange={(e) => setFilter('brandId', e.target.value)} aria-label="Marca">
            <option value="">Todas las marcas</option>
            {brands.data?.map((b) => (
              <option key={b.brandId} value={b.brandId}>
                {b.name}
              </option>
            ))}
          </Select>
          <Select value={status} onChange={(e) => setFilter('status', e.target.value)} aria-label="Estado">
            <option value="active">Activos</option>
            <option value="inactive">Inactivos</option>
            <option value="all">Todos</option>
          </Select>
        </div>

        {products.isPending ? (
          <LoadingBlock />
        ) : products.isError ? (
          <ErrorState error={products.error} onRetry={() => products.refetch()} />
        ) : products.data.items.length === 0 ? (
          <EmptyState
            title={hasFilters ? 'Sin resultados' : 'Aún no hay productos'}
            description={hasFilters ? 'Prueba con otros filtros.' : 'Crea el primero para empezar a vender.'}
          />
        ) : (
          <>
            <Table className={products.isPlaceholderData ? 'opacity-60' : undefined}>
              <THead>
                <tr>
                  <TH>Producto</TH>
                  <TH className="hidden md:table-cell">Categoría</TH>
                  <TH className="hidden lg:table-cell">Marca</TH>
                  <TH className="text-right">Precio</TH>
                  <TH className="hidden text-right sm:table-cell">Costo prom.</TH>
                  <TH className="hidden text-right lg:table-cell">Stock mín.</TH>
                  <TH>Estado</TH>
                  <TH className="w-px" />
                </tr>
              </THead>
              <TBody>
                {products.data.items.map((p) => (
                  <TR key={p.productId}>
                    <TD>
                      <div className="font-medium text-slate-900">{p.name}</div>
                      <div className="text-xs text-slate-500">
                        {p.sku} · {p.unitCode}
                        {!p.isTaxable && (
                          <Badge tone="info" className="ml-2">
                            Exonerado
                          </Badge>
                        )}
                      </div>
                    </TD>
                    <TD className="hidden md:table-cell">{p.categoryName}</TD>
                    <TD className="hidden lg:table-cell">{p.brandName ?? '—'}</TD>
                    <TD className="tabular text-right font-medium">{formatMoney(p.currentPrice)}</TD>
                    <TD className="tabular hidden text-right sm:table-cell">{formatMoney(p.averageCost)}</TD>
                    <TD className="tabular hidden text-right lg:table-cell">{formatQuantity(p.minStock)}</TD>
                    <TD>
                      <ActiveBadge active={p.isActive} />
                    </TD>
                    <TD>
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" title="Precios" aria-label={`Precios de ${p.name}`} onClick={() => setPricing(p)}>
                          <History className="size-4" />
                        </Button>
                        <Can permission={P.CatalogManage}>
                          <Button variant="ghost" size="icon" title="Editar" aria-label={`Editar ${p.name}`} onClick={() => openForm(p)}>
                            <Pencil className="size-4" />
                          </Button>
                        </Can>
                      </div>
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
            <Pagination
              page={products.data.page}
              totalPages={products.data.totalPages}
              totalCount={products.data.totalCount}
              onPageChange={(p) => setFilter('page', String(p))}
            />
          </>
        )}
      </Card>

      <ProductFormDialog open={formOpen} product={editing} onClose={() => setFormOpen(false)} />
      <PriceDialog product={pricing} onClose={() => setPricing(null)} />
    </>
  )
}
