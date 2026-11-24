import { Fragment, type ReactNode } from 'react'

/**
 * Markdown mínimo para las respuestas del asistente: negrita, código, títulos y listas.
 * Arma elementos de React (nunca HTML crudo), así que un texto del modelo no puede inyectar marcado.
 */
export function ChatMarkdown({ text }: { text: string }) {
  const blocks: ReactNode[] = []
  let list: { ordered: boolean; items: string[] } | null = null

  const flushList = () => {
    if (!list) return
    const items = list.items.map((item, i) => <li key={i}>{inline(item)}</li>)
    blocks.push(
      list.ordered ? (
        <ol key={blocks.length} className="list-decimal space-y-0.5 pl-5">{items}</ol>
      ) : (
        <ul key={blocks.length} className="list-disc space-y-0.5 pl-5">{items}</ul>
      ),
    )
    list = null
  }

  for (const raw of text.split('\n')) {
    const line = raw.trimEnd()
    const bullet = /^\s*[-*•]\s+(.*)$/.exec(line)
    const numbered = /^\s*\d+[.)]\s+(.*)$/.exec(line)
    const item = bullet ?? numbered

    if (item) {
      const ordered = !bullet
      if (list && list.ordered !== ordered) flushList()
      list ??= { ordered, items: [] }
      list.items.push(item[1])
      continue
    }

    flushList()
    if (!line.trim()) continue

    const heading = /^#{1,6}\s+(.*)$/.exec(line)
    blocks.push(
      <p key={blocks.length} className={heading ? 'font-semibold' : undefined}>
        {inline(heading ? heading[1] : line)}
      </p>,
    )
  }
  flushList()

  return <div className="space-y-1.5">{blocks}</div>
}

function inline(text: string): ReactNode {
  return text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
      return <strong key={i} className="font-semibold">{part.slice(2, -2)}</strong>
    }
    if (part.startsWith('`') && part.endsWith('`') && part.length > 2) {
      return <code key={i} className="rounded bg-slate-200/70 px-1 text-[0.85em]">{part.slice(1, -1)}</code>
    }
    return <Fragment key={i}>{part}</Fragment>
  })
}
