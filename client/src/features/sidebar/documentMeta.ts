import type { DocumentSummary } from '@atlas/shared';
import { type SidebarCopy, sidebarCopy } from './sidebarCopy';

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
 * The dimmed line under a file name: "64 pages", "6 pages, 1 table", "3 sheets, 2 tables", then the
 * document type when Atlas sorted it. Falls back to the file size when Atlas could not count pages or sheets.
 */
export function documentMeta(document: DocumentSummary, copy: SidebarCopy = sidebarCopy.en): string {
  const parts: string[] = [];
  if (document.kind === 'pdf' && document.pageCount !== null) {
    parts.push(copy.pages(document.pageCount));
    const scanned = document.scannedPages.length;
    if (document.status === 'ok' && scanned > 0) parts.push(copy.scanned(scanned));
  }
  if (document.kind === 'excel' && document.sheets.length > 0) {
    parts.push(copy.sheets(document.sheets.length));
  }
  if (parts.length > 0 && document.tables.length > 0) parts.push(copy.tables(document.tables.length));
  const counts = parts.length > 0 ? parts.join(copy.listSeparator) : formatBytes(document.sizeBytes);
  const type = document.classification?.type;
  return type === undefined ? counts : `${counts} · ${copy.types[type]}`;
}
