import { useQuery } from '@tanstack/react-query';
import { api } from './endpoints';
import { queryKeys } from './queryKeys';

/** The loaded folder, its indexing phase, its documents and suggested questions. useIndexEvents keeps it fresh. */
export function useFolderStatus() {
  return useQuery({ queryKey: queryKeys.folder.status, queryFn: ({ signal }) => api.folderStatus(signal) });
}
