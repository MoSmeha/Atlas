import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from './endpoints';
import { queryKeys } from './queryKeys';

/** Puts a removed file or subfolder back into the loaded folder; the server reads it again. */
export function useRestoreToFolder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (path: string) => api.restoreToFolder({ path }),
    onSuccess: (status) => {
      queryClient.setQueryData(queryKeys.folder.status, status);
      return queryClient.invalidateQueries({ queryKey: queryKeys.folder.all });
    },
  });
}
