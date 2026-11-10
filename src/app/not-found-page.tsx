import { Link } from 'react-router'

export function NotFoundPage() {
  return (
    <div className="flex min-h-full flex-col items-center justify-center gap-3 p-6 text-center">
      <p className="text-sm font-semibold text-brand-700">404</p>
      <h1 className="text-2xl font-semibold text-slate-900">Página no encontrada</h1>
      <p className="text-sm text-slate-500">La dirección que buscas no existe o fue movida.</p>
      <Link to="/" className="mt-2 text-sm font-medium text-brand-700 hover:underline">
        Volver al inicio
      </Link>
    </div>
  )
}
