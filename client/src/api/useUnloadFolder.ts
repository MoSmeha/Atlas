import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from './endpoints';
import { queryKeys } from './queryKeys';

/**
 * Removes the loaded folder from Atlas: the server forgets everything it read from it, and deletes the files when they
 * were uploaded. Nothing is loaded afterwards.
 */
export function useUnloadFolder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.unloadFolder(),
    onSuccess: (status) => {
      queryClient.setQueryData(queryKeys.folder.status, status);
      return queryClient.invalidateQueries({ queryKey: queryKeys.folder.all });
    },
  });
}
