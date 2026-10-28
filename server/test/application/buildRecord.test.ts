import { describe, expect, it } from 'vitest';
import { buildRecord, statusRecord } from '../../src/application/indexing/buildRecord';
import type { ScannedFile } from '../../src/application/indexing/scanFolder';
import type { PdfPage } from '../../src/domain/document';
import { boqHeader, boqLine, pdfPage, text } from '../domain/pdfPage';
import { sheet, TITLE_ROWS } from '../domain/tables/grid';

function scanned(relativePath: string, kind: ScannedFile['kind']): ScannedFile {
  const name = relativePath.split('/').pop() ?? relativePath;
  return {
    entry: { absolutePath: `/folder/${relativePath}`, relativePath, name, extension: name.slice(name.lastIndexOf('.')), size: 2048, mtimeMs: 1700 },
    kind,
    status: 'pending',
    detail: null,
  };
}

const scannedPage = (number: number): PdfPage => ({ number, width: 595, height: 842, text: '', hasTextLayer: false, blocks: [] });

describe('buildRecord for a PDF', () => {
  const pages = [
    pdfPage(1, [
      text(60, 'Bill No. 4 - Facade Package'),
      boqHeader(100),
      boqLine(118, ['4.01', 'Curtain wall unit type A', 'm2', '1,200', '1,850.00', '2,220,000.00']),
      boqLine(131, ['4.02', 'Aluminium louvres', 'm2', '300', '640.00', '192,000.00']),
    ]),
    scannedPage(2),
    pdfPage(3, [text(60, 'Payment is due within 30 days. The contract sum is stated in USD 120,000 for imported items.')]),
  ];
  const record = buildRecord(scanned('BOQ/Facade.pdf', 'pdf'), { status: 'ok', document: { kind: 'pdf', pages }, detail: 'Page 2 has no text layer (scanned).' });

  it('keeps the path, status, fingerprint and page count', () => {
    expect(record).toMatchObject({
      path: 'BOQ/Facade.pdf',
      name: 'Facade.pdf',
      kind: 'pdf',
      status: 'ok',
      statusDetail: 'Page 2 has no text layer (scanned).',
      fingerprint: { mtimeMs: 1700, size: 2048 },
      pageCount: 3,
      scannedPages: [2],
      sheets: [],
      sheetRows: [],
      language: 'en',
    });
  });

  it('keeps every page and chunks only the pages with text', () => {
    expect(record.pages.map((page) => page.number)).toEqual([1, 2, 3]);
    expect([...new Set(record.chunks.map((chunk) => chunk.page))]).toEqual([1, 3]);
    expect(record.chunks.every((chunk) => chunk.text.trim() !== '')).toBe(true);
  });

  it('extracts the BOQ table with its pages', () => {
    expect(record.tables).toHaveLength(1);
    expect(record.tables[0]).toMatchObject({ pageFrom: 1, pageTo: 1, currency: 'SAR' });
    expect(record.tables[0]?.rows.map((row) => row.values[0])).toEqual(['4.01', '4.02']);
  });

  it('lists table currencies first, then those named in the text', () => {
    expect(record.currencies).toEqual(['SAR', 'USD']);
  });

  it('detects Arabic text', () => {
    const arabic = pdfPage(1, [text(60, 'محضر اجتماع رقم سبعة لمشروع البرج'), text(80, 'تمت مناقشة الجدول الزمني للأعمال')]);
    const result = buildRecord(scanned('Minutes.pdf', 'pdf'), { status: 'ok', document: { kind: 'pdf', pages: [arabic] }, detail: null });
    expect(result.language).toBe('ar');
  });

  it('keeps a scanned PDF readable through its pages', () => {
    const result = buildRecord(scanned('Survey.pdf', 'pdf'), {
      status: 'scanned',
      document: { kind: 'pdf', pages: [scannedPage(1), scannedPage(2)] },
      detail: 'The PDF is scanned.',
    });
    expect(result).toMatchObject({ status: 'scanned', pageCount: 2, scannedPages: [1, 2], chunks: [], tables: [], language: null });
  });
});

describe('buildRecord for a workbook', () => {
  const bill = sheet(
    [
      ...TITLE_ROWS,
      ['Item', 'Description', 'Unit', 'Qty', 'Rate', 'Amount (SAR)'],
      ['1.1.01', 'Site clearance', 'm2', 8400, 6.5, 54_600],
      [],
      ['1.1.02', 'Bulk excavation', 'm3', 96_000, 42, 4_032_000],
      [null, 'Checked', true, new Date('2026-01-15T00:00:00Z')],
    ],
    [],
    'Bill 1',
  );
  const notes = sheet([['Prepared by the cost team']], [], 'Notes');
  const record = buildRecord(scanned('BOQ.xlsx', 'excel'), { status: 'ok', document: { kind: 'excel', sheets: [bill, notes] }, detail: null });

  it('lists the sheets and has no pages or chunks', () => {
    expect(record).toMatchObject({ kind: 'excel', status: 'ok', pageCount: null, sheets: ['Bill 1', 'Notes'], pages: [], chunks: [], language: 'en' });
  });

  it('cleans each sheet into tables', () => {
    expect(record.tables.map((table) => table.sheet)).toEqual(['Bill 1']);
    expect(record.tables[0]?.rows.map((row) => row.sheetRow)).toEqual([6, 8, 9]);
    expect(record.currencies).toEqual(['SAR']);
  });

  it('keeps raw rows for the viewer, numbered as Excel numbers them', () => {
    const rows = record.sheetRows.find((entry) => entry.sheet === 'Bill 1')?.rows ?? [];
    expect(rows.map((row) => row.rowNumber)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(rows[0]?.cells).toEqual(['Najd Gate Mixed-Use Tower']);
    expect(rows[5]?.cells).toEqual(['1.1.01', 'Site clearance', 'm2', 8400, 6.5, 54_600]);
    expect(rows[6]?.cells).toEqual([]);
    expect(rows[8]?.cells).toEqual([null, 'Checked', 'TRUE', '2026-01-15']);
  });

  it('reads the currency of each row from a currency column', () => {
    const ledger = sheet(
      [
        ['Date', 'Description', 'Amount', 'Currency'],
        ['2026-01-02', 'Cement', 1000, 'SAR'],
        ['2026-01-03', 'Pumps', 2500, 'USD'],
        ['2026-01-04', 'Tiles', 400, 'EUR'],
      ],
      [],
      'Ledger',
    );
    const result = buildRecord(scanned('Ledger.xlsx', 'excel'), { status: 'ok', document: { kind: 'excel', sheets: [ledger] }, detail: null });
    expect(result.currencies).toEqual(['SAR', 'USD', 'EUR']);
  });
});

describe('statusRecord', () => {
  it('keeps the status and detail of a file with no content', () => {
    const record = buildRecord(scanned('Locked.pdf', 'pdf'), { status: 'encrypted', detail: 'The PDF is password-protected.' });
    expect(record).toEqual(statusRecord(scanned('Locked.pdf', 'pdf'), 'encrypted', 'The PDF is password-protected.'));
    expect(record).toMatchObject({
      path: 'Locked.pdf',
      status: 'encrypted',
      statusDetail: 'The PDF is password-protected.',
      pageCount: null,
      pages: [],
      chunks: [],
      tables: [],
      sheetRows: [],
      currencies: [],
      language: null,
    });
  });
});
