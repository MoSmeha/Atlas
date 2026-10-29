import type { DocumentSummary } from '@atlas/shared';
import { statusLook } from '../sidebar/fileStatus';

/**
 * Why the viewer cannot show a whole file, or null when it can. A damaged or password-protected
 * file cannot be drawn, and a workbook shows only the sheets Atlas read, so one with none has
 * nothing to show. A scanned or oversized PDF still draws.
 */
export function documentProblem(document: DocumentSummary): string | null {
  const reason = document.statusDetail ?? statusLook(document.status)?.detail ?? null;
  if (document.status === 'corrupt' || document.status === 'encrypted') return reason;
  if (document.kind === 'excel' && document.sheets.length === 0) {
    return reason ?? 'Atlas found no sheets in this workbook.';
  }
  if (document.kind === 'other') return reason ?? 'Atlas reads only PDF and Excel files.';
  return null;
}
