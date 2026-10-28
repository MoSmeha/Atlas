import { readFile } from 'node:fs/promises';
import * as mupdf from 'mupdf';

// mupdf prints repair warnings for damaged files to the console; the readers report problems as statuses instead.
mupdf.setLog(null);

export type OpenedPdf =
  | { ok: true; document: mupdf.Document; pageCount: number }
  | { ok: false; status: 'empty' | 'corrupt' | 'encrypted'; detail: string };

const DAMAGED = 'The PDF is damaged and could not be opened.';
const NOT_A_PDF = 'The file has a .pdf name but is not a PDF.';

/** Reads a file and opens it with mupdf. Never throws: an unusable file comes back as a status with a plain reason. */
export async function openPdf(filePath: string): Promise<OpenedPdf> {
  let bytes: Uint8Array;
  try {
    bytes = await readFile(filePath);
  } catch (error) {
    return { ok: false, status: 'corrupt', detail: describeReadError(error) };
  }
  return openPdfBytes(bytes);
}

/** Opens PDF bytes. The caller destroys the returned document when done with it. */
export function openPdfBytes(bytes: Uint8Array): OpenedPdf {
  if (bytes.length === 0) return { ok: false, status: 'empty', detail: 'The file is empty (0 bytes).' };
  let document: mupdf.Document;
  try {
    document = mupdf.Document.openDocument(bytes, 'application/pdf');
  } catch {
    return { ok: false, status: 'corrupt', detail: hasPdfHeader(bytes) ? DAMAGED : NOT_A_PDF };
  }
  try {
    if (document.needsPassword()) {
      document.destroy();
      return { ok: false, status: 'encrypted', detail: 'The PDF is password-protected.' };
    }
    const pageCount = document.countPages();
    if (pageCount > 0) return { ok: true, document, pageCount };
    // mupdf rebuilds a damaged file instead of failing; a rebuilt file with no pages is broken, not empty.
    const repaired = document.asPDF()?.wasRepaired() ?? false;
    document.destroy();
    return repaired
      ? { ok: false, status: 'corrupt', detail: 'The PDF is damaged; no pages could be recovered.' }
      : { ok: false, status: 'empty', detail: 'The PDF has no pages.' };
  } catch {
    document.destroy();
    return { ok: false, status: 'corrupt', detail: DAMAGED };
  }
}

/** PDF files start with "%PDF-", though some tools put a few bytes of junk before it. */
function hasPdfHeader(bytes: Uint8Array): boolean {
  return new TextDecoder('latin1').decode(bytes.subarray(0, 1024)).includes('%PDF-');
}

function describeReadError(error: unknown): string {
  const code = error instanceof Error && 'code' in error ? String(error.code) : '';
  if (code === 'ENOENT') return 'The file was removed before it could be read.';
  if (code === 'EACCES' || code === 'EPERM') return 'Atlas does not have permission to read the file.';
  if (code === 'EBUSY') return 'The file is locked by another program.';
  return 'The file could not be read.';
}
