import type { ApiError } from '../../api/ApiError';

/**
 * The line shown under the folder path when loading fails, naming the problem and what to do.
 * folder_empty keeps the server's wording, which counts the files it skipped.
 */
export function folderErrorMessage(error: ApiError, path: string): string {
  switch (error.code) {
    case 'folder_not_found':
      return `Folder not found: ${path}. Check the spelling, or copy the path from the File Explorer address bar.`;
    case 'folder_empty':
      return `${error.message} Pick a folder that holds PDF or Excel files.`;
    default:
      return error.message;
  }
}
