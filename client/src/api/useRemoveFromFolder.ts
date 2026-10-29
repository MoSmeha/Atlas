import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from './endpoints';
import { queryKeys } from './queryKeys';

/**
 * Removes a file or subfolder of the loaded folder from Atlas, given by its path in the documents list. In the uploads
 * folder the uploaded copy is deleted; in a folder loaded by its path the file stays on disk and can be put back.
 */
export function useRemoveFromFolder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (path: string) => api.removeFromFolder({ path }),
    onSuccess: (status) => {
      queryClient.setQueryData(queryKeys.folder.status, status);
      return queryClient.invalidateQueries({ queryKey: queryKeys.folder.all });
    },
  });
}
