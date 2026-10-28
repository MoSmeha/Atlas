import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { ReadOutcome } from '../../src/application/ports/DocumentReader';
import type { PdfPage } from '../../src/domain/document';
import { MupdfReader } from '../../src/infrastructure/readers/MupdfReader';
import { encrypt, imagePdf, lines, textPdf, writePdf } from './pdfFixtures';

let dir: string;
const reader = new MupdfReader();

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), 'atlas-pdf-'));
});

afterAll(() => {
  rmSync(dir, { recursive: true, force: true });
});

function pagesOf(outcome: ReadOutcome): PdfPage[] {
  if (outcome.status !== 'ok' && outcome.status !== 'scanned') throw new Error(`Expected a document, got ${outcome.status}`);
  if (outcome.document.kind !== 'pdf') throw new Error('Expected a PDF');
  return outcome.document.pages;
}

async function readPdf(name: string, bytes: Uint8Array | string): Promise<ReadOutcome> {
  return reader.read(writePdf(join(dir, name), bytes));
}

describe('MupdfReader on text PDFs', () => {
  it('reads every page with its number, size and text', async () => {
    const first = lines('Contract for the Riyadh Metro Depot', 'Contract value: 1,250,000 SAR');
    first.items.push({ text: 'Signed in Riyadh on 1 March 2025', x: 72, y: 500 });
    const bytes = await textPdf([
      first,
      lines('Clause 14 Payment', 'Payment is due within 30 days.'),
      { ...lines('Appendix A Drawings'), size: [842, 595] },
    ]);
    const outcome = await readPdf('contract.pdf', bytes);
    expect(outcome.status).toBe('ok');
    expect(outcome.detail).toBeNull();
    const pages = pagesOf(outcome);
    expect(pages.map((page) => page.number)).toEqual([1, 2, 3]);
    expect(pages[0]).toMatchObject({ width: 595, height: 842, hasTextLayer: true });
    expect(pages[2]).toMatchObject({ width: 842, height: 595 });
    // Lines of one paragraph are one block; text far below starts a new block after a blank line.
    expect(pages[0]?.text).toBe('Contract for the Riyadh Metro Depot\nContract value: 1,250,000 SAR\n\nSigned in Riyadh on 1 March 2025');
    expect(pages[1]?.text).toContain('Payment is due within 30 days.');
    expect(pages[2]?.text).toBe('Appendix A Drawings');
  });

  it('gives words left to right with positions in points from the top-left', async () => {
    const bytes = await textPdf([{ items: [{ text: 'Item Description Qty Rate', x: 50, y: 100, size: 12 }] }]);
    const [page] = pagesOf(await readPdf('words.pdf', bytes));
    const [line] = page!.blocks[0]!.lines;
    expect(line?.words.map((word) => word.text)).toEqual(['Item', 'Description', 'Qty', 'Rate']);
    expect(line?.words[0]?.x0).toBeCloseTo(50, 0);
    for (const [index, word] of line!.words.entries()) {
      expect(word.x1).toBeGreaterThan(word.x0);
      if (index > 0) expect(word.x0).toBeGreaterThan(line!.words[index - 1]!.x1);
    }
    // The baseline is 100 pt from the top, so the line box sits just above it.
    expect(line!.box.y).toBeGreaterThan(85);
    expect(line!.box.y + line!.box.height).toBeGreaterThan(100);
    expect(line!.box.y + line!.box.height).toBeLessThan(106);
  });

  it('puts the cells of a table row on one line', async () => {
    const columns = [50, 100, 300, 360, 450];
    const rows = [
      ['Item', 'Description', 'Unit', 'Qty', 'Amount'],
      ['A.1', 'Excavation in soil', 'm3', '1,200', '45,000.00'],
    ];
    const items = rows.flatMap((cells, row) => cells.map((text, col) => ({ text, x: columns[col]!, y: 100 + row * 18 })));
    const [page] = pagesOf(await readPdf('boq.pdf', await textPdf([{ items }])));
    expect(page?.text.split('\n').filter(Boolean)).toEqual([
      'Item  Description  Unit  Qty  Amount',
      'A.1  Excavation in soil  m3  1,200  45,000.00',
    ]);
    const words = page!.blocks.flatMap((block) => block.lines).find((line) => line.text.startsWith('A.1'))!.words;
    const starts = Object.fromEntries(words.map((word) => [word.text, Math.round(word.x0)]));
    expect(starts).toMatchObject({ 'A.1': 50, Excavation: 100, m3: 300, '1,200': 360, '45,000.00': 450 });
  });
});

describe('MupdfReader text layer', () => {
  it('reports a blank page among text pages as having no text layer', async () => {
    const bytes = await textPdf([{ items: [] }, lines('Bill of Quantities, Section 3')]);
    const outcome = await readPdf('mixed.pdf', bytes);
    expect(outcome).toMatchObject({ status: 'ok', detail: 'Page 1 has no text layer (scanned).' });
    expect(pagesOf(outcome).map((page) => page.hasTextLayer)).toEqual([false, true]);
  });

  it('lists several pages without a text layer as ranges', async () => {
    const text = lines('Specification for concrete works');
    const bytes = await textPdf([text, { items: [] }, { items: [] }, { items: [] }, text, { items: [] }]);
    expect((await readPdf('ranges.pdf', bytes)).detail).toBe('Pages 2-4, 6 have no text layer (scanned).');
  });

  it('marks a PDF with no text on any page as scanned and still returns its pages', async () => {
    const bytes = await textPdf([{ items: [] }, lines('p. 2')]);
    const outcome = await readPdf('scan.pdf', bytes);
    expect(outcome.status).toBe('scanned');
    expect(outcome.detail).toBe('The PDF is scanned (no page has a text layer); its pages are read as images.');
    const pages = pagesOf(outcome);
    expect(pages).toHaveLength(2);
    expect(pages[1]?.text).toBe('p. 2');
  });

  it('marks a PDF of page images as scanned', async () => {
    const outcome = await readPdf('images.pdf', await imagePdf(3));
    expect(outcome.status).toBe('scanned');
    expect(pagesOf(outcome).map((page) => [page.number, page.hasTextLayer, page.text])).toEqual([
      [1, false, ''],
      [2, false, ''],
      [3, false, ''],
    ]);
  });
});

describe('MupdfReader on unreadable files', () => {
  it('reports a password-protected PDF', async () => {
    const outcome = await readPdf('locked.pdf', encrypt(await textPdf([lines('Confidential tender prices')])));
    expect(outcome).toEqual({ status: 'encrypted', detail: 'The PDF is password-protected.' });
  });

  it('reports a file that is not a PDF', async () => {
    const outcome = await readPdf('garbage.pdf', 'PK\u0003\u0004 this is a renamed Word file, not a PDF');
    expect(outcome).toEqual({ status: 'corrupt', detail: 'The file has a .pdf name but is not a PDF.' });
  });

  it('reports a damaged PDF that has lost its pages', async () => {
    const bytes = await textPdf([lines('Minutes of meeting 12')]);
    const outcome = await readPdf('truncated.pdf', bytes.slice(0, 300));
    expect(outcome.status).toBe('corrupt');
    expect(outcome.detail).toMatch(/^The PDF is damaged/);
  });

  it('reports a PDF without pages and a zero-byte file as empty', async () => {
    expect(await readPdf('no-pages.pdf', await textPdf([]))).toEqual({
      status: 'empty',
      detail: 'The PDF has no pages.',
    });
    expect(await readPdf('zero.pdf', '')).toEqual({ status: 'empty', detail: 'The file is empty (0 bytes).' });
  });

  it('reports a missing file without throwing', async () => {
    expect(await reader.read(join(dir, 'missing.pdf'))).toEqual({
      status: 'corrupt',
      detail: 'The file was removed before it could be read.',
    });
  });

  it('handles only .pdf files', () => {
    expect(reader.extensions).toEqual(['.pdf']);
  });
});
