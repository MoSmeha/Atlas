import type { DocumentSummary, FileStatus } from '@atlas/shared';

/** Statuses of files Atlas could not search at all; scanned and empty files are named in the sidebar instead. */
const UNREADABLE: ReadonlySet<FileStatus> = new Set(['corrupt', 'encrypted', 'too_large']);

/** The folder's own name: the last part of its path, Windows or POSIX. */
export function folderName(path: string): string {
  const parts = path.split(/[\\/]+/).filter((part) => part !== '');
  return parts.at(-1) ?? path;
}

/** One line about the folder, such as "14 documents, 3 BOQs, 2 could not be read, 1 skipped". */
export function folderSummary(documents: DocumentSummary[]): string {
  const skipped = documents.filter((document) => document.status === 'skipped').length;
  const read = documents.length - skipped;
  const boqs = documents.filter((document) => document.classification?.type === 'BOQ').length;
  const unreadable = documents.filter((document) => UNREADABLE.has(document.status)).length;

  const parts = [count(read, 'document', 'documents')];
  if (boqs > 0) parts.push(count(boqs, 'BOQ', 'BOQs'));
  if (unreadable > 0) parts.push(`${figure(unreadable)} could not be read`);
  if (skipped > 0) parts.push(`${figure(skipped)} skipped`);
  return parts.join(', ');
}

function count(n: number, one: string, many: string): string {
  return `${figure(n)} ${n === 1 ? one : many}`;
}

function figure(n: number): string {
  return n.toLocaleString('en-US');
}
