import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { Navigate, useLocation, useNavigate } from 'react-router'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { queryClient } from '@/lib/query-client'
import { authApi } from '../api'
import { session } from '../session'
import { useSession } from '../use-auth'

const schema = z.object({
  username: z.string().trim().min(1, 'Ingresa tu usuario'),
  password: z.string().min(1, 'Ingresa tu contraseña'),
})

type FormValues = z.infer<typeof schema>

const YEAR = new Date().getFullYear()

export function LoginPage() {
  const { status } = useSession()
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: string } | null)?.from ?? '/'

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { username: '', password: '' },
  })

  const login = useMutation({
    mutationFn: authApi.login,
    meta: { silent: true },
    onSuccess: (response) => {
      queryClient.clear()
      session.start(response)
      navigate(from, { replace: true })
    },
  })

  const slow = useSlowFlag(login.isPending)

  if (status === 'authenticated') return <Navigate to={from} replace />

  return (
    <div className="flex min-h-full">
      <aside className="relative hidden w-[44%] flex-col justify-between overflow-hidden bg-brand-900 p-10 text-white lg:flex">
        <div className="flex items-center gap-3">
          <Logo />
          <span className="text-lg font-semibold">Magazing</span>
        </div>
        <div className="relative z-10 max-w-md">
          <h2 className="text-3xl leading-tight font-semibold">Inventario, compras y ventas de tu tienda en un solo lugar.</h2>
          <p className="mt-4 text-brand-100/80">
            Kardex en tiempo real, costo promedio ponderado, comprobantes con serie y predicción de demanda.
          </p>
        </div>
        <p className="text-xs text-brand-100/60">© {YEAR} Magazing</p>
        <div className="absolute -right-24 -bottom-24 size-96 rounded-full bg-brand-700/40 blur-3xl" aria-hidden />
      </aside>

      <main className="flex flex-1 items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <Logo />
            <span className="text-lg font-semibold">Magazing</span>
          </div>

          <h1 className="text-2xl font-semibold tracking-tight">Inicia sesión</h1>
          <p className="mt-1 text-sm text-slate-500">Ingresa con tu usuario y contraseña.</p>

          <form className="mt-8 space-y-5" noValidate onSubmit={form.handleSubmit((values) => login.mutate(values))}>
            <Field label="Usuario" htmlFor="username" error={form.formState.errors.username?.message}>
              <Input
                id="username"
                autoComplete="username"
                autoFocus
                aria-invalid={!!form.formState.errors.username}
                {...form.register('username')}
              />
            </Field>

            <Field label="Contraseña" htmlFor="password" error={form.formState.errors.password?.message}>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                aria-invalid={!!form.formState.errors.password}
                {...form.register('password')}
              />
            </Field>

            {login.error && (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-200" role="alert">
                {login.error.message}
              </p>
            )}

            <Button type="submit" className="w-full" loading={login.isPending}>
              Ingresar
            </Button>

            {slow && (
              <p className="text-center text-xs text-slate-500" role="status">
                El servidor estaba en reposo y está despertando. Puede tardar hasta un minuto.
              </p>
            )}
          </form>
        </div>
      </main>
    </div>
  )
}

function Logo() {
  return (
    <div className="flex size-9 items-center justify-center rounded-lg bg-brand-600 font-bold text-white ring-1 ring-white/20">
      M
    </div>
  )
}

/** true si `active` lleva más de 4 s encendido. */
function useSlowFlag(active: boolean) {
  const [slow, setSlow] = useState(false)
  useEffect(() => {
    if (!active) return
    const id = setTimeout(() => setSlow(true), 4000)
    return () => {
      clearTimeout(id)
      setSlow(false)
    }
  }, [active])
  return active && slow
}
