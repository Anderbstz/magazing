import { Check, Send, X } from 'lucide-react'
import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { Link } from 'react-router'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { useSaveProduct } from '@/features/catalog/queries'
import { useSavePurchaseOrder } from '@/features/purchases/queries'
import { cn } from '@/lib/utils'
import type { AssistantMessage, AssistantProposal } from '../api'
import { useAssistantChat } from '../queries'
import { ChatMarkdown } from './chat-markdown'

type ProposalState = 'pending' | 'confirmed' | 'discarded'

interface ChatEntry extends AssistantMessage {
  proposal?: AssistantProposal
  proposalState?: ProposalState
  /** Enlace a lo creado tras confirmar (p. ej. la orden de compra). */
  link?: { to: string; label: string }
  error?: boolean
}

const SUGGESTIONS = ['¿Qué productos están bajo el mínimo?', '¿Cuánto vendimos esta semana?', 'Busca el arroz y dime su stock']

/**
 * Asistente de Magazing: botón flotante + panel lateral de chat. Consulta datos con herramientas
 * de solo lectura; para crear algo muestra una propuesta y se guarda solo al confirmar, con los
 * mismos endpoints y permisos que las pantallas.
 */
export function AssistantPanel() {
  const [open, setOpen] = useState(false)
  const [entries, setEntries] = useState<ChatEntry[]>([])
  const [input, setInput] = useState('')
  const chat = useAssistantChat()
  const saveProduct = useSaveProduct()
  const saveOrder = useSavePurchaseOrder()
  const listRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' })
  }, [entries, chat.isPending])

  useEffect(() => {
    if (open) inputRef.current?.focus()
  }, [open])

  function send(text: string) {
    const content = text.trim()
    if (!content || chat.isPending) return
    const next: ChatEntry[] = [...entries, { role: 'user', content }]
    setEntries(next)
    setInput('')
    // Al modelo solo viajan los textos (sin errores locales ni propuestas).
    const history = next.filter((e) => !e.error).map(({ role, content: c }) => ({ role, content: c }))
    chat.mutate(history, {
      onSuccess: (reply) =>
        setEntries((prev) => [
          ...prev,
          { role: 'assistant', content: reply.message, proposal: reply.proposal ?? undefined, proposalState: reply.proposal ? 'pending' : undefined },
        ]),
      onError: (error) =>
        setEntries((prev) => [...prev, { role: 'assistant', content: `No pude responder: ${error.message}`, error: true }]),
    })
  }

  function setProposalState(index: number, state: ProposalState, link?: ChatEntry['link'], note?: string) {
    setEntries((prev) => {
      const copy = prev.map((e, i) => (i === index ? { ...e, proposalState: state, link } : e))
      return note ? [...copy, { role: 'assistant', content: note }] : copy
    })
  }

  function confirm(index: number, proposal: AssistantProposal) {
    if (proposal.kind === 'create_product') {
      saveProduct.mutate(
        { body: proposal.request },
        {
          onSuccess: (product) =>
            setProposalState(index, 'confirmed', { to: '/catalog/products', label: 'Ver productos' }, `Listo: creé el producto ${product.name} (${product.sku}).`),
        },
      )
    } else {
      saveOrder.mutate(
        { body: proposal.request },
        {
          onSuccess: (order) =>
            setProposalState(
              index,
              'confirmed',
              { to: `/purchases/orders/${order.purchaseOrderId}`, label: `Abrir ${order.code}` },
              `Listo: creé la orden ${order.code} en borrador. Falta aprobarla para poder recibirla.`,
            ),
        },
      )
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    send(input)
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send(input)
    }
  }

  const saving = saveProduct.isPending || saveOrder.isPending

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? 'Cerrar asistente' : 'Abrir asistente'}
        aria-expanded={open}
        className="pressable fixed right-5 bottom-5 z-40 flex size-14 items-center justify-center overflow-hidden rounded-full bg-brand-700 text-white shadow-lg ring-4 ring-white hover:bg-brand-800"
      >
        {open ? <X className="size-5" /> : <img src="/assistant-bot.png" alt="" className="size-full" draggable={false} />}
      </button>

      {open && (
        <section
          aria-label="Asistente de Magazing"
          className="pop-in fixed right-5 bottom-22 z-40 flex h-[min(620px,calc(100dvh-7rem))] w-[min(400px,calc(100vw-2.5rem))] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-slate-200"
        >
          <header className="flex items-center gap-3 border-b border-slate-100 px-4 py-3">
            <img src="/assistant-bot.png" alt="" className="size-9 shrink-0 rounded-full" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-slate-900">Asistente</p>
              <p className="truncate text-xs text-slate-500">Consulta datos o pídele que prepare un registro</p>
            </div>
            {entries.length > 0 && (
              <button type="button" onClick={() => setEntries([])} className="rounded-md px-2 py-1 text-xs text-slate-500 hover:bg-slate-100">
                Nueva conversación
              </button>
            )}
          </header>

          <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4" aria-live="polite">
            {entries.length === 0 && (
              <div className="space-y-3 text-sm text-slate-600">
                <p>Hola, puedo consultar stock, ventas, proveedores y alertas, y preparar productos u órdenes de compra para que los confirmes.</p>
                <div className="flex flex-col gap-2">
                  {SUGGESTIONS.map((s) => (
                    <button key={s} type="button" onClick={() => send(s)} className="rounded-lg px-3 py-2 text-left text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50">
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {entries.map((entry, index) => (
              <div key={index} className={cn('flex', entry.role === 'user' ? 'justify-end' : 'justify-start')}>
                <div className="max-w-[88%] space-y-2">
                  <div
                    className={cn(
                      'rounded-2xl px-3.5 py-2 text-sm break-words',
                      entry.role === 'user' && 'whitespace-pre-wrap',
                      entry.role === 'user'
                        ? 'rounded-br-md bg-brand-700 text-white'
                        : entry.error
                          ? 'rounded-bl-md bg-red-50 text-red-800'
                          : 'rounded-bl-md bg-slate-100 text-slate-800',
                    )}
                  >
                    {entry.role === 'assistant' ? <ChatMarkdown text={entry.content} /> : entry.content}
                  </div>

                  {entry.proposal && (
                    <div className="rounded-xl p-3 text-sm ring-1 ring-brand-200">
                      <p className="mb-1.5 font-semibold text-slate-900">{entry.proposal.title}</p>
                      <ul className="space-y-0.5 text-slate-600">
                        {entry.proposal.lines.map((line) => (
                          <li key={line}>{line}</li>
                        ))}
                      </ul>
                      {entry.proposalState === 'pending' ? (
                        <div className="mt-3 flex gap-2">
                          <Button size="sm" loading={saving} onClick={() => confirm(index, entry.proposal!)}>
                            <Check className="size-4" /> Confirmar
                          </Button>
                          <Button size="sm" variant="secondary" disabled={saving} onClick={() => setProposalState(index, 'discarded')}>
                            Descartar
                          </Button>
                        </div>
                      ) : (
                        <p className={cn('mt-2 text-xs font-medium', entry.proposalState === 'confirmed' ? 'text-emerald-700' : 'text-slate-400')}>
                          {entry.proposalState === 'confirmed' ? 'Guardado' : 'Descartado'}
                          {entry.link && (
                            <>
                              {' · '}
                              <Link to={entry.link.to} className="text-brand-700 hover:underline" onClick={() => setOpen(false)}>
                                {entry.link.label}
                              </Link>
                            </>
                          )}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}

            {chat.isPending && (
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <Spinner className="size-3.5" /> Consultando…
              </div>
            )}
          </div>

          <form onSubmit={onSubmit} className="flex items-end gap-2 border-t border-slate-100 p-3">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKeyDown}
              rows={1}
              maxLength={2000}
              placeholder="Escribe tu consulta…"
              aria-label="Mensaje para el asistente"
              className="max-h-32 min-h-10 flex-1 resize-none rounded-lg px-3 py-2 text-sm ring-1 ring-slate-300 ring-inset focus:ring-2 focus:ring-brand-600 focus:outline-none"
            />
            <Button type="submit" size="icon" aria-label="Enviar" disabled={!input.trim() || chat.isPending}>
              <Send className="size-4" />
            </Button>
          </form>
        </section>
      )}
    </>
  )
}
