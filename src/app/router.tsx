import { createBrowserRouter } from 'react-router'
import { NotFoundPage } from './not-found-page'
import { WelcomePage } from './welcome-page'

/**
 * Rutas de la app. Cada rama `feature/*` agrega aquí las rutas de su módulo.
 */
export const router = createBrowserRouter([
  { path: '/', element: <WelcomePage /> },
  { path: '*', element: <NotFoundPage /> },
])
