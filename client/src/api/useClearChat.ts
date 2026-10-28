import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from './endpoints';
import { queryKeys } from './queryKeys';

/** Forgets the chat on the server and refreshes its usage, which drops back to zero. */
export function useClearChat() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (sessionId: string) => api.clearChat(sessionId),
    onSuccess: (_result, sessionId) => queryClient.invalidateQueries({ queryKey: queryKeys.usage(sessionId) }),
  });
}
