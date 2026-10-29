import { useQuery } from '@tanstack/react-query';
import { api } from './endpoints';
import { queryKeys } from './queryKeys';

/** Server version and whether a model provider is set up (apiKeyPresent). */
export function useHealth() {
  return useQuery({ queryKey: queryKeys.health, queryFn: ({ signal }) => api.health(signal) });
}
