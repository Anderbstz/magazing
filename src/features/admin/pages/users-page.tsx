import { zodResolver } from '@hookform/resolvers/zod'
import { Check, Copy, KeyRound, Pencil, Plus, Search } from 'lucide-react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { useForm } from 'react-hook-form'
import { useSearchParams } from 'react-router'
import { z } from 'zod'
import { PageHeader } from '@/components/page-header'
import { ActiveBadge, Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Dialog } from '@/components/ui/dialog'
import { Field } from '@/components/ui/field'
import { Checkbox, Input } from '@/components/ui/input'
import { Pagination } from '@/components/ui/pagination'
import { LoadingBlock } from '@/components/ui/spinner'
import { EmptyState, ErrorState } from '@/components/ui/states'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table'
import { P } from '@/config/permissions'
import { Can } from '@/features/auth/guards'
import { useCan, useSession } from '@/features/auth/use-auth'
import { useDebouncedValue } from '@/hooks/use-debounced-value'
import { formatDateTime } from '@/lib/format'
import type { Role, User, UserAccess } from '../api'
import { useCreateUser, useResetUserAccess, useRoles, useUpdateUser, useUsers } from '../queries'

const PAGE_SIZE = 20

export function UsersPage() {
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebouncedValue(search.trim())
  const users = useUsers({ page, pageSize: PAGE_SIZE, search: debouncedSearch })

  // `?new=1` (botón "Nuevo usuario" del inicio) abre el formulario de alta directamente.
  const can = useCan()
  const [params, setParams] = useSearchParams()
  const [formOpen, setFormOpen] = useState(() => params.get('new') === '1' && can(P.UsersManage))
  const [editing, setEditing] = useState<User | null>(null)

  function openForm(user: User | null) {
    setEditing(user)
    setFormOpen(true)
  }

  // Contraseña temporal recién generada: se muestra una sola vez.
  const [access, setAccess] = useState<UserAccess | null>(null)
  const [resetting, setResetting] = useState<User | null>(null)
  const resetAccess = useResetUserAccess()

  function closeForm() {
    setFormOpen(false)
    if (params.has('new')) setParams({}, { replace: true })
  }

  return (
    <>
      <PageHeader
        title="Usuarios"
        description="Cuentas con acceso al sistema y sus roles."
        actions={
          <Can permission={P.UsersManage}>
            <Button onClick={() => openForm(null)}>
              <Plus className="size-4" /> Nuevo usuario
            </Button>
          </Can>
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
              placeholder="Buscar por usuario, nombre o correo"
              className="pl-9"
              aria-label="Buscar usuarios"
            />
          </div>
        </div>

        {users.isPending ? (
          <LoadingBlock />
        ) : users.isError ? (
          <ErrorState error={users.error} onRetry={() => users.refetch()} />
        ) : users.data.items.length === 0 ? (
          <EmptyState title="Sin resultados" />
        ) : (
          <>
            <Table className={users.isPlaceholderData ? 'opacity-60' : undefined}>
              <THead>
                <tr>
                  <TH>Usuario</TH>
                  <TH className="hidden md:table-cell">Correo</TH>
                  <TH>Roles</TH>
                  <TH className="hidden lg:table-cell">Último ingreso</TH>
                  <TH>Estado</TH>
                  <TH className="w-px" />
                </tr>
              </THead>
              <TBody>
                {users.data.items.map((u) => (
                  <TR key={u.userId}>
                    <TD>
                      <div className="font-medium text-slate-900">{u.fullName}</div>
                      <div className="text-xs text-slate-500">@{u.username}</div>
                    </TD>
                    <TD className="hidden md:table-cell">{u.email}</TD>
                    <TD>
                      <div className="flex flex-wrap gap-1">
                        {u.roles.length === 0 ? (
                          <span className="text-xs text-slate-400">Sin rol</span>
                        ) : (
                          u.roles.map((r) => <Badge key={r}>{r}</Badge>)
                        )}
                      </div>
                    </TD>
                    <TD className="hidden lg:table-cell">{formatDateTime(u.lastLoginAt)}</TD>
                    <TD>
                      <div className="flex flex-wrap gap-1">
                        <ActiveBadge active={u.isActive} />
                        {u.isActive && u.mustChangePassword && <AccessBadge expiresAt={u.tempPasswordExpiresAt} />}
                      </div>
                    </TD>
                    <TD>
                      <Can permission={P.UsersManage}>
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Reenviar acceso"
                            aria-label={`Reenviar acceso a ${u.username}`}
                            disabled={!u.isActive}
                            onClick={() => setResetting(u)}
                          >
                            <KeyRound className="size-4" />
                          </Button>
                          <Button variant="ghost" size="icon" title="Editar" aria-label={`Editar ${u.username}`} onClick={() => openForm(u)}>
                            <Pencil className="size-4" />
                          </Button>
                        </div>
                      </Can>
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
            <Pagination
              page={users.data.page}
              totalPages={users.data.totalPages}
              totalCount={users.data.totalCount}
              onPageChange={setPage}
            />
          </>
        )}
      </Card>

      <UserFormDialog open={formOpen} user={editing} onClose={closeForm} onCreated={setAccess} />

      <ConfirmDialog
        open={!!resetting}
        title="Reenviar acceso"
        message={
          resetting
            ? `Se generará una nueva contraseña temporal para @${resetting.username} y se enviará a ${resetting.email}. La contraseña actual dejará de funcionar y deberá cambiarla al ingresar.`
            : ''
        }
        confirmLabel="Reenviar acceso"
        loading={resetAccess.isPending}
        onConfirm={() =>
          resetting &&
          resetAccess.mutate(resetting.userId, {
            onSuccess: (result) => {
              setResetting(null)
              setAccess(result)
            },
          })
        }
        onClose={() => setResetting(null)}
      />

      <AccessDialog access={access} onClose={() => setAccess(null)} />
    </>
  )
}

// ── Formulario ───────────────────────────────────────────────────────────────

const baseSchema = z.object({
  username: z
    .string()
    .trim()
    .min(3, 'Mínimo 3 caracteres')
    .max(50, 'Máximo 50 caracteres')
    .regex(/^[a-zA-Z0-9._-]+$/, 'Solo letras, números, punto, guion y guion bajo'),
  email: z.email('Correo no válido').max(150, 'Máximo 150 caracteres'),
  fullName: z.string().trim().min(1, 'Requerido').max(150, 'Máximo 150 caracteres'),
  roleIds: z.array(z.string()).min(1, 'Elige al menos un rol: sin rol no verá ningún módulo'),
  isActive: z.boolean(),
})

type FormValues = z.infer<typeof baseSchema>

function UserFormDialog({
  open,
  user,
  onClose,
  onCreated,
}: {
  open: boolean
  user: User | null
  onClose: () => void
  onCreated: (access: UserAccess) => void
}) {
  const isEdit = !!user
  const roles = useRoles()
  const create = useCreateUser()
  const update = useUpdateUser()
  const { user: me } = useSession()
  const pending = create.isPending || update.isPending

  const form = useForm<FormValues>({ resolver: zodResolver(baseSchema) })
  const { errors } = form.formState

  useEffect(() => {
    if (!open) return
    form.reset({
      username: user?.username ?? '',
      email: user?.email ?? '',
      fullName: user?.fullName ?? '',
      roleIds: user ? namesToIds(user.roles, roles.data ?? []) : [],
      isActive: user?.isActive ?? true,
    })
  }, [open, user, roles.data, form])

  function onSubmit(values: FormValues) {
    if (user) {
      const rolesChanged =
        [...namesToIds(user.roles, roles.data ?? [])].sort().join() !== [...values.roleIds].sort().join()
      update.mutate(
        {
          id: user.userId,
          // branchId no se edita aún (no hay endpoint de sucursales): se conserva el actual.
          body: { email: values.email, fullName: values.fullName, branchId: user.branchId, isActive: values.isActive },
          roleIds: rolesChanged ? values.roleIds : null,
        },
        { onSuccess: onClose },
      )
    } else {
      create.mutate(
        {
          username: values.username,
          email: values.email,
          fullName: values.fullName,
          branchId: null,
          roleIds: values.roleIds,
        },
        {
          onSuccess: (result) => {
            onClose()
            onCreated(result)
          },
        },
      )
    }
  }

  const isSelf = user?.userId === me?.userId

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={isEdit ? 'Editar usuario' : 'Nuevo usuario'}
      description={isEdit ? `@${user.username}` : undefined}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={pending}>
            Cancelar
          </Button>
          <Button type="submit" form="user-form" loading={pending}>
            Guardar
          </Button>
        </>
      }
    >
      <form id="user-form" noValidate className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
        {!isEdit && (
          <Field label="Usuario" htmlFor="u-username" required error={errors.username?.message}>
            <Input id="u-username" autoComplete="off" aria-invalid={!!errors.username} {...form.register('username')} />
          </Field>
        )}
        <Field label="Nombre completo" htmlFor="u-fullname" required error={errors.fullName?.message}>
          <Input id="u-fullname" aria-invalid={!!errors.fullName} {...form.register('fullName')} />
        </Field>
        <Field
          label="Correo"
          htmlFor="u-email"
          required
          error={errors.email?.message}
          hint={isEdit ? undefined : 'Le llegará su usuario y una contraseña temporal, que deberá cambiar al ingresar.'}
        >
          <Input id="u-email" type="email" aria-invalid={!!errors.email} {...form.register('email')} />
        </Field>

        <fieldset>
          <legend className="mb-2 text-sm font-medium text-slate-700">Roles</legend>
          {roles.isPending ? (
            <p className="text-sm text-slate-500">Cargando roles…</p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              {roles.data?.map((r) => (
                <label key={r.roleId} className="flex items-start gap-2 rounded-lg p-2 text-sm ring-1 ring-slate-200 hover:bg-slate-50">
                  <Checkbox value={r.roleId} className="mt-0.5" {...form.register('roleIds')} />
                  <span>
                    <span className="font-medium text-slate-800">{r.name}</span>
                    {r.description && <span className="block text-xs text-slate-500">{r.description}</span>}
                  </span>
                </label>
              ))}
            </div>
          )}
          {errors.roleIds && (
            <p role="alert" className="mt-1.5 text-xs text-red-600">
              {errors.roleIds.message}
            </p>
          )}
        </fieldset>

        {isEdit &&
          (isSelf ? (
            <p className="text-xs text-slate-500">No puedes desactivar tu propia cuenta.</p>
          ) : (
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <Checkbox {...form.register('isActive')} />
              Activo
            </label>
          ))}
      </form>
    </Dialog>
  )
}

/** `UserDto.roles` trae nombres; la API de asignación pide IDs. */
function namesToIds(names: string[], roles: Role[]) {
  return roles.filter((r) => names.includes(r.name)).map((r) => r.roleId)
}

/** "Pendiente de activar": aún no cambia su contraseña temporal. "Acceso vencido": la temporal ya caducó. */
function AccessBadge({ expiresAt }: { expiresAt: string | null }) {
  const [now] = useState(() => Date.now())
  const expired = !!expiresAt && new Date(expiresAt).getTime() <= now
  return expired ? <Badge tone="danger">Acceso vencido</Badge> : <Badge tone="warning">Pendiente de activar</Badge>
}

/** Muestra la contraseña temporal una sola vez, con botón para copiarla. */
function AccessDialog({ access, onClose }: { access: UserAccess | null; onClose: () => void }) {
  const [copied, setCopied] = useState(false)

  async function copy() {
    if (!access) return
    try {
      await navigator.clipboard.writeText(access.temporaryPassword)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error('No se pudo copiar', { description: 'Selecciona la contraseña y cópiala manualmente.' })
    }
  }

  return (
    <Dialog
      open={!!access}
      onClose={onClose}
      title="Acceso generado"
      description={access ? `@${access.user.username} · ${access.user.email}` : undefined}
      footer={<Button onClick={onClose}>Listo</Button>}
    >
      {access && (
        <div className="space-y-4 text-sm text-slate-600">
          <p>Se le envió su usuario y esta contraseña temporal por correo. Si no le llega, entrégasela tú: solo se muestra esta vez.</p>
          <div className="flex items-center gap-2 rounded-lg bg-slate-50 p-3 ring-1 ring-slate-200">
            <code className="flex-1 font-mono text-lg font-semibold tracking-wider text-slate-900 select-all">{access.temporaryPassword}</code>
            <Button variant="secondary" size="sm" onClick={copy}>
              {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
              {copied ? 'Copiada' : 'Copiar'}
            </Button>
          </div>
          <p>
            Válida hasta el <strong className="text-slate-800">{formatDateTime(access.expiresAt)}</strong>; al ingresar, el sistema le pedirá
            crear su propia contraseña.
          </p>
        </div>
      )}
    </Dialog>
  )
}
