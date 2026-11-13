import { CheckCircle2, Clock, RotateCcw, Search, XCircle } from 'lucide-react'
import { useState } from 'react'
import { PageHeader } from '@/components/page-header'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Dialog } from '@/components/ui/dialog'
import { Input, Select } from '@/components/ui/input'
import { Pagination } from '@/components/ui/pagination'
import { LoadingBlock } from '@/components/ui/spinner'
import { EmptyState, ErrorState } from '@/components/ui/states'
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table'
import { useDebouncedValue } from '@/hooks/use-debounced-value'
import { formatDateTime } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { EmailStatus, EmailTemplate, OutboxEmail } from '../api'
import { useEmails, useRetryEmail } from '../queries'

const STATUS: Record<EmailStatus, { label: string; tone: 'warning' | 'success' | 'danger'; icon: typeof Clock }> = {
  PENDING: { label: 'En cola', tone: 'warning', icon: Clock },
  SENT: { label: 'Enviado', tone: 'success', icon: CheckCircle2 },
  FAILED: { label: 'Falló', tone: 'danger', icon: XCircle },
}

const TEMPLATES: Record<EmailTemplate, string> = {
  INVOICE: 'Comprobante',
  STOCK_ALERT: 'Alerta de stock',
  WELCOME: 'Bienvenida',
  PASSWORD_RESET: 'Recuperar contraseña',
}

const TABS: { value: '' | EmailStatus; label: string }[] = [
  { value: '', label: 'Todos' },
  { value: 'PENDING', label: 'En cola' },
  { value: 'SENT', label: 'Enviados' },
  { value: 'FAILED', label: 'Fallidos' },
]

/** Regla 10: los correos se guardan en `email_outbox` y un BackgroundService los envía con Resend. */
export function EmailsPage() {
  const [status, setStatus] = useState<'' | EmailStatus>('')
  const [template, setTemplate] = useState<'' | EmailTemplate>('')
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const debounced = useDebouncedValue(search.trim())
  const emails = useEmails({ status: status || undefined, template: template || undefined, search: debounced || undefined, page, pageSize: 20 })
  const [viewing, setViewing] = useState<OutboxEmail | null>(null)

  return (
    <>
      <PageHeader title="Correos" description="Bandeja de salida: comprobantes, alertas y avisos. El envío es en segundo plano y se reintenta si falla." />

      <Card>
        <div className="flex flex-wrap items-center gap-3 border-b border-slate-200 p-4">
          <div className="flex rounded-lg bg-slate-100 p-1" role="tablist">
            {TABS.map((t) => (
              <button
                key={t.value}
                type="button"
                role="tab"
                aria-selected={status === t.value}
                onClick={() => {
                  setStatus(t.value)
                  setPage(1)
                }}
                className={cn('pressable rounded-md px-3 py-1.5 text-sm font-medium', status === t.value ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900')}
              >
                {t.label}
              </button>
            ))}
          </div>
          <Select
            value={template}
            onChange={(e) => {
              setTemplate(e.target.value as '' | EmailTemplate)
              setPage(1)
            }}
            className="w-auto"
            aria-label="Plantilla"
          >
            <option value="">Todas las plantillas</option>
            {Object.entries(TEMPLATES).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </Select>
          <div className="relative ml-auto w-full max-w-xs">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" />
            <Input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setPage(1)
              }}
              placeholder="Destinatario o asunto"
              className="pl-9"
              aria-label="Buscar correos"
            />
          </div>
        </div>

        {emails.isPending ? (
          <LoadingBlock />
        ) : emails.isError ? (
          <ErrorState error={emails.error} onRetry={() => emails.refetch()} />
        ) : emails.data.items.length === 0 ? (
          <EmptyState title="Sin correos" />
        ) : (
          <>
            <Table>
              <THead>
                <tr>
                  <TH>Asunto</TH>
                  <TH className="hidden md:table-cell">Destinatario</TH>
                  <TH className="hidden lg:table-cell">Plantilla</TH>
                  <TH className="hidden sm:table-cell">Creado</TH>
                  <TH>Estado</TH>
                </tr>
              </THead>
              <TBody>
                {emails.data.items.map((e) => {
                  const s = STATUS[e.status]
                  return (
                    <TR key={e.emailOutboxId} className="cursor-pointer" onClick={() => setViewing(e)}>
                      <TD>
                        <button type="button" className="text-left font-medium text-slate-900 hover:text-brand-700" onClick={() => setViewing(e)}>
                          {e.subject}
                        </button>
                        <div className="text-xs text-slate-500 md:hidden">{e.toEmail}</div>
                      </TD>
                      <TD className="hidden md:table-cell">{e.toEmail}</TD>
                      <TD className="hidden lg:table-cell">{TEMPLATES[e.template]}</TD>
                      <TD className="hidden text-xs sm:table-cell">{formatDateTime(e.createdAt)}</TD>
                      <TD>
                        <Badge tone={s.tone}>
                          <s.icon className="mr-1 size-3" aria-hidden /> {s.label}
                        </Badge>
                        {e.attempts > 1 && <div className="mt-0.5 text-[11px] text-slate-500">{e.attempts} intentos</div>}
                      </TD>
                    </TR>
                  )
                })}
              </TBody>
            </Table>
            <Pagination page={emails.data.page} totalPages={emails.data.totalPages} totalCount={emails.data.totalCount} onPageChange={setPage} />
          </>
        )}
      </Card>

      {viewing && <EmailDialog email={viewing} onClose={() => setViewing(null)} />}
    </>
  )
}

function EmailDialog({ email, onClose }: { email: OutboxEmail; onClose: () => void }) {
  const retry = useRetryEmail()
  return (
    <Dialog
      open
      onClose={onClose}
      size="lg"
      title={email.subject}
      description={`Para ${email.toEmail} · ${TEMPLATES[email.template]}`}
      footer={
        email.status === 'FAILED' ? (
          <Button loading={retry.isPending} onClick={() => retry.mutate(email.emailOutboxId, { onSuccess: onClose })}>
            <RotateCcw className="size-4" /> Reintentar envío
          </Button>
        ) : (
          <Button variant="secondary" onClick={onClose}>
            Cerrar
          </Button>
        )
      }
    >
      <dl className="mb-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
        <div>
          <dt className="text-xs text-slate-500">Estado</dt>
          <dd className="mt-0.5">
            <Badge tone={STATUS[email.status].tone}>{STATUS[email.status].label}</Badge>
          </dd>
        </div>
        <div>
          <dt className="text-xs text-slate-500">Intentos</dt>
          <dd className="tabular mt-0.5 text-slate-800">{email.attempts}</dd>
        </div>
        <div>
          <dt className="text-xs text-slate-500">Creado</dt>
          <dd className="mt-0.5 text-slate-800">{formatDateTime(email.createdAt)}</dd>
        </div>
        <div>
          <dt className="text-xs text-slate-500">Enviado</dt>
          <dd className="mt-0.5 text-slate-800">{formatDateTime(email.sentAt)}</dd>
        </div>
      </dl>
      {email.lastError && (
        <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800 ring-1 ring-red-200" role="alert">
          {email.lastError}
        </p>
      )}
      <p className="mb-1.5 text-xs font-medium text-slate-500">Vista previa</p>
      {/* sandbox sin permisos: el HTML del correo no puede ejecutar scripts ni navegar. */}
      <iframe title="Vista previa del correo" sandbox="" srcDoc={email.htmlBody} className="h-48 w-full rounded-lg bg-white ring-1 ring-slate-200" />
    </Dialog>
  )
}
