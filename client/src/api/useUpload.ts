import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from './endpoints';
import { queryKeys } from './queryKeys';

/** Uploads dropped files to the server, which adds them to the index. */
export function useUpload() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (files: File[]) => api.upload(files),
    onSuccess: (status) => {
      queryClient.setQueryData(queryKeys.folder.status, status);
      return queryClient.invalidateQueries({ queryKey: queryKeys.folder.all });
    },
  });
}
