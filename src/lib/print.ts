/**
 * Imprime solo un elemento (el ticket), en un iframe aparte con el ancho de una ticketera de 80 mm.
 *
 * Imprimir la página completa con `window.print()` y ocultar lo demás falla cuando el ticket está
 * dentro de un diálogo con scroll: el navegador corta lo que no se ve. En el iframe el ticket se
 * imprime entero, sin el diálogo, el fondo ni los botones.
 */
export function printElement(element: HTMLElement, title = document.title) {
  const iframe = document.createElement('iframe')
  iframe.setAttribute('aria-hidden', 'true')
  iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden'
  document.body.appendChild(iframe)

  const doc = iframe.contentDocument!
  // Los mismos estilos de la app (en desarrollo son <style>; en producción, <link>).
  const styles = [...document.querySelectorAll('link[rel="stylesheet"], style')].map((node) => node.outerHTML).join('\n')
  doc.open()
  doc.write(`<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${title}</title>${styles}
<style>
  @page { size: 80mm auto; margin: 0; }
  html, body { margin: 0; background: #fff; }
  body { width: 80mm; padding: 4mm; box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body > * { max-width: none !important; margin: 0 !important; }
</style></head><body>${element.outerHTML}</body></html>`)
  doc.close()

  const cleanup = () => setTimeout(() => iframe.remove(), 500)
  const run = () => {
    const win = iframe.contentWindow!
    win.addEventListener('afterprint', cleanup, { once: true })
    win.focus()
    win.print()
    // Por si el navegador no dispara afterprint.
    setTimeout(cleanup, 60_000)
  }
  // Espera a que carguen las hojas de estilo enlazadas antes de imprimir.
  const links = [...doc.querySelectorAll('link[rel="stylesheet"]')] as HTMLLinkElement[]
  Promise.all(links.map((link) => (link.sheet ? null : new Promise((ok) => link.addEventListener('load', ok, { once: true }))))).then(run)
}

/** Imprime el ticket que esté en pantalla (el componente Receipt lleva `data-receipt`). */
export function printReceipt(title?: string) {
  const receipt = document.querySelector<HTMLElement>('[data-receipt]')
  if (receipt) printElement(receipt, title)
}
