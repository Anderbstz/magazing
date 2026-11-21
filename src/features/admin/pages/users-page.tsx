import { zodResolver } from '@hookform/resolvers/zod'
import { Pencil, Plus, Search } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
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
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table'
import { P } from '@/config/permissions'
import { Can } from '@/features/auth/guards'
import { useSession } from '@/features/auth/use-auth'
import { useDebouncedValue } from '@/hooks/use-debounced-value'
import { formatDateTime } from '@/lib/format'
import type { Role, User } from '../api'
import { useCreateUser, useRoles, useUpdateUser, useUsers } from '../queries'

const PAGE_SIZE = 20

export function UsersPage() {
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebouncedValue(search.trim())
  const users = useUsers({ page, pageSize: PAGE_SIZE, search: debouncedSearch })

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<User | null>(null)

  function openForm(user: User | null) {
    setEditing(user)
    setFormOpen(true)
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
                      <ActiveBadge active={u.isActive} />
                    </TD>
                    <TD>
                      <Can permission={P.UsersManage}>
                        <Button variant="ghost" size="icon" title="Editar" aria-label={`Editar ${u.username}`} onClick={() => openForm(u)}>
                          <Pencil className="size-4" />
                        </Button>
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

      <UserFormDialog open={formOpen} user={editing} onClose={() => setFormOpen(false)} />
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
  password: z.string(),
  roleIds: z.array(z.string()),
  isActive: z.boolean(),
})

// La contraseña solo se pide al crear; el backend no tiene endpoint para cambiarla aquí.
const createSchema = baseSchema.extend({ password: z.string().min(8, 'Mínimo 8 caracteres') })

type FormValues = z.infer<typeof baseSchema>

function UserFormDialog({ open, user, onClose }: { open: boolean; user: User | null; onClose: () => void }) {
  const isEdit = !!user
  const roles = useRoles()
  const create = useCreateUser()
  const update = useUpdateUser()
  const { user: me } = useSession()
  const pending = create.isPending || update.isPending

  const form = useForm<FormValues>({ resolver: zodResolver(isEdit ? baseSchema : createSchema) })
  const { errors } = form.formState

  useEffect(() => {
    if (!open) return
    form.reset({
      username: user?.username ?? '',
      email: user?.email ?? '',
      fullName: user?.fullName ?? '',
      password: '',
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
          password: values.password,
          fullName: values.fullName,
          branchId: null,
          roleIds: values.roleIds,
        },
        { onSuccess: onClose },
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
        <Field label="Correo" htmlFor="u-email" required error={errors.email?.message}>
          <Input id="u-email" type="email" aria-invalid={!!errors.email} {...form.register('email')} />
        </Field>
        {!isEdit && (
          <Field label="Contraseña" htmlFor="u-password" required error={errors.password?.message} hint="Mínimo 8 caracteres.">
            <Input
              id="u-password"
              type="password"
              autoComplete="new-password"
              aria-invalid={!!errors.password}
              {...form.register('password')}
            />
          </Field>
        )}

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
