import { useState } from 'react'

/**
 * useState que recuerda el valor en localStorage (preferencias de la pantalla, no datos).
 * Si el valor guardado ya no es válido, o el navegador bloquea el almacenamiento, usa el inicial.
 */
export function useStoredState<T extends string>(key: string, initial: T, allowed: readonly T[]) {
  const [value, setValue] = useState<T>(() => {
    try {
      const saved = localStorage.getItem(key) as T | null
      return saved && allowed.includes(saved) ? saved : initial
    } catch {
      return initial
    }
  })

  function update(next: T) {
    setValue(next)
    try {
      localStorage.setItem(key, next)
    } catch {
      // Sin almacenamiento disponible: la preferencia dura solo esta sesión.
    }
  }

  return [value, update] as const
}
