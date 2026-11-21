import { formatDateTime, formatMoney, formatQuantity } from '@/lib/format'
import type { SaleDetail } from '../api'

/**
 * Comprobante en formato ticket (80 mm). Con la clase `print-area`, `window.print()`
 * imprime solo esto (ver estilos de impresión en index.css).
 * No es un comprobante electrónico válido ante SUNAT (eso está en el roadmap).
 */
export function Receipt({ sale }: { sale: SaleDetail }) {
  const title = sale.documentType === 'FACTURA' ? 'FACTURA DE VENTA' : 'BOLETA DE VENTA'
  return (
    <div className="print-area mx-auto w-full max-w-[320px] bg-white font-mono text-[12px] leading-snug text-slate-900">
      <div className="text-center">
        <p className="text-sm font-bold">MAGAZING</p>
        <p>Tienda Principal · Arequipa</p>
        <p>RUC 20123456789</p>
        <p className="mt-2 font-bold">{title}</p>
        <p className="font-bold">{sale.fullNumber}</p>
        {sale.status === 'CANCELLED' && <p className="mt-1 font-bold">*** ANULADA ***</p>}
      </div>

      <div className="my-2 border-t border-dashed border-slate-400" />
      <p>Fecha: {formatDateTime(sale.soldAt)}</p>
      <p>
        Cliente: {sale.customerName}
        <br />
        {sale.customerDocumentType}: {sale.customerDocumentNumber}
      </p>
      <p>Vendedor: {sale.sellerName}</p>
      <div className="my-2 border-t border-dashed border-slate-400" />

      <table className="w-full">
        <tbody>
          {sale.items.map((i) => (
            <tr key={i.productId} className="align-top">
              <td className="pb-1">
                {i.productName}
                <br />
                <span className="text-slate-600">
                  {formatQuantity(i.quantity)} {i.unitCode} × {formatMoney(i.unitPrice)}
                  {i.discount > 0 && ` − ${formatMoney(i.discount)}`}
                </span>
              </td>
              <td className="pb-1 text-right whitespace-nowrap">{formatMoney(i.lineTotal)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="my-2 border-t border-dashed border-slate-400" />
      <Row label="Op. gravada" value={sale.subtotal} />
      {sale.discountTotal > 0 && <Row label="Descuentos" value={-sale.discountTotal} />}
      <Row label="IGV 18%" value={sale.taxAmount} />
      <Row label="TOTAL" value={sale.total} bold />
      <div className="my-2 border-t border-dashed border-slate-400" />
      {sale.payments.map((p) => (
        <Row key={p.paymentMethodId + p.amount} label={p.methodName + (p.reference ? ` (${p.reference})` : '')} value={p.amount} />
      ))}
      {sale.change > 0 && <Row label="Vuelto" value={sale.change} />}
      <p className="mt-3 text-center text-slate-600">¡Gracias por su compra!</p>
      <p className="text-center text-[10px] text-slate-500">Representación impresa sin validez tributaria</p>
    </div>
  )
}

function Row({ label, value, bold }: { label: string; value: number; bold?: boolean }) {
  return (
    <div className={bold ? 'flex justify-between text-sm font-bold' : 'flex justify-between'}>
      <span>{label}</span>
      <span>{formatMoney(value)}</span>
    </div>
  )
}
