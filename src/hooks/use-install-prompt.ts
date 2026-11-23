import { useSyncExternalStore } from 'react'

/** Evento que Chrome y Edge disparan cuando la app se puede instalar (no está en los tipos de TS). */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

let deferred: BeforeInstallPromptEvent | null = null
const listeners = new Set<() => void>()
const notify = () => listeners.forEach((listener) => listener())

// Se escucha desde que carga el módulo: el evento llega una sola vez y muy temprano.
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault()
    deferred = event as BeforeInstallPromptEvent
    notify()
  })
  window.addEventListener('appinstalled', () => {
    deferred = null
    notify()
  })
}

/**
 * Permite mostrar un botón "Instalar app" propio. `canInstall` es false si el navegador no lo
 * ofrece (Safari, Firefox) o si la app ya está instalada.
 */
export function useInstallPrompt() {
  const canInstall = useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    () => deferred !== null,
    () => false,
  )

  async function install() {
    if (!deferred) return
    const event = deferred
    await event.prompt()
    await event.userChoice
    deferred = null
    notify()
  }

  return { canInstall, install }
}
