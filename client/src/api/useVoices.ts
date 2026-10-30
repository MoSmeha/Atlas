import { useQuery } from '@tanstack/react-query';
import { api } from './endpoints';
import { queryKeys } from './queryKeys';

/** How often the voices are checked again while the server is still making some of them. */
const PREPARING_POLL_MS = 5_000;

/**
 * The voices a call can use, whether each is ready, whether calls and dictation are on, and what they cost. Fixed
 * while the server runs, except that voices become ready: while the server makes them, the list is read again.
 */
export function useVoices() {
  return useQuery({
    queryKey: queryKeys.voices,
    queryFn: ({ signal }) => api.voices(signal),
    staleTime: Infinity,
    refetchInterval: (query) => (query.state.data?.preparingVoices ? PREPARING_POLL_MS : false),
  });
}
