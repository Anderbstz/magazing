import { Search, UserPlus, UserRound } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { LoadingBlock } from '@/components/ui/spinner'
import { EmptyState } from '@/components/ui/states'
import { useDebouncedValue } from '@/hooks/use-debounced-value'
import { cn } from '@/lib/utils'
import type { Customer } from '../api'
import { useCustomers } from '../queries'
import { CustomerDialog } from './customer-dialog'

/** Cliente de la venta: muestra el elegido y abre un buscador con alta rápida. */
export function CustomerPicker({ value, onChange, requireRuc }: { value: Customer | null; onChange: (c: Customer) => void; requireRuc: boolean }) {
  const [searching, setSearching] = useState(false)
  const [creating, setCreating] = useState(false)

  return (
    <>
      <button
        type="button"
        onClick={() => setSearching(true)}
        className={cn(
          'pressable flex w-full items-center gap-3 rounded-lg p-3 text-left ring-1 hover:bg-slate-50',
          requireRuc && value?.documentType !== 'RUC' ? 'ring-amber-400' : 'ring-slate-200',
        )}
      >
        <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500">
          <UserRound className="size-4.5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-slate-900">{value?.fullName ?? 'Elegir cliente'}</p>
          {value && (
            <p className="text-xs text-slate-500">
              {value.documentType} {value.documentNumber}
            </p>
          )}
        </div>
        <span className="text-xs font-medium text-brand-700">Cambiar</span>
      </button>
      {requireRuc && value?.documentType !== 'RUC' && (
        <p className="mt-1.5 text-xs text-amber-700">La factura exige un cliente con RUC.</p>
      )}

      {searching && (
        <CustomerSearchDialog
          requireRuc={requireRuc}
          onClose={() => setSearching(false)}
          onPick={(c) => {
            onChange(c)
            setSearching(false)
          }}
          onCreate={() => {
            setSearching(false)
            setCreating(true)
          }}
        />
      )}
      {creating && (
        <CustomerDialog
          customer={null}
          defaultDocumentType={requireRuc ? 'RUC' : 'DNI'}
          onClose={() => setCreating(false)}
          onSaved={(c) => {
            onChange(c)
            setCreating(false)
          }}
        />
      )}
    </>
  )
}

function CustomerSearchDialog({
  requireRuc,
  onClose,
  onPick,
  onCreate,
}: {
  requireRuc: boolean
  onClose: () => void
  onPick: (c: Customer) => void
  onCreate: () => void
}) {
  const [search, setSearch] = useState('')
  const debounced = useDebouncedValue(search.trim(), 250)
  const customers = useCustomers({ search: debounced || undefined, isActive: true, pageSize: 10 })

  return (
    <Dialog
      open
      onClose={onClose}
      title="Elegir cliente"
      footer={
        <Button variant="secondary" onClick={onCreate}>
          <UserPlus className="size-4" /> Nuevo cliente
        </Button>
      }
    >
      <div className="relative mb-3">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" />
        <Input autoFocus value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Nombre, DNI o RUC" className="pl-9" aria-label="Buscar cliente" />
      </div>
      {customers.isPending ? (
        <LoadingBlock />
      ) : customers.data?.items.length === 0 ? (
        <EmptyState title="Sin resultados" description="Regístralo con «Nuevo cliente»." />
      ) : (
        <ul className="divide-y divide-slate-100 rounded-lg ring-1 ring-slate-200">
          {customers.data?.items.map((c) => {
            const disabled = requireRuc && c.documentType !== 'RUC'
            return (
              <li key={c.customerId}>
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => onPick(c)}
                  className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left text-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <span className="truncate font-medium text-slate-800">{c.fullName}</span>
                  <span className="shrink-0 font-mono text-xs text-slate-500">
                    {c.documentType} {c.documentNumber}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
      {requireRuc && <p className="mt-2 text-xs text-slate-500">Para factura solo se pueden elegir clientes con RUC.</p>}
    </Dialog>
  )
}
