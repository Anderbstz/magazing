import { useMutation, useQueryClient } from '@tanstack/react-query'
import { AlertCircle, CheckCircle2, FileSpreadsheet, Upload } from 'lucide-react'
import { useRef, useState } from 'react'
import { toast } from 'sonner'
import { DownloadButton } from '@/components/download-button'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table'
import { cn } from '@/lib/utils'
import { productsApi, type ProductImportResult } from '../api'
import { catalogKeys } from '../queries'

const MAX_BYTES = 5 * 1024 * 1024

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

/**
 * Importación masiva en dos pasos: primero se valida el archivo (vista previa, no guarda nada) y
 * luego se crean solo las filas sin errores. Las que fallan se corrigen en el archivo y se vuelven a subir.
 */
export function ImportProductsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient()
  const inputRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<ProductImportResult | null>(null)
  const [localError, setLocalError] = useState<string | null>(null)

  const validate = useMutation({
    mutationFn: (f: File) => productsApi.importFile(f, true),
    meta: { silent: true },
    onSuccess: setPreview,
  })

  const commit = useMutation({
    mutationFn: (f: File) => productsApi.importFile(f, false),
    meta: { errorTitle: 'No se pudo importar' },
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: catalogKeys.products })
      toast.success(result.created === 1 ? 'Se creó 1 producto' : `Se crearon ${result.created} productos`, {
        description: result.errorRows ? `${plural(result.errorRows, 'fila', 'filas')} con errores no se importaron.` : 'Con stock 0: dales stock con un ajuste de entrada.',
      })
      close()
    },
  })

  function close() {
    setFile(null)
    setPreview(null)
    setLocalError(null)
    validate.reset()
    onClose()
  }

  function pick(f: File | undefined) {
    if (!f) return
    setPreview(null)
    validate.reset()
    if (!/\.(xlsx|csv)$/i.test(f.name)) return setLocalError('Sube un archivo .xlsx o .csv.')
    if (f.size > MAX_BYTES) return setLocalError('El archivo pesa más de 5 MB.')
    setLocalError(null)
    setFile(f)
    validate.mutate(f)
  }

  const rows = preview ? [...preview.rows].sort((a, b) => Number(b.status === 'error') - Number(a.status === 'error') || a.row - b.row) : []
  const error = localError ?? validate.error?.message

  return (
    <Dialog
      open={open}
      onClose={close}
      size="lg"
      title="Importar productos"
      description="Desde Excel (.xlsx) o CSV, con la plantilla de Magazing."
      footer={
        <>
          <Button variant="secondary" onClick={close} disabled={commit.isPending}>
            Cancelar
          </Button>
          <Button onClick={() => file && commit.mutate(file)} disabled={!preview?.validRows} loading={commit.isPending}>
            {preview?.validRows ? `Importar ${plural(preview.validRows, 'producto', 'productos')}` : 'Importar'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-slate-50 p-3 text-sm ring-1 ring-slate-200">
          <p className="text-slate-600">
            <span className="font-medium text-slate-800">1.</span> Descarga la plantilla: trae un ejemplo y las categorías, marcas y unidades válidas.
          </p>
          <DownloadButton path="/products/import/template" fallbackName="plantilla_productos.xlsx" size="sm">
            <FileSpreadsheet className="size-4" /> Plantilla
          </DownloadButton>
        </div>

        <div>
          <p className="mb-2 text-sm text-slate-600">
            <span className="font-medium text-slate-800">2.</span> Sube el archivo lleno. Primero verás una vista previa; no se guarda nada hasta que confirmes.
          </p>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault()
              pick(e.dataTransfer.files[0])
            }}
            className="flex w-full flex-col items-center gap-1.5 rounded-lg border-2 border-dashed border-slate-300 px-4 py-6 text-sm text-slate-600 hover:border-brand-400 hover:bg-brand-50/40"
          >
            <Upload className="size-5 text-slate-400" aria-hidden />
            {file ? (
              <span>
                <span className="font-medium text-slate-900">{file.name}</span> · cambiar archivo
              </span>
            ) : (
              <span>Arrastra el archivo aquí o haz clic para elegirlo</span>
            )}
            <span className="text-xs text-slate-400">.xlsx o .csv · hasta 1000 filas</span>
          </button>
          <input
            ref={inputRef}
            type="file"
            accept=".xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
            className="hidden"
            onChange={(e) => {
              pick(e.target.files?.[0])
              e.target.value = ''
            }}
          />
        </div>

        {validate.isPending && <p className="text-sm text-slate-500" role="status">Revisando el archivo…</p>}

        {error && (
          <p className="flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2.5 text-sm text-red-700 ring-1 ring-red-200" role="alert">
            <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden /> {error}
          </p>
        )}

        {preview && (
          <div className="space-y-2">
            <p className="text-sm text-slate-700" role="status">
              <span className="font-medium text-emerald-700">{plural(preview.validRows, 'lista', 'listas')} para importar</span>
              {preview.errorRows > 0 && (
                <>
                  {' · '}
                  <span className="font-medium text-red-700">{preview.errorRows} con errores</span> (no se importarán; corrígelas y vuelve a subir el archivo)
                </>
              )}
            </p>
            <div className="max-h-72 overflow-y-auto rounded-lg ring-1 ring-slate-200">
              <Table>
                <THead>
                  <tr>
                    <TH className="w-14">Fila</TH>
                    <TH>Producto</TH>
                    <TH>Resultado</TH>
                  </tr>
                </THead>
                <TBody>
                  {rows.map((r) => (
                    <TR key={r.row}>
                      <TD className="tabular text-slate-500">{r.row}</TD>
                      <TD>
                        <div className="font-medium text-slate-900">{r.name || '—'}</div>
                        <div className="text-xs text-slate-500">{r.sku || 'sin SKU'}</div>
                      </TD>
                      <TD>
                        <span className={cn('flex items-start gap-1.5 text-sm', r.status === 'error' ? 'text-red-700' : 'text-emerald-700')}>
                          {r.status === 'error' ? <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden /> : <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden />}
                          {r.status === 'error' ? r.message : 'Lista'}
                        </span>
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            </div>
          </div>
        )}
      </div>
    </Dialog>
  )
}
