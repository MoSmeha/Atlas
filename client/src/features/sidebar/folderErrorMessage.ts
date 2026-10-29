import type { ApiError } from '../../api/ApiError';
import type { Language } from '../../i18n/language';
import { errorMessage } from '../errors/errorCopy';
import type { SidebarCopy } from './sidebarCopy';

/**
 * The line shown under the folder path when loading fails, naming the problem and what to do.
 * In English folder_empty keeps the server's wording, which counts the files it skipped.
 */
export function folderErrorMessage(error: ApiError, path: string, copy: SidebarCopy, language: Language): string {
  switch (error.code) {
    case 'folder_not_found':
      return copy.folderNotFound(path);
    case 'folder_empty':
      return copy.folderEmpty(error.message);
    default:
      return errorMessage(error, language);
  }
}
