/**
 * Colores de datos: slots 1 y 2 de la paleta categórica de referencia (validada para
 * daltonismo). El verde de marca no se usa en datos: no pasa el mínimo de croma.
 */
export const SERIES = { primary: '#2a78d6', secondary: '#eb6834' }

/** Paleta categórica para gráficos de partes (pastel): los dos primeros son los de SERIES. */
export const CATEGORICAL = ['#2a78d6', '#eb6834', '#1b9e77', '#c2459e', '#d6a312', '#6b7c93', '#7e57c2', '#0f8fa8', '#b5562f', '#5f9e2f']

const shortDate = new Intl.DateTimeFormat('es-PE', { day: 'numeric', month: 'short' })

/** "9 nov." a partir de YYYY-MM-DD (al mediodía, para no saltar de día por la zona horaria). */
export const labelDate = (iso: string) => shortDate.format(new Date(iso + 'T12:00:00'))
