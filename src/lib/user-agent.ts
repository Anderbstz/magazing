export interface DeviceInfo {
  browser: string
  os: string
  mobile: boolean
  /** Texto para mostrar, p. ej. "Chrome en Windows". */
  label: string
}

const BROWSERS: [RegExp, string][] = [
  [/Edg(?:e|A|iOS)?\//, 'Edge'],
  [/OPR\/|Opera/, 'Opera'],
  [/SamsungBrowser\//, 'Samsung Internet'],
  [/Firefox\/|FxiOS\//, 'Firefox'],
  [/Chrome\/|CriOS\//, 'Chrome'],
  [/Safari\//, 'Safari'],
]

const SYSTEMS: [RegExp, string][] = [
  [/Windows NT/, 'Windows'],
  [/Android/, 'Android'],
  [/iPhone|iPad|iPod/, 'iOS'],
  [/Mac OS X|Macintosh/, 'macOS'],
  [/CrOS/, 'ChromeOS'],
  [/Linux/, 'Linux'],
]

/** "Mozilla/5.0 (Windows NT 10.0…) Chrome/131…" → "Chrome en Windows". Aproximado: el UA lo escribe el navegador. */
export function describeUserAgent(userAgent: string | null | undefined): DeviceInfo {
  if (!userAgent) return { browser: 'Desconocido', os: '', mobile: false, label: 'Dispositivo desconocido' }
  const browser = BROWSERS.find(([re]) => re.test(userAgent))?.[1] ?? (/curl|python|postman|okhttp/i.test(userAgent) ? 'Cliente de API' : 'Navegador')
  const os = SYSTEMS.find(([re]) => re.test(userAgent))?.[1] ?? ''
  const mobile = /Mobi|Android|iPhone|iPad/.test(userAgent)
  return { browser, os, mobile, label: os ? `${browser} en ${os}` : browser }
}

/** `sid` del access token actual: identifica "este dispositivo" en la lista de sesiones. */
export function sessionIdFromToken(token: string | null): string | null {
  if (!token) return null
  try {
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')))
    return typeof payload.sid === 'string' ? payload.sid : null
  } catch {
    return null
  }
}
