import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation } from '@tanstack/react-query'
import { AlertCircle, ArrowUp, BrainCircuit, Eye, EyeOff, Receipt, ScrollText, ShieldCheck, TrendingUp } from 'lucide-react'
import { useEffect, useState, type KeyboardEvent } from 'react'
import { useForm } from 'react-hook-form'
import { Navigate, useLocation, useNavigate } from 'react-router'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/field'
import { Checkbox, Input } from '@/components/ui/input'
import { queryClient } from '@/lib/query-client'
import { authApi } from '../api'
import { session } from '../session'
import { useSession } from '../use-auth'

const schema = z.object({
  username: z.string().trim().min(1, 'Ingresa tu usuario'),
  password: z.string().min(1, 'Ingresa tu contraseña'),
  remember: z.boolean(),
})

type FormValues = z.infer<typeof schema>

const YEAR = new Date().getFullYear()
const REMEMBER_KEY = 'magazing.lastUsername'

function readRemembered() {
  try {
    return localStorage.getItem(REMEMBER_KEY) ?? ''
  } catch {
    return ''
  }
}

function writeRemembered(username: string | null) {
  try {
    if (username) localStorage.setItem(REMEMBER_KEY, username)
    else localStorage.removeItem(REMEMBER_KEY)
  } catch {
    /* almacenamiento bloqueado: no se recuerda */
  }
}

const FEATURES = [
  { icon: ScrollText, title: 'Kardex en tiempo real', text: 'Cada entrada y salida, con saldo y costo promedio.' },
  { icon: Receipt, title: 'Boletas y facturas', text: 'IGV calculado, series y correlativos automáticos.' },
  { icon: BrainCircuit, title: 'Predicción de demanda', text: 'Te avisa antes de que un producto se agote.' },
]

export function LoginPage() {
  const { status } = useSession()
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: string } | null)?.from ?? '/'
  const [remembered] = useState(readRemembered)
  const [showPassword, setShowPassword] = useState(false)
  const [capsLock, setCapsLock] = useState(false)

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { username: remembered, password: '', remember: !!remembered },
  })
  const { errors } = form.formState

  const login = useMutation({
    mutationFn: authApi.login,
    meta: { silent: true },
    onSuccess: (response, variables) => {
      writeRemembered(form.getValues('remember') ? variables.username : null)
      queryClient.clear()
      session.start(response)
      navigate(from, { replace: true })
    },
  })

  const slow = useSlowFlag(login.isPending)
  const checkCaps = (e: KeyboardEvent<HTMLInputElement>) => setCapsLock(e.getModifierState('CapsLock'))

  if (status === 'authenticated') return <Navigate to={from} replace />

  return (
    <div className="flex min-h-full bg-white">
      {/* ── Panel de marca ── */}
      <aside className="relative hidden w-[46%] max-w-[680px] flex-col justify-between overflow-hidden bg-brand-900 p-12 text-white lg:flex">
        {/* Cuadrícula sutil + halo: dan profundidad sin distraer. */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage: 'linear-gradient(to right, white 1px, transparent 1px), linear-gradient(to bottom, white 1px, transparent 1px)',
            backgroundSize: '44px 44px',
            maskImage: 'radial-gradient(ellipse at 30% 40%, black 30%, transparent 75%)',
          }}
          aria-hidden
        />
        <div className="pointer-events-none absolute -top-32 -right-32 size-[28rem] rounded-full bg-brand-500/25 blur-3xl" aria-hidden />

        <div className="relative flex items-center gap-3">
          <Logo />
          <span className="text-lg font-semibold tracking-tight">Magazing</span>
        </div>

        <div className="relative space-y-10">
          <div className="max-w-md">
            <h2 className="text-[2rem] leading-[1.15] font-semibold tracking-tight">Tu tienda, en orden desde el primer producto.</h2>
            <p className="mt-4 text-base text-brand-100/75">Inventario, compras y ventas conectados: lo que vendes hoy actualiza tu stock al instante.</p>
          </div>

          <ProductPreview />

          <ul className="grid max-w-md gap-5">
            {FEATURES.map((f) => (
              <li key={f.title} className="flex gap-3.5">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-white/10 ring-1 ring-white/15">
                  <f.icon className="size-4.5 text-brand-100" aria-hidden />
                </span>
                <span>
                  <span className="block text-sm font-medium text-white">{f.title}</span>
                  <span className="block text-sm text-brand-100/65">{f.text}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-xs text-brand-100/50">© {YEAR} Magazing · Sistema de gestión para pymes</p>
      </aside>

      {/* ── Formulario ── */}
      <main className="flex flex-1 flex-col bg-slate-50/60">
        <div className="flex flex-1 items-center justify-center px-6 py-12">
          <div className="login-enter w-full max-w-[400px] rounded-2xl bg-white p-8 shadow-[0_1px_2px_rgb(15_23_42/0.04),0_8px_32px_-8px_rgb(15_23_42/0.12)] ring-1 ring-slate-200/80 sm:p-10">
            <div className="mb-10 flex items-center gap-3 lg:hidden">
              <Logo />
              <span className="text-lg font-semibold tracking-tight">Magazing</span>
            </div>

            <h1 className="text-[1.65rem] font-semibold tracking-tight text-slate-900">{remembered ? `Hola de nuevo, ${remembered}` : 'Inicia sesión'}</h1>
            <p className="mt-1.5 text-sm text-slate-500">Ingresa con la cuenta que te dio tu administrador.</p>

            <form className="mt-8 space-y-5" noValidate onSubmit={form.handleSubmit(({ username, password }) => login.mutate({ username, password }))}>
              <Field label="Usuario" htmlFor="username" error={errors.username?.message}>
                <Input
                  id="username"
                  autoComplete="username"
                  autoCapitalize="none"
                  spellCheck={false}
                  autoFocus={!remembered}
                  aria-invalid={!!errors.username}
                  className="h-11"
                  {...form.register('username')}
                />
              </Field>

              <Field label="Contraseña" htmlFor="password" error={errors.password?.message}>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    autoFocus={!!remembered}
                    aria-invalid={!!errors.password}
                    className="h-11 pr-11"
                    onKeyDown={checkCaps}
                    onKeyUp={checkCaps}
                    {...form.register('password', { onBlur: () => setCapsLock(false) })}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="pressable absolute top-1/2 right-1.5 flex size-8 -translate-y-1/2 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                    aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                    aria-pressed={showPassword}
                  >
                    {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
                {capsLock && (
                  <p className="flex items-center gap-1 text-xs text-amber-700" role="status">
                    <ArrowUp className="size-3" aria-hidden /> Bloq Mayús está activado
                  </p>
                )}
              </Field>

              <label className="flex items-center gap-2 text-sm text-slate-600">
                <Checkbox {...form.register('remember')} /> Recordar mi usuario en este equipo
              </label>

              {login.error && (
                <p className="flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2.5 text-sm text-red-700 ring-1 ring-red-200" role="alert">
                  <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
                  {login.error.status === 401 ? 'Usuario o contraseña incorrectos.' : login.error.message}
                </p>
              )}

              <Button type="submit" className="h-11 w-full text-[15px]" loading={login.isPending}>
                {login.isPending ? 'Ingresando…' : 'Ingresar'}
              </Button>

              {slow && (
                <p className="text-center text-xs text-slate-500" role="status">
                  El servidor estaba en reposo y está despertando. Puede tardar hasta un minuto.
                </p>
              )}
            </form>

            <p className="mt-8 border-t border-slate-100 pt-6 text-center text-xs text-slate-500">
              ¿Olvidaste tu contraseña? Pide a un administrador que la restablezca.
            </p>
          </div>
        </div>
        <footer className="flex items-center justify-center gap-2 pb-6 text-xs text-slate-400">
          <ShieldCheck className="size-3.5" aria-hidden /> Sesión protegida con tokens que se renuevan solos
        </footer>
      </main>
    </div>
  )
}

/**
 * Vista previa del producto (decorativa): una tarjeta como las del panel, con barras de
 * ventas de la semana. Muestra qué hay detrás del login en vez de una ilustración genérica.
 */
function ProductPreview() {
  const bars = [38, 52, 44, 61, 57, 78, 66]
  const days = ['L', 'M', 'M', 'J', 'V', 'S', 'D']
  return (
    <div className="max-w-md rounded-2xl bg-white/[0.06] p-5 ring-1 ring-white/15 backdrop-blur-sm" aria-hidden>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-brand-100/70">Ventas de la semana</p>
          <p className="tabular mt-1 text-2xl font-semibold tracking-tight">S/ 4,084.80</p>
        </div>
        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-400/15 px-2 py-0.5 text-xs font-medium text-emerald-200">
          <TrendingUp className="size-3" /> 12.4 %
        </span>
      </div>
      <div className="mt-5 flex h-24 gap-2">
        {bars.map((h, i) => (
          <div key={i} className="flex flex-1 flex-col items-center gap-1.5">
            {/* Contenedor con altura propia: el % de cada barra se calcula sobre él. */}
            <div className="flex w-full flex-1 items-end">
              <div className={i === 5 ? 'w-full rounded-t-[4px] bg-white' : 'w-full rounded-t-[4px] bg-white/30'} style={{ height: `${h}%` }} />
            </div>
            <span className="text-[10px] text-brand-100/50">{days[i]}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function Logo() {
  return (
    <div className="flex size-9 items-center justify-center rounded-lg bg-brand-600 ring-1 ring-white/20">
      <svg viewBox="0 0 32 32" className="size-5" aria-hidden>
        <path d="M8 23V9l8 7 8-7v14" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
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
