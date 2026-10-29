import { useQuery } from '@tanstack/react-query';
import { api } from './endpoints';
import { queryKeys } from './queryKeys';

/** The voices a call can use, whether calls and dictation are on, and what they cost. Fixed while the server runs. */
export function useVoices() {
  return useQuery({ queryKey: queryKeys.voices, queryFn: ({ signal }) => api.voices(signal), staleTime: Infinity });
}
