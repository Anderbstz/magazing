import { setupWorker } from 'msw/browser'
import { handlers } from './handlers'

export async function startMocks() {
  const worker = setupWorker(...handlers)
  await worker.start({
    // Todo lo que no tenga handler (login, catálogo, usuarios…) va al backend real.
    onUnhandledFrame: 'bypass',
    quiet: true,
  })
  console.info(`[mocks] Datos simulados activos: ${handlers.length} endpoints. Desactívalos con VITE_MOCKS=off.`)
}
