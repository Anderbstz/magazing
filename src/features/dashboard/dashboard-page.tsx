import { ArrowRight } from 'lucide-react'
import { Link } from 'react-router'
import { navigation } from '@/app/navigation'
import { PageHeader } from '@/components/page-header'
import { Card } from '@/components/ui/card'
import { useCan, useSession } from '@/features/auth/use-auth'

/**
 * Inicio. Por ahora muestra accesos directos a los módulos disponibles.
 * Cuando existan los endpoints de reportes y alertas, aquí van los indicadores
 * (ventas del día, stock bajo, alertas del modelo de demanda).
 */
export function DashboardPage() {
  const { user } = useSession()
  const can = useCan()

  const shortcuts = navigation
    .flatMap((section) => section.items)
    .filter((item) => item.to !== '/' && (!item.permission || can(item.permission)))

  return (
    <>
      <PageHeader title={`Hola, ${user?.username ?? ''}`} description="Este es el resumen de tu tienda." />

      {shortcuts.length === 0 ? (
        <Card className="p-6 text-sm text-slate-500">Aún no hay módulos disponibles para tu rol.</Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {shortcuts.map((item) => (
            <Link key={item.to} to={item.to} className="group">
              <Card className="flex items-center gap-4 p-5 transition-shadow group-hover:shadow-md">
                <div className="flex size-10 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
                  <item.icon className="size-5" aria-hidden />
                </div>
                <span className="flex-1 font-medium text-slate-800">{item.label}</span>
                <ArrowRight className="size-4 text-slate-300 transition-transform group-hover:translate-x-0.5 group-hover:text-slate-500" />
              </Card>
            </Link>
          ))}
        </div>
      )}
    </>
  )
}
