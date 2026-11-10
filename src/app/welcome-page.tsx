import { Card } from '@/components/ui/card'

/** Página temporal de `main`. La rama `feature/auth` la reemplaza por el login y el panel. */
export function WelcomePage() {
  return (
    <div className="flex min-h-full items-center justify-center p-6">
      <Card className="max-w-md p-8 text-center">
        <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-xl bg-brand-700 text-xl font-bold text-white">
          M
        </div>
        <h1 className="text-xl font-semibold">Magazing</h1>
        <p className="mt-2 text-sm text-slate-500">
          Estructura base del frontend. Los módulos se desarrollan en las ramas <code>feature/*</code>.
        </p>
      </Card>
    </div>
  )
}
