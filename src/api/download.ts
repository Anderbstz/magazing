import { http, ApiError, toApiError } from './http'

type QueryValue = string | number | boolean | null | undefined

/**
 * Descarga un archivo que genera el backend (Excel o PDF) con el token de la sesión.
 * El nombre sale de `Content-Disposition`; si no llega, se usa `fallbackName`.
 */
export async function downloadFromApi(path: string, params: Record<string, QueryValue>, fallbackName: string) {
  const clean = Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== ''))

  try {
    const response = await http.get<Blob>(path, { params: clean, responseType: 'blob' })
    const fileName = fileNameFrom(response.headers['content-disposition']) ?? fallbackName
    saveBlob(response.data, fileName)
    return fileName
  } catch (error) {
    throw await readBlobError(error)
  }
}

function fileNameFrom(header: unknown): string | null {
  if (typeof header !== 'string') return null
  const utf8 = /filename\*=UTF-8''([^;]+)/i.exec(header)
  if (utf8) return decodeURIComponent(utf8[1])
  const plain = /filename="?([^";]+)"?/i.exec(header)
  return plain ? plain[1] : null
}

function saveBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** Con `responseType: 'blob'` el error del backend (`{ error }`) también llega como Blob: se lee aquí. */
async function readBlobError(error: unknown): Promise<ApiError> {
  const apiError = toApiError(error)
  const data = apiError.original?.response?.data
  if (data instanceof Blob && data.type.includes('json')) {
    try {
      const body = JSON.parse(await data.text()) as { error?: string; detail?: string; title?: string }
      const message = body.error ?? body.detail ?? body.title
      if (message) return new ApiError(message, apiError.status, undefined, apiError.original)
    } catch {
      return apiError
    }
  }
  return apiError
}
