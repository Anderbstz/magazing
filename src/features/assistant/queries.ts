import { useMutation } from '@tanstack/react-query'
import { assistantApi, type AssistantMessage } from './api'

/** Envía la conversación al asistente. Los errores se muestran dentro del chat (meta.silent). */
export function useAssistantChat() {
  return useMutation({
    mutationFn: (messages: AssistantMessage[]) => assistantApi.chat(messages),
    meta: { silent: true },
  })
}
