import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router'
import { AppProviders } from '@/app/providers'
import { router } from '@/app/router'
import { installAuthInterceptors } from '@/features/auth/interceptors'
import './index.css'

installAuthInterceptors()

async function bootstrap() {
  // Condición escrita en línea (no importada) para que el build de producción la elimine
  // junto con el import(): así MSW no entra al bundle. Debe coincidir con `mocks/flag.ts`.
  if (import.meta.env.DEV && import.meta.env.VITE_MOCKS !== 'off') {
    const { startMocks } = await import('@/mocks/browser')
    await startMocks()
  }

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <AppProviders>
        <RouterProvider router={router} />
      </AppProviders>
    </StrictMode>,
  )
}

void bootstrap()
