import { X } from 'lucide-react'
import { useEffect, useRef, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface DialogProps {
  open: boolean
  onClose: () => void
  title: string
  description?: string
  size?: 'md' | 'lg'
  children: ReactNode
  footer?: ReactNode
}

/** Modal basado en `<dialog>` nativo: trae foco atrapado, Esc y fondo sin librerías extra. */
export function Dialog({ open, onClose, title, description, size = 'md', children, footer }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => {
        // Clic en el fondo (fuera del panel) cierra el modal.
        if (e.target === ref.current) onClose()
      }}
      className={cn(
        'dialog-panel m-auto w-[calc(100%-2rem)] rounded-xl bg-white p-0 shadow-xl',
        size === 'md' ? 'max-w-lg' : 'max-w-3xl',
      )}
    >
      {open && (
        <div className="flex max-h-[85vh] flex-col">
          <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
            <div>
              <h2 className="text-base font-semibold text-slate-900">{title}</h2>
              {description && <p className="mt-0.5 text-sm text-slate-500">{description}</p>}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="pressable rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              aria-label="Cerrar"
            >
              <X className="size-5" />
            </button>
          </div>
          <div className="overflow-y-auto px-5 py-4">{children}</div>
          {footer && (
            <div className="flex justify-end gap-2 border-t border-slate-200 bg-slate-50 px-5 py-3">{footer}</div>
          )}
        </div>
      )}
    </dialog>
  )
}
