import { useQuery } from '@tanstack/react-query';
import { api } from './endpoints';
import { queryKeys } from './queryKeys';

/** Server version and whether OPENAI_API_KEY is set. */
export function useHealth() {
  return useQuery({ queryKey: queryKeys.health, queryFn: ({ signal }) => api.health(signal) });
}
