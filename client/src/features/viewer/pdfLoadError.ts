import type { NoticeError } from '../errors/errorCopy';

/**
 * A pdf.js load failure as an error the notice can explain: a 404 means the file left the folder,
 * no reply or a 5xx means the server is not answering, anything else is a file Atlas could not draw.
 */
export function pdfLoadError(error: unknown): NoticeError {
  const message = error instanceof Error ? error.message : String(error);
  const status = typeof error === 'object' && error !== null && 'status' in error ? Number(error.status) : null;
  if (status === 404) return { code: 'document_not_found', message };
  if (status === 0 || (status !== null && status >= 500) || error instanceof TypeError || /fetch|network/i.test(message)) {
    return { code: 'unreachable', message };
  }
  return { code: 'internal', message };
}
