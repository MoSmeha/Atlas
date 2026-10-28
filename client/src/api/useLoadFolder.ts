import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from './endpoints';
import { queryKeys } from './queryKeys';

/** Loads a folder by its path on the Atlas machine and starts indexing it. */
export function useLoadFolder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (path: string) => api.loadFolder({ path }),
    onSuccess: (status) => {
      queryClient.setQueryData(queryKeys.folder.status, status);
      return queryClient.invalidateQueries({ queryKey: queryKeys.folder.all });
    },
  });
}
