import { z } from 'zod'

/**
 * Helpers para que los inputs HTML (que siempre dan texto) encajen con los DTO del backend.
 * Se usan con `register('campo', { setValueAs: ... })`.
 */
export const asNumber = (v: unknown) => (v === '' || v == null ? Number.NaN : Number(v))
export const asNullableNumber = (v: unknown) => (v === '' || v == null ? null : Number(v))

/** Texto opcional: '' → null, para que el backend guarde NULL y no cadena vacía. */
export const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Máximo ${max} caracteres`)
    .transform((v) => (v === '' ? null : v))

/** Guid opcional elegido en un <select>: '' → null. */
export const optionalId = z.string().transform((v) => (v === '' ? null : v))

export const money = z
  .number({ error: 'Ingresa un monto' })
  .min(0, 'No puede ser negativo')
  .max(9_999_999_999.99, 'Monto demasiado alto')
  .refine((v) => Math.abs(v * 100 - Math.round(v * 100)) < 1e-6, 'Máximo 2 decimales')

export const quantity = z.number({ error: 'Ingresa una cantidad' }).min(0, 'No puede ser negativa')
