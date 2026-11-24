import { BrushCleaning, LogOut, Monitor, Smartphone } from 'lucide-react'
import { useState } from 'react'
import { PageHeader } from '@/components/page-header'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Pagination } from '@/components/ui/pagination'
import { LoadingBlock } from '@/components/ui/spinner'
import { EmptyState, ErrorState } from '@/components/ui/states'
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table'
import { session } from '@/features/auth/session'
import { formatDateTime } from '@/lib/format'
import { describeUserAgent, sessionIdFromToken } from '@/lib/user-agent'
import type { ActiveSession } from '../api'
import { useActiveSessions, useRevokeInactiveSessions, useRevokeSession } from '../queries'

const relative = new Intl.RelativeTimeFormat('es-PE', { numeric: 'auto' })

/** Sin renovar el token en este tiempo, la sesión se considera abandonada (el navegador se cerró sin salir). */
const INACTIVE_HOURS = 24
const PAGE_SIZE = 20

function timeAgo(iso: string, now: number) {
  const minutes = Math.round((new Date(iso).getTime() - now) / 60_000)
  if (Math.abs(minutes) < 60) return relative.format(minutes, 'minute')
  const hours = Math.round(minutes / 60)
  if (Math.abs(hours) < 24) return relative.format(hours, 'hour')
  return relative.format(Math.round(hours / 24), 'day')
}

/**
 * Sesiones abiertas: una por navegador o equipo donde alguien inició sesión y no la cerró.
 * La "última actividad" es la última renovación del token (cada ~30 min de uso).
 */
export function SessionsPage() {
  const sessions = useActiveSessions()
  const revoke = useRevokeSession()
  const cleanUp = useRevokeInactiveSessions()
  const [closing, setClosing] = useState<ActiveSession | null>(null)
  const [confirmCleanUp, setConfirmCleanUp] = useState(false)
  const [showInactive, setShowInactive] = useState(false)
  const [pageChoice, setPage] = useState(1)
  const [now] = useState(() => Date.now())
  const currentId = sessionIdFromToken(session.getAccessToken())

  const isRecent = (s: ActiveSession) => now - new Date(s.lastActivityAt).getTime() < INACTIVE_HOURS * 3_600_000
  const all = sessions.data ?? []
  const inactiveCount = all.filter((s) => !isRecent(s) && s.sessionId !== currentId).length
  const visible = showInactive ? all : all.filter((s) => isRecent(s) || s.sessionId === currentId)
  const users = new Set(visible.map((s) => s.userId)).size
  const totalPages = Math.max(1, Math.ceil(visible.length / PAGE_SIZE))
  const page = Math.min(pageChoice, totalPages)

  return (
    <>
      <PageHeader
        title="Sesiones activas"
        description="Dónde está abierta cada cuenta: navegador, sistema, IP y última actividad. Cierra las que no reconozcas."
        actions={
          inactiveCount > 0 && (
            <Button variant="secondary" onClick={() => setConfirmCleanUp(true)}>
              <BrushCleaning className="size-4" /> Cerrar inactivas ({inactiveCount})
            </Button>
          )
        }
      />

      <Card>
        {sessions.isPending ? (
          <LoadingBlock />
        ) : sessions.isError ? (
          <ErrorState error={sessions.error} onRetry={() => sessions.refetch()} />
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-3 text-sm text-slate-600">
              <p>
                {visible.length} {visible.length === 1 ? 'sesión' : 'sesiones'} de {users} {users === 1 ? 'usuario' : 'usuarios'}
                {!showInactive && ` con actividad en las últimas ${INACTIVE_HOURS} h`}
              </p>
              {inactiveCount > 0 && (
                <label className="flex items-center gap-2">
                  <input type="checkbox" className="accent-brand-700" checked={showInactive} onChange={(e) => {
                      setShowInactive(e.target.checked)
                      setPage(1)
                    }} />
                  Mostrar también las inactivas ({inactiveCount})
                </label>
              )}
            </div>
            {visible.length === 0 ? (
              <EmptyState title="Nadie ha usado el sistema en las últimas 24 horas" />
            ) : (
            <Table>
              <THead>
                <tr>
                  <TH>Usuario</TH>
                  <TH>Dispositivo</TH>
                  <TH className="hidden md:table-cell">IP</TH>
                  <TH className="hidden lg:table-cell">Inició sesión</TH>
                  <TH>Última actividad</TH>
                  <TH className="w-12" />
                </tr>
              </THead>
              <TBody>
                {visible.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE).map((s) => {
                  const device = describeUserAgent(s.userAgent)
                  const isCurrent = s.sessionId === currentId
                  const DeviceIcon = device.mobile ? Smartphone : Monitor
                  return (
                    <TR key={s.sessionId}>
                      <TD>
                        <div className="font-medium text-slate-900">{s.fullName}</div>
                        <div className="text-xs text-slate-500">@{s.username}</div>
                      </TD>
                      <TD>
                        <div className="flex items-center gap-2">
                          <DeviceIcon className="size-4 shrink-0 text-slate-400" aria-hidden />
                          <span className="text-slate-800">{device.label}</span>
                          {isCurrent && <Badge tone="success">Este dispositivo</Badge>}
                        </div>
                      </TD>
                      <TD className="tabular hidden text-slate-600 md:table-cell">{s.ipAddress ?? '—'}</TD>
                      <TD className="hidden text-slate-600 lg:table-cell">{formatDateTime(s.startedAt)}</TD>
                      <TD className="text-slate-600" title={formatDateTime(s.lastActivityAt)}>
                        {timeAgo(s.lastActivityAt, now)}
                      </TD>
                      <TD>
                        {!isCurrent && (
                          <Button variant="ghost" size="icon" aria-label={`Cerrar la sesión de ${s.username} en ${device.label}`} title="Cerrar sesión" onClick={() => setClosing(s)}>
                            <LogOut className="size-4" />
                          </Button>
                        )}
                      </TD>
                    </TR>
                  )
                })}
              </TBody>
            </Table>
            )}
            {totalPages > 1 && <Pagination page={page} totalPages={totalPages} totalCount={visible.length} onPageChange={setPage} />}
          </>
        )}
      </Card>

      <p className="mt-3 text-xs text-slate-500">
        Al cerrar una sesión, ese equipo ya no puede renovar su acceso: sale del sistema en cuanto vence su token (máximo 30 minutos).
      </p>

      <ConfirmDialog
        open={confirmCleanUp}
        title="¿Cerrar las sesiones inactivas?"
        message={`Se cerrarán ${inactiveCount} sesiones sin actividad en más de ${INACTIVE_HOURS} horas: navegadores que se cerraron sin salir del sistema. Tu sesión actual no se toca.`}
        confirmLabel="Cerrar inactivas"
        loading={cleanUp.isPending}
        onConfirm={() => cleanUp.mutate(INACTIVE_HOURS, { onSuccess: () => setConfirmCleanUp(false) })}
        onClose={() => setConfirmCleanUp(false)}
      />

      <ConfirmDialog
        open={!!closing}
        title="¿Cerrar esta sesión?"
        message={closing ? `${closing.fullName} tendrá que volver a iniciar sesión en ${describeUserAgent(closing.userAgent).label}.` : ''}
        confirmLabel="Cerrar sesión"
        loading={revoke.isPending}
        onConfirm={() => closing && revoke.mutate(closing.sessionId, { onSuccess: () => setClosing(null) })}
        onClose={() => setClosing(null)}
      />
    </>
  )
}
