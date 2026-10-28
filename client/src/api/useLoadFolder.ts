import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from './endpoints';
import { queryKeys } from './queryKeys';

/**
 * Loads a folder by its path on the Atlas machine and starts indexing it. A folder with no PDF or
 * Excel files still replaces the loaded one on the server, so the folder queries refresh after a failure too.
 */
export function useLoadFolder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (path: string) => api.loadFolder({ path }),
    onSuccess: (status) => {
      queryClient.setQueryData(queryKeys.folder.status, status);
      return queryClient.invalidateQueries({ queryKey: queryKeys.folder.all });
    },
    onError: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.folder.all });
    },
  });
}
