import type { DocumentSummary } from '@atlas/shared';

const count = (n: number, one: string, many: string) => `${n.toLocaleString('en-US')} ${n === 1 ? one : many}`;

/** File size the way Explorer shows it: "18 KB", "2.7 MB", "205 MB". */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB'];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit++;
  }
  const digits = value < 10 && unit > 0 ? 1 : 0;
  return `${Number(value.toFixed(digits))} ${units[unit]}`;
}

/**
 * The dimmed line under a file name: "64 pages", "6 pages, 1 table", "3 sheets, 2 tables".
 * Falls back to the file size when Atlas could not count pages or sheets.
 */
export function documentMeta(document: DocumentSummary): string {
  const parts: string[] = [];
  if (document.kind === 'pdf' && document.pageCount !== null) {
    parts.push(count(document.pageCount, 'page', 'pages'));
    const scanned = document.scannedPages.length;
    if (document.status === 'ok' && scanned > 0) parts.push(`${scanned.toLocaleString('en-US')} scanned`);
  }
  if (document.kind === 'excel' && document.sheets.length > 0) {
    parts.push(count(document.sheets.length, 'sheet', 'sheets'));
  }
  if (parts.length > 0 && document.tables.length > 0) parts.push(count(document.tables.length, 'table', 'tables'));
  return parts.length > 0 ? parts.join(', ') : formatBytes(document.sizeBytes);
}
