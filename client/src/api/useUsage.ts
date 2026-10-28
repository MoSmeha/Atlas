import { useQuery } from '@tanstack/react-query';
import { api } from './endpoints';
import { queryKeys } from './queryKeys';

/** Tokens, cost and time of the last answer, and the running cost of this chat. */
export function useUsage(sessionId: string) {
  return useQuery({ queryKey: queryKeys.usage(sessionId), queryFn: ({ signal }) => api.usage(sessionId, signal) });
}
