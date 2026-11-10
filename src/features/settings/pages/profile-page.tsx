import { zodResolver } from '@hookform/resolvers/zod'
import { useQuery } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { http } from '@/api/http'
import { PageHeader } from '@/components/page-header'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardHeader } from '@/components/ui/card'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { MODULE_LABELS } from '@/config/permissions'
import type { User } from '@/features/admin/api'
import { useSession } from '@/features/auth/use-auth'
import { formatDateTime } from '@/lib/format'
import { useChangePassword } from '../queries'

/** Los permisos llegan como `modulo.accion`; se agrupan por módulo para leerlos mejor. */
const PERMISSION_MODULE: Record<string, string> = {
  users: 'security',
  catalog: 'catalog',
  prices: 'catalog',
  inventory: 'inventory',
  transfers: 'inventory',
  warehouses: 'inventory',
  suppliers: 'purchases',
  purchases: 'purchases',
  customers: 'sales',
  sales: 'sales',
  reports: 'reports',
  alerts: 'ml',
  predictions: 'ml',
}

export function ProfilePage() {
  const { user } = useSession()
  // `/auth/me` es real: devuelve los datos completos del usuario conectado.
  const me = useQuery({ queryKey: ['auth', 'me'], queryFn: () => http.get<User>('/auth/me').then((r) => r.data) })

  const grouped = new Map<string, string[]>()
  for (const p of user?.permissions ?? []) {
    const module = MODULE_LABELS[PERMISSION_MODULE[p.split('.')[0]] ?? ''] ?? 'Otros'
    grouped.set(module, [...(grouped.get(module) ?? []), p])
  }

  return (
    <>
      <PageHeader title="Mi perfil" />
      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          <Card className="flex items-center gap-4 p-5">
            <div className="flex size-14 items-center justify-center rounded-full bg-brand-100 text-lg font-semibold text-brand-800 uppercase">
              {user?.username.slice(0, 2)}
            </div>
            <div className="min-w-0">
              <p className="truncate text-lg font-semibold text-slate-900">{me.data?.fullName ?? user?.username}</p>
              <p className="text-sm text-slate-500">
                @{user?.username}
                {me.data?.email && ` · ${me.data.email}`}
              </p>
              <p className="mt-0.5 text-xs text-slate-400">Último ingreso: {formatDateTime(me.data?.lastLoginAt)}</p>
            </div>
            <div className="ml-auto flex flex-wrap justify-end gap-1">
              {user?.roles.map((r) => (
                <Badge key={r} tone="info">
                  {r}
                </Badge>
              ))}
            </div>
          </Card>

          <Card>
            <CardHeader title="Lo que puedes hacer" description={`${user?.permissions.length ?? 0} permisos según tus roles.`} />
            <div className="grid gap-4 p-5 sm:grid-cols-2">
              {[...grouped.entries()].map(([module, perms]) => (
                <div key={module}>
                  <p className="mb-1.5 text-xs font-semibold tracking-wide text-slate-500 uppercase">{module}</p>
                  <div className="flex flex-wrap gap-1">
                    {perms.map((p) => (
                      <code key={p} className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-600">
                        {p}
                      </code>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>

        <ChangePasswordCard />
      </div>
    </>
  )
}

const schema = z
  .object({
    currentPassword: z.string().min(1, 'Ingresa tu contraseña actual'),
    newPassword: z.string().min(8, 'Mínimo 8 caracteres'),
    confirm: z.string(),
  })
  .refine((v) => v.newPassword === v.confirm, { path: ['confirm'], message: 'No coincide con la nueva contraseña' })
  .refine((v) => v.newPassword !== v.currentPassword, { path: ['newPassword'], message: 'Debe ser distinta de la actual' })
type FormValues = z.infer<typeof schema>

function ChangePasswordCard() {
  const change = useChangePassword()
  const form = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { currentPassword: '', newPassword: '', confirm: '' } })
  const { errors } = form.formState

  return (
    <Card className="self-start">
      <CardHeader title="Cambiar contraseña" />
      <form
        noValidate
        className="space-y-4 p-5"
        onSubmit={form.handleSubmit(({ currentPassword, newPassword }) =>
          change.mutate({ currentPassword, newPassword }, { onSuccess: () => form.reset() }),
        )}
      >
        <Field label="Contraseña actual" htmlFor="pw-current" required error={errors.currentPassword?.message}>
          <Input id="pw-current" type="password" autoComplete="current-password" aria-invalid={!!errors.currentPassword} {...form.register('currentPassword')} />
        </Field>
        <Field label="Nueva contraseña" htmlFor="pw-new" required error={errors.newPassword?.message} hint="Mínimo 8 caracteres.">
          <Input id="pw-new" type="password" autoComplete="new-password" aria-invalid={!!errors.newPassword} {...form.register('newPassword')} />
        </Field>
        <Field label="Repite la nueva contraseña" htmlFor="pw-confirm" required error={errors.confirm?.message}>
          <Input id="pw-confirm" type="password" autoComplete="new-password" aria-invalid={!!errors.confirm} {...form.register('confirm')} />
        </Field>
        <Button type="submit" className="w-full" loading={change.isPending}>
          Actualizar contraseña
        </Button>
      </form>
    </Card>
  )
}
