import { zodResolver } from '@hookform/resolvers/zod'
import { KeyRound, Plus } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { PageHeader } from '@/components/page-header'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Dialog } from '@/components/ui/dialog'
import { Field } from '@/components/ui/field'
import { Checkbox, Input } from '@/components/ui/input'
import { LoadingBlock } from '@/components/ui/spinner'
import { EmptyState, ErrorState } from '@/components/ui/states'
import { MODULE_LABELS, P } from '@/config/permissions'
import { Can } from '@/features/auth/guards'
import { useCan } from '@/features/auth/use-auth'
import { optionalText } from '@/lib/forms'
import type { PermissionItem, Role } from '../api'
import { useCreateRole, usePermissions, useRoles, useUpdateRolePermissions } from '../queries'

export function RolesPage() {
  const roles = useRoles()
  const permissions = usePermissions()
  const [createOpen, setCreateOpen] = useState(false)
  const [editing, setEditing] = useState<Role | null>(null)
  const can = useCan()

  const total = permissions.data?.length ?? 0

  return (
    <>
      <PageHeader
        title="Roles y permisos"
        description="Cada rol agrupa permisos. Un usuario puede tener varios roles."
        actions={
          <Can permission={P.UsersManage}>
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="size-4" /> Nuevo rol
            </Button>
          </Can>
        }
      />

      {roles.isPending ? (
        <LoadingBlock />
      ) : roles.isError ? (
        <Card>
          <ErrorState error={roles.error} onRetry={() => roles.refetch()} />
        </Card>
      ) : roles.data.length === 0 ? (
        <Card>
          <EmptyState title="Aún no hay roles" />
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {roles.data.map((role) => (
            <Card key={role.roleId} className="flex flex-col p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="font-semibold text-slate-900">{role.name}</h2>
                  <p className="mt-0.5 text-sm text-slate-500">{role.description ?? 'Sin descripción'}</p>
                </div>
                <Badge tone="info" className="tabular shrink-0">
                  {role.permissions.length}/{total || '…'}
                </Badge>
              </div>
              <div className="mt-4 flex flex-1 flex-wrap content-start gap-1">
                {role.permissions.slice(0, 8).map((code) => (
                  <code key={code} className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-600">
                    {code}
                  </code>
                ))}
                {role.permissions.length > 8 && (
                  <span className="px-1 text-xs text-slate-500">+{role.permissions.length - 8} más</span>
                )}
              </div>
              <Button
                variant="secondary"
                size="sm"
                className="mt-4 self-start"
                onClick={() => setEditing(role)}
                disabled={!permissions.data}
              >
                <KeyRound className="size-4" /> {can(P.UsersManage) ? 'Editar permisos' : 'Ver permisos'}
              </Button>
            </Card>
          ))}
        </div>
      )}

      {/* Se montan al abrirse: así cada apertura arranca con el estado limpio. */}
      {createOpen && <CreateRoleDialog permissions={permissions.data ?? []} onClose={() => setCreateOpen(false)} />}
      {editing && (
        <RolePermissionsDialog
          key={editing.roleId}
          role={editing}
          permissions={permissions.data ?? []}
          onClose={() => setEditing(null)}
        />
      )}
    </>
  )
}

// ── Selector de permisos agrupado por módulo ─────────────────────────────────

function PermissionPicker({
  permissions,
  selected,
  onChange,
  readOnly,
}: {
  permissions: PermissionItem[]
  selected: Set<string>
  onChange: (next: Set<string>) => void
  readOnly?: boolean
}) {
  const groups = useMemo(() => {
    const map = new Map<string, PermissionItem[]>()
    for (const p of permissions) map.set(p.module, [...(map.get(p.module) ?? []), p])
    return [...map.entries()]
  }, [permissions])

  function toggle(ids: string[], on: boolean) {
    const next = new Set(selected)
    ids.forEach((id) => (on ? next.add(id) : next.delete(id)))
    onChange(next)
  }

  return (
    <div className="space-y-4">
      {groups.map(([module, items]) => {
        const ids = items.map((i) => i.permissionId)
        const all = ids.every((id) => selected.has(id))
        return (
          <fieldset key={module} className="rounded-lg ring-1 ring-slate-200">
            <legend className="sr-only">{MODULE_LABELS[module] ?? module}</legend>
            <label className="flex items-center gap-2 border-b border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-800">
              <Checkbox checked={all} disabled={readOnly} onChange={(e) => toggle(ids, e.target.checked)} />
              {MODULE_LABELS[module] ?? module}
            </label>
            <div className="grid gap-1 p-2 sm:grid-cols-2">
              {items.map((p) => (
                <label key={p.permissionId} className="flex items-start gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-slate-50">
                  <Checkbox
                    className="mt-0.5"
                    checked={selected.has(p.permissionId)}
                    disabled={readOnly}
                    onChange={(e) => toggle([p.permissionId], e.target.checked)}
                  />
                  <span>
                    <span className="text-slate-800">{p.description ?? p.code}</span>
                    <code className="block text-[11px] text-slate-400">{p.code}</code>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
        )
      })}
    </div>
  )
}

/** `RoleDto.permissions` trae códigos; la API pide IDs. */
function codesToIds(codes: string[], permissions: PermissionItem[]) {
  return new Set(permissions.filter((p) => codes.includes(p.code)).map((p) => p.permissionId))
}

function RolePermissionsDialog({
  role,
  permissions,
  onClose,
}: {
  role: Role
  permissions: PermissionItem[]
  onClose: () => void
}) {
  const can = useCan()
  const readOnly = !can(P.UsersManage)
  const update = useUpdateRolePermissions()
  const [selected, setSelected] = useState(() => codesToIds(role.permissions, permissions))

  return (
    <Dialog
      open
      onClose={onClose}
      size="lg"
      title={`Permisos de ${role.name}`}
      description={`${selected.size} de ${permissions.length} permisos`}
      footer={
        readOnly ? (
          <Button variant="secondary" onClick={onClose}>
            Cerrar
          </Button>
        ) : (
          <>
            <Button variant="secondary" onClick={onClose} disabled={update.isPending}>
              Cancelar
            </Button>
            <Button
              loading={update.isPending}
              onClick={() => update.mutate({ id: role.roleId, permissionIds: [...selected] }, { onSuccess: onClose })}
            >
              Guardar permisos
            </Button>
          </>
        )
      }
    >
      <PermissionPicker permissions={permissions} selected={selected} onChange={setSelected} readOnly={readOnly} />
    </Dialog>
  )
}

const roleSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Requerido')
    .max(50, 'Máximo 50 caracteres')
    .transform((v) => v.toUpperCase()),
  description: optionalText(255),
})
type RoleInput = z.input<typeof roleSchema>
type RoleOutput = z.output<typeof roleSchema>

function CreateRoleDialog({ permissions, onClose }: { permissions: PermissionItem[]; onClose: () => void }) {
  const create = useCreateRole()
  const [selected, setSelected] = useState<Set<string>>(() => new Set())
  const form = useForm<RoleInput, unknown, RoleOutput>({
    resolver: zodResolver(roleSchema),
    defaultValues: { name: '', description: '' },
  })
  const { errors } = form.formState

  return (
    <Dialog
      open
      onClose={onClose}
      size="lg"
      title="Nuevo rol"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={create.isPending}>
            Cancelar
          </Button>
          <Button type="submit" form="role-form" loading={create.isPending}>
            Crear rol
          </Button>
        </>
      }
    >
      <form
        id="role-form"
        noValidate
        className="space-y-4"
        onSubmit={form.handleSubmit((values) =>
          create.mutate({ ...values, permissionIds: [...selected] }, { onSuccess: onClose }),
        )}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nombre" htmlFor="role-name" required error={errors.name?.message} hint="Se guarda en mayúsculas, por ejemplo CAJERO.">
            <Input id="role-name" className="uppercase" aria-invalid={!!errors.name} {...form.register('name')} />
          </Field>
          <Field label="Descripción" htmlFor="role-desc" error={errors.description?.message}>
            <Input id="role-desc" {...form.register('description')} />
          </Field>
        </div>
        <PermissionPicker permissions={permissions} selected={selected} onChange={setSelected} />
      </form>
    </Dialog>
  )
}
