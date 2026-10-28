import { keepPreviousData, skipToken, useQuery } from '@tanstack/react-query';
import { api } from './endpoints';
import { queryKeys } from './queryKeys';

/**
 * Raw rows `from` to `to` of one sheet, for the Excel viewer. Waits while no sheet is chosen,
 * and keeps showing the previous range while the next one loads.
 */
export function useSheetRows(documentId: string | null, sheet: string | null, from: number, to: number) {
  return useQuery({
    queryKey: queryKeys.folder.sheetRows(documentId ?? '', sheet ?? '', from, to),
    queryFn:
      documentId === null || sheet === null
        ? skipToken
        : ({ signal }) => api.sheetRows(documentId, sheet, { from, to }, signal),
    placeholderData: keepPreviousData,
  });
}
