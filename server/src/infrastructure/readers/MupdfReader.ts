import { setImmediate as nextTurn } from 'node:timers/promises';
import type * as mupdf from 'mupdf';
import type { DocumentReader, ReadOutcome } from '../../application/ports/DocumentReader';
import type { PdfPage } from '../../domain/document';
import { toPageRanges } from '../../domain/pageRanges';
import { openPdf } from './openPdf';
import { layoutPage } from './pageLayout';
import { collectBlocks } from './stextBlocks';

/** Pages read between pauses, so a 300-page PDF does not hold up the server. */
const PAGES_PER_TURN = 10;

/**
 * Reads PDFs with mupdf: each page's text in reading order with positioned words, and which pages have no
 * text layer. Never throws for a bad file; encrypted, damaged and empty PDFs come back as statuses.
 */
export class MupdfReader implements DocumentReader {
  readonly extensions: readonly string[] = ['.pdf'];

  async read(filePath: string): Promise<ReadOutcome> {
    const opened = await openPdf(filePath);
    if (!opened.ok) return { status: opened.status, detail: opened.detail };
    const { document, pageCount } = opened;
    try {
      const pages: PdfPage[] = [];
      const failed: number[] = [];
      for (let index = 0; index < pageCount; index += 1) {
        const page = readPage(document, index);
        if (page === null) failed.push(index + 1);
        pages.push(page ?? unreadablePage(index + 1));
        if (index % PAGES_PER_TURN === PAGES_PER_TURN - 1) await nextTurn();
      }
      return outcome(pages, failed);
    } finally {
      document.destroy();
    }
  }
}

/** One page, or null when mupdf cannot load it. Page and text objects are freed straight away. */
function readPage(document: mupdf.Document, index: number): PdfPage | null {
  let page: mupdf.Page | null = null;
  let stext: mupdf.StructuredText | null = null;
  try {
    page = document.loadPage(index);
    const [x0, y0, x1, y1] = page.getBounds();
    stext = page.toStructuredText('preserve-whitespace');
    const layout = layoutPage(collectBlocks(stext, { x: x0, y: y0 }));
    return { number: index + 1, width: round(x1 - x0), height: round(y1 - y0), ...layout };
  } catch {
    return null;
  } finally {
    stext?.destroy();
    page?.destroy();
  }
}

function unreadablePage(number: number): PdfPage {
  return { number, width: 0, height: 0, text: '', hasTextLayer: false, blocks: [] };
}

function outcome(pages: PdfPage[], failed: number[]): ReadOutcome {
  if (failed.length === pages.length) return { status: 'corrupt', detail: 'The PDF is damaged; none of its pages could be read.' };
  const document = { kind: 'pdf' as const, pages };
  const scanned = pages.filter((page) => !page.hasTextLayer && !failed.includes(page.number)).map((page) => page.number);
  const failedNote = failed.length > 0 ? `${pageLabel(failed)} could not be read.` : null;
  if (scanned.length + failed.length === pages.length) {
    const detail = 'The PDF is scanned (no page has a text layer); its pages are read as images.';
    return { status: 'scanned', document, detail: failedNote ? `${detail} ${failedNote}` : detail };
  }
  const scannedNote = scanned.length > 0 ? `${pageLabel(scanned)} ${scanned.length === 1 ? 'has' : 'have'} no text layer (scanned).` : null;
  const notes = [scannedNote, failedNote].filter((note) => note !== null);
  return { status: 'ok', document, detail: notes.length > 0 ? notes.join(' ') : null };
}

/** "Page 3" or "Pages 3-5, 7". */
function pageLabel(pages: number[]): string {
  const ranges = toPageRanges(pages).map(({ from, to }) => (from === to ? `${from}` : `${from}-${to}`));
  return `${pages.length === 1 ? 'Page' : 'Pages'} ${ranges.join(', ')}`;
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}
