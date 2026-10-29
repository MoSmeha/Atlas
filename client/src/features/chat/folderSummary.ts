import type { DocumentSummary, FileStatus } from '@atlas/shared';
import type { emptyStateCopy } from './emptyStateCopy';

/** Statuses of files Atlas could not search at all; scanned and empty files are named in the sidebar instead. */
const UNREADABLE: ReadonlySet<FileStatus> = new Set(['corrupt', 'encrypted', 'too_large']);

type SummaryCopy = (typeof emptyStateCopy)['en']['summary'];

/** One line about the folder, such as "14 documents, 3 BOQs, 2 could not be read, 1 skipped". */
export function folderSummary(documents: DocumentSummary[], copy: SummaryCopy): string {
  const skipped = documents.filter((document) => document.status === 'skipped').length;
  const read = documents.length - skipped;
  const boqs = documents.filter((document) => document.classification?.type === 'BOQ').length;
  const unreadable = documents.filter((document) => UNREADABLE.has(document.status)).length;

  const parts = [copy.documents(read)];
  if (boqs > 0) parts.push(copy.boqs(boqs));
  if (unreadable > 0) parts.push(copy.unreadable(unreadable));
  if (skipped > 0) parts.push(copy.skipped(skipped));
  return parts.join(copy.separator);
}
