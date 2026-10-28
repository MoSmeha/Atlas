import type { FileStatus } from '@atlas/shared';

/** How a file's status reads to the user: usable, failed to read, or not a PDF or Excel file. */
export type StatusGroup = 'ready' | 'unreadable' | 'skipped';

const groups: Record<FileStatus, StatusGroup> = {
  ok: 'ready',
  // No text layer, but the pages can still be read as images.
  scanned: 'ready',
  empty: 'unreadable',
  corrupt: 'unreadable',
  encrypted: 'unreadable',
  too_large: 'unreadable',
  skipped: 'skipped',
};

export function statusGroup(status: FileStatus): StatusGroup {
  return groups[status];
}

export interface StatusCounts {
  total: number;
  ready: number;
  unreadable: number;
  skipped: number;
}

export function countStatuses(statuses: readonly FileStatus[]): StatusCounts {
  const counts: StatusCounts = { total: statuses.length, ready: 0, unreadable: 0, skipped: 0 };
  for (const status of statuses) counts[statusGroup(status)] += 1;
  return counts;
}

/** One line such as "14 documents: 10 readable, 3 unreadable, 1 skipped". Zero unreadable or skipped are left out. */
export function describeCounts(counts: StatusCounts): string {
  if (counts.total === 0) return 'No documents in the loaded folder';
  const parts = [`${counts.ready} readable`];
  if (counts.unreadable > 0) parts.push(`${counts.unreadable} unreadable`);
  if (counts.skipped > 0) parts.push(`${counts.skipped} skipped`);
  return `${counts.total} document${counts.total === 1 ? '' : 's'}: ${parts.join(', ')}`;
}
