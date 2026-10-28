import { useQuery } from '@tanstack/react-query';
import { api } from './endpoints';
import { queryKeys } from './queryKeys';

/** The models the user can pick, with prices, and the default. Fixed while the server runs. */
export function useModels() {
  return useQuery({ queryKey: queryKeys.models, queryFn: ({ signal }) => api.models(signal), staleTime: Infinity });
}
