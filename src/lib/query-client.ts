import { MutationCache, QueryClient } from '@tanstack/react-query'
import { ApiError } from '@/api/http'
import { notifyError } from './notify'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      // No reintentar errores del cliente (400/401/403/404): reintentar no los arregla.
      retry: (failureCount, error) => {
        if (error instanceof ApiError && error.status >= 400 && error.status < 500) return false
        return failureCount < 2
      },
    },
  },
  // Toda mutación fallida muestra un aviso, salvo que la pantalla lo maneje (meta.silent).
  mutationCache: new MutationCache({
    onError: (error, _vars, _ctx, mutation) => {
      if (mutation.meta?.silent) return
      notifyError(error, mutation.meta?.errorTitle)
    },
  }),
})

declare module '@tanstack/react-query' {
  interface Register {
    defaultError: ApiError
    mutationMeta: { silent?: boolean; errorTitle?: string }
  }
}
