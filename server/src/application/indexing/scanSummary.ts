import type { DocumentSummary } from '@atlas/shared';
import { documentId } from '../../domain/documentId';
import type { ScannedFile } from './scanFolder';

/** How a file the scan ruled out shows in the document list before, or without, an index. */
export function scanSummary(file: ScannedFile): DocumentSummary {
  const { entry } = file;
  return {
    id: documentId(entry.relativePath),
    name: entry.name,
    path: entry.relativePath,
    kind: file.kind,
    status: file.status === 'pending' ? 'skipped' : file.status,
    statusDetail: file.detail,
    sizeBytes: entry.size,
    pageCount: null,
    scannedPages: [],
    sheets: [],
    tables: [],
    currencies: [],
    language: null,
    classification: null,
  };
}
