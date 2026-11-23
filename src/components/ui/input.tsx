import type { InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

const base =
  'block w-full rounded-lg border-0 bg-white px-3 text-sm text-slate-900 ring-1 ring-inset ring-slate-300 ' +
  'placeholder:text-slate-400 focus:ring-2 focus:ring-inset focus:ring-brand-600 focus:outline-none ' +
  'disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500 ' +
  'aria-invalid:ring-red-500'

const ALLOWED = {
  /** DNI, RUC, códigos de barras: solo dígitos. */
  digits: /[^0-9]/g,
  /** Teléfonos: dígitos, espacios, guiones, paréntesis y el + inicial. */
  phone: /[^0-9+\-() ]/g,
} as const

/** Teclas que `type="number"` acepta pero que aquí no tienen sentido (notación científica y signos). */
const NUMBER_BLOCKED_KEYS = new Set(['e', 'E', '+', '-'])

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  /** Restringe lo que se puede escribir; lo demás se descarta al teclear o pegar. */
  allow?: keyof typeof ALLOWED
}

export function Input({ className, allow, onChange, onKeyDown, onWheel, ...props }: InputProps) {
  const isNumber = props.type === 'number'
  return (
    <input
      className={cn(base, 'h-10', className)}
      inputMode={allow === 'digits' ? 'numeric' : allow === 'phone' ? 'tel' : isNumber ? 'decimal' : props.inputMode}
      onChange={(e) => {
        if (allow) {
          const clean = e.target.value.replace(ALLOWED[allow], '')
          if (clean !== e.target.value) e.target.value = clean
        }
        onChange?.(e)
      }}
      onKeyDown={(e) => {
        if (isNumber && NUMBER_BLOCKED_KEYS.has(e.key)) e.preventDefault()
        onKeyDown?.(e)
      }}
      // Evita que la rueda del mouse cambie la cantidad sin querer al desplazarse por la página.
      onWheel={(e) => {
        if (isNumber) e.currentTarget.blur()
        onWheel?.(e)
      }}
      {...props}
    />
  )
}

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(base, 'min-h-20 py-2', className)} {...props} />
}

/**
 * `<select>` nativo con estilo propio (ver `.select-ui` en index.css). Se mantiene nativo:
 * accesible, funciona con teclado y lector de pantalla, abre el selector del sistema en móvil
 * y se registra directo con react-hook-form. En navegadores con `appearance: base-select`
 * (Chrome/Edge 135+) también se estiliza la lista abierta; en el resto se ve la del sistema.
 */
export function Select({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cn(base, 'select-ui h-10 cursor-pointer pr-9 hover:ring-slate-400', className)} {...props}>
      {children}
    </select>
  )
}

export function Checkbox({ className, ...props }: Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>) {
  return (
    <input
      type="checkbox"
      className={cn('size-4 rounded border-slate-300 accent-brand-700', className)}
      {...props}
    />
  )
}
