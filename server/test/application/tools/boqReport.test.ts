import { describe, expect, it } from 'vitest';
import type { TableSchema } from '../../../src/application/ports/DocumentIndex';
import { coverage, mismatchNote, mismatchSources, tableSources, uniqueSources } from '../../../src/application/tools/boqReport';
import type { BoqMismatch, BoqRow } from '../../../src/domain/boqArithmetic';

function row(patch: Partial<BoqRow>): BoqRow {
  return {
    itemCode: null,
    description: null,
    quantity: null,
    rate: null,
    amount: null,
    isTotal: false,
    section: null,
    sheetRow: null,
    page: null,
    ...patch,
  };
}

function totalMismatch(patch: Partial<BoqMismatch>): BoqMismatch {
  return {
    kind: 'total',
    row: row({ isTotal: true, amount: 100, sheetRow: 30 }),
    stated: 100,
    expected: 120,
    difference: -20,
    base: null,
    covered: [],
    gap: null,
    matchesSubtotals: false,
    ...patch,
  };
}

const pdfTable: TableSchema = {
  name: 'tender_1',
  document: 'Tender.pdf',
  title: null,
  sheet: null,
  pageFrom: 6,
  pageTo: 8,
  columns: [],
  rowCount: 0,
  currency: 'SAR',
};

describe('boqReport', () => {
  it('describes a running total as the earlier total plus the items after it', () => {
    const mismatch = totalMismatch({
      base: row({ isTotal: true, page: 4 }),
      covered: [row({ page: 5 }), row({ page: 5 })],
    });
    expect(coverage(mismatch)).toBe('the total on page 4 plus the 2 item rows on page 5');
    expect(coverage(totalMismatch({ covered: [row({ sheetRow: 12 })] }))).toBe('the item row in row 12');
    expect(coverage({ ...totalMismatch({}), kind: 'item' })).toBeNull();
  });

  it('explains a total that carries a wrong sub-total, or one that counts an item twice', () => {
    expect(mismatchNote(totalMismatch({ matchesSubtotals: true }))).toBe(
      'It adds up the sub-totals above it correctly, so the gap comes from a wrong sub-total.',
    );
    expect(mismatchNote(totalMismatch({ gap: { row: row({ page: 7 }), how: 'counted_twice' } }))).toBe(
      'The item on page 7 has an amount equal to the gap; the total seems to count it twice.',
    );
    expect(mismatchNote(totalMismatch({}))).toBeNull();
  });

  it('cites every page a PDF total adds up, and the whole page range when rows have no page', () => {
    const mismatch = totalMismatch({ row: row({ isTotal: true, page: 8 }), covered: [row({ page: 6 }), row({ page: 7 })] });
    expect(mismatchSources(pdfTable, mismatch).map((source) => source.kind === 'pdf' && source.page)).toEqual([6, 7, 8]);
    expect(tableSources(pdfTable, [])).toEqual([6, 7, 8].map((page) => ({ kind: 'pdf', document: 'Tender.pdf', page, quote: null })));
  });

  it('drops repeated sources', () => {
    const source = { kind: 'pdf', document: 'Tender.pdf', page: 6, quote: null } as const;
    expect(uniqueSources([source, { ...source }, { ...source, page: 7 }])).toHaveLength(2);
  });
});
