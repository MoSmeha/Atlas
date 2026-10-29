import type { DocumentSummary } from '@atlas/shared';
import type { Language } from '../../i18n/language';
import { statusLook } from '../sidebar/fileStatus';
import { sidebarCopy } from '../sidebar/sidebarCopy';
import { viewerCopy } from './viewerCopy';

/**
 * Why the viewer cannot show a whole file, or null when it can. A damaged or password-protected
 * file cannot be drawn, and a workbook shows only the sheets Atlas read, so one with none has
 * nothing to show. A scanned or oversized PDF still draws. The server's own reason is English,
 * so Arabic gives the client's reason for the file's status instead.
 */
export function documentProblem(document: DocumentSummary, language: Language = 'en'): string | null {
  const copy = viewerCopy[language];
  const serverReason = language === 'en' ? document.statusDetail : null;
  const reason = serverReason ?? statusLook(document.status, sidebarCopy[language])?.detail ?? null;
  if (document.status === 'corrupt' || document.status === 'encrypted') return reason;
  if (document.kind === 'excel' && document.sheets.length === 0) return reason ?? copy.noSheets;
  if (document.kind === 'other') return reason ?? copy.readsOnly;
  return null;
}
