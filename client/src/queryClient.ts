import { QueryClient } from '@tanstack/react-query';

/**
 * Server state cache. The API runs on the same machine and pushes index changes over SSE,
 * so focus refetches add nothing and a single retry covers a server that is still starting.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: false,
    },
  },
});
