import { Pencil, Plus, Search } from 'lucide-react'
import { useState } from 'react'
import { PageHeader } from '@/components/page-header'
import { ActiveBadge, Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Pagination } from '@/components/ui/pagination'
import { LoadingBlock } from '@/components/ui/spinner'
import { EmptyState, ErrorState } from '@/components/ui/states'
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table'
import { useDebouncedValue } from '@/hooks/use-debounced-value'
import type { Customer } from '../api'
import { CustomerDialog } from '../components/customer-dialog'
import { useCustomers } from '../queries'

export function CustomersPage() {
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const debounced = useDebouncedValue(search.trim())
  const customers = useCustomers({ page, pageSize: 20, search: debounced || undefined })
  const [editing, setEditing] = useState<Customer | null>(null)
  const [open, setOpen] = useState(false)

  return (
    <>
      <PageHeader
        title="Clientes"
        description="La factura exige RUC; la boleta acepta DNI o «Clientes varios»."
        actions={
          <Button
            onClick={() => {
              setEditing(null)
              setOpen(true)
            }}
          >
            <Plus className="size-4" /> Nuevo cliente
          </Button>
        }
      />

      <Card>
        <div className="border-b border-slate-200 p-4">
          <div className="relative max-w-md">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" />
            <Input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setPage(1)
              }}
              placeholder="Nombre, DNI o RUC"
              className="pl-9"
              aria-label="Buscar clientes"
            />
          </div>
        </div>
        {customers.isPending ? (
          <LoadingBlock />
        ) : customers.isError ? (
          <ErrorState error={customers.error} onRetry={() => customers.refetch()} />
        ) : customers.data.items.length === 0 ? (
          <EmptyState title="Sin clientes" />
        ) : (
          <>
            <Table>
              <THead>
                <tr>
                  <TH>Cliente</TH>
                  <TH>Documento</TH>
                  <TH className="hidden md:table-cell">Contacto</TH>
                  <TH>Estado</TH>
                  <TH className="w-px" />
                </tr>
              </THead>
              <TBody>
                {customers.data.items.map((c) => {
                  const generic = c.documentNumber === '00000000'
                  return (
                    <TR key={c.customerId}>
                      <TD className="font-medium text-slate-900">
                        {c.fullName}
                        {generic && (
                          <Badge tone="info" className="ml-2">
                            Por defecto
                          </Badge>
                        )}
                      </TD>
                      <TD className="font-mono text-xs">
                        {c.documentType} {c.documentNumber}
                      </TD>
                      <TD className="hidden text-sm md:table-cell">
                        {c.email ?? '—'}
                        {c.phone && <div className="text-xs text-slate-500">{c.phone}</div>}
                      </TD>
                      <TD>
                        <ActiveBadge active={c.isActive} />
                      </TD>
                      <TD>
                        {!generic && (
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Editar"
                            aria-label={`Editar ${c.fullName}`}
                            onClick={() => {
                              setEditing(c)
                              setOpen(true)
                            }}
                          >
                            <Pencil className="size-4" />
                          </Button>
                        )}
                      </TD>
                    </TR>
                  )
                })}
              </TBody>
            </Table>
            <Pagination page={customers.data.page} totalPages={customers.data.totalPages} totalCount={customers.data.totalCount} onPageChange={setPage} />
          </>
        )}
      </Card>

      {open && <CustomerDialog customer={editing} onClose={() => setOpen(false)} />}
    </>
  )
}
