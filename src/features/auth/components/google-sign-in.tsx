import { useEffect, useRef, useState } from 'react'

const CLIENT_ID: string | undefined = import.meta.env.VITE_GOOGLE_CLIENT_ID || undefined
const SCRIPT_SRC = 'https://accounts.google.com/gsi/client'

/** Lo mínimo de Google Identity Services que se usa aquí. */
interface GoogleIdentity {
  accounts: {
    id: {
      initialize(config: { client_id: string; callback: (response: { credential?: string }) => void; ux_mode?: 'popup'; auto_select?: boolean }): void
      renderButton(parent: HTMLElement, options: Record<string, string | number>): void
    }
  }
}

declare global {
  interface Window {
    google?: GoogleIdentity
  }
}

let scriptPromise: Promise<GoogleIdentity> | null = null

/** Carga el script de Google una sola vez, aunque el login se monte varias veces. */
function loadGoogle(): Promise<GoogleIdentity> {
  if (window.google) return Promise.resolve(window.google)
  scriptPromise ??= new Promise<GoogleIdentity>((resolve, reject) => {
    const script = document.createElement('script')
    script.src = SCRIPT_SRC
    script.async = true
    script.onload = () => (window.google ? resolve(window.google) : reject(new Error('Google no respondió')))
    script.onerror = () => {
      scriptPromise = null
      reject(new Error('No se pudo cargar Google'))
    }
    document.head.appendChild(script)
  })
  return scriptPromise
}

/**
 * Botón oficial "Acceder con Google". Google abre su propio popup y entrega un ID token firmado;
 * la contraseña de Google nunca pasa por Magazing. No se muestra si no hay `VITE_GOOGLE_CLIENT_ID`.
 */
export function GoogleSignInButton({ onCredential, disabled }: { onCredential: (idToken: string) => void; disabled?: boolean }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const callbackRef = useRef(onCredential)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    callbackRef.current = onCredential
  }, [onCredential])

  useEffect(() => {
    if (!CLIENT_ID) return
    let cancelled = false
    loadGoogle()
      .then((google) => {
        const container = containerRef.current
        if (cancelled || !container) return
        google.accounts.id.initialize({
          client_id: CLIENT_ID,
          ux_mode: 'popup',
          auto_select: false,
          callback: (response) => {
            if (response.credential) callbackRef.current(response.credential)
          },
        })
        google.accounts.id.renderButton(container, {
          type: 'standard',
          theme: 'outline',
          size: 'large',
          text: 'signin_with',
          shape: 'rectangular',
          logo_alignment: 'center',
          locale: 'es',
          width: Math.min(Math.max(container.offsetWidth, 200), 400),
        })
      })
      .catch(() => !cancelled && setFailed(true))
    return () => {
      cancelled = true
    }
  }, [])

  if (!CLIENT_ID) return null

  if (failed) {
    return <p className="text-center text-xs text-slate-500">No se pudo cargar el acceso con Google. Revisa tu conexión.</p>
  }

  return (
    <div
      ref={containerRef}
      className={disabled ? 'pointer-events-none flex h-11 w-full justify-center opacity-60' : 'flex h-11 w-full justify-center'}
      aria-busy={disabled}
    />
  )
}
