import type { ApiError } from './ApiError';

// Every query and mutation function in client/src/api throws ApiError, so hooks expose it typed.
declare module '@tanstack/react-query' {
  interface Register {
    defaultError: ApiError;
  }
}
