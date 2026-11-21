import { useState, type ReactNode } from 'react'
import { toast } from 'sonner'
import { downloadFromApi } from '@/api/download'
import { Button, type ButtonProps } from '@/components/ui/button'

type QueryValue = string | number | boolean | null | undefined

interface DownloadButtonProps extends Omit<ButtonProps, 'onClick' | 'loading' | 'children'> {
  /** Ruta relativa a `/api`, p. ej. `/sales/{id}/pdf`. */
  path: string
  params?: Record<string, QueryValue>
  /** Nombre si el backend no lo envía en `Content-Disposition`. */
  fallbackName: string
  children: ReactNode
}

/** Botón que descarga un Excel o PDF generado por la API y avisa si falla. */
export function DownloadButton({ path, params = {}, fallbackName, children, variant = 'secondary', ...props }: DownloadButtonProps) {
  const [loading, setLoading] = useState(false)

  async function handleClick() {
    setLoading(true)
    try {
      const fileName = await downloadFromApi(path, params, fallbackName)
      toast.success(`Descargado ${fileName}`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo descargar el archivo.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button variant={variant} loading={loading} onClick={handleClick} {...props}>
      {children}
    </Button>
  )
}
