import { useMutation } from '@tanstack/react-query';
import type { ExportRequest } from '@atlas/shared';
import { api } from './endpoints';

/** Saves a result table as an .xlsx or .csv file; the reply has its path and a download URL. */
export function useExport() {
  return useMutation({ mutationFn: (request: ExportRequest) => api.exportTable(request) });
}
