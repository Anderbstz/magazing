import { zodResolver } from '@hookform/resolvers/zod'
import { KeyRound, LogOut } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { useNavigate } from 'react-router'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { useChangePassword } from '@/features/settings/queries'
import { queryClient } from '@/lib/query-client'
import { logout, signInAgain } from '../session'
import { useSession } from '../use-auth'

const schema = z
  .object({
    currentPassword: z.string().min(1, 'Ingresa la contraseña temporal que te llegó'),
    newPassword: z.string().min(8, 'Mínimo 8 caracteres'),
    confirm: z.string(),
  })
  .refine((v) => v.newPassword === v.confirm, { path: ['confirm'], message: 'No coincide con la nueva contraseña' })
  .refine((v) => v.newPassword !== v.currentPassword, { path: ['newPassword'], message: 'Debe ser distinta de la temporal' })
type FormValues = z.infer<typeof schema>

/**
 * Primer ingreso con contraseña temporal: hasta crear una propia, la API rechaza todo lo demás.
 * Al cambiarla, el backend cierra las sesiones abiertas, así que se vuelve a iniciar sesión solo.
 */
export function ChangeTemporaryPasswordPage() {
  const { user } = useSession()
  const navigate = useNavigate()
  const change = useChangePassword()
  const form = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { currentPassword: '', newPassword: '', confirm: '' } })
  const { errors, isSubmitting } = form.formState

  async function onSubmit({ currentPassword, newPassword }: FormValues) {
    await change.mutateAsync({ currentPassword, newPassword }).then(
      () => signInAgain(user!.username, newPassword),
      () => undefined,
    )
  }

  async function handleLogout() {
    await logout()
    queryClient.clear()
    navigate('/login', { replace: true })
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-slate-50/60 px-6 py-12">
      <div className="w-full max-w-[420px] rounded-2xl bg-white p-8 shadow-[0_1px_2px_rgb(15_23_42/0.04),0_8px_32px_-8px_rgb(15_23_42/0.12)] ring-1 ring-slate-200/80 sm:p-10">
        <div className="mb-8 flex items-center gap-3">
          <img src="/logo.png" alt="" className="size-9" />
          <span className="text-lg font-semibold tracking-tight">Magazing</span>
        </div>

        <div className="mb-6 flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-700">
            <KeyRound className="size-5" aria-hidden />
          </span>
          <div>
            <h1 className="text-xl font-semibold text-slate-900">Crea tu contraseña</h1>
            <p className="mt-1 text-sm text-slate-500">
              Hola, @{user?.username}. Ingresaste con una contraseña temporal: elige una propia para continuar.
            </p>
          </div>
        </div>

        <form noValidate className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
          <Field label="Contraseña temporal" htmlFor="tp-current" required error={errors.currentPassword?.message}>
            <Input id="tp-current" type="password" autoComplete="current-password" autoFocus aria-invalid={!!errors.currentPassword} {...form.register('currentPassword')} />
          </Field>
          <Field label="Nueva contraseña" htmlFor="tp-new" required error={errors.newPassword?.message} hint="Mínimo 8 caracteres.">
            <Input id="tp-new" type="password" autoComplete="new-password" aria-invalid={!!errors.newPassword} {...form.register('newPassword')} />
          </Field>
          <Field label="Repite la nueva contraseña" htmlFor="tp-confirm" required error={errors.confirm?.message}>
            <Input id="tp-confirm" type="password" autoComplete="new-password" aria-invalid={!!errors.confirm} {...form.register('confirm')} />
          </Field>
          <Button type="submit" className="w-full" loading={isSubmitting}>
            Guardar y entrar
          </Button>
        </form>

        <button type="button" onClick={handleLogout} className="mt-6 inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800">
          <LogOut className="size-4" aria-hidden /> Salir
        </button>
      </div>
    </div>
  )
}
