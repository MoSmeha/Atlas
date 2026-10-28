import { describe, expect, it } from 'vitest';
import type { QueryResult, TableRowRecord, TableSchema } from '../../../src/application/ports/DocumentIndex';
import { querySources } from '../../../src/application/tools/querySources';

function schema(name: string, document: string, sheet: string | null, pages: [number, number] | null = null): TableSchema {
  return {
    name,
    document,
    title: null,
    sheet,
    pageFrom: pages?.[0] ?? null,
    pageTo: pages?.[1] ?? null,
    columns: [{ name: 'amount', label: 'Amount', type: 'number' }],
    rowCount: 0,
    currency: 'SAR',
  };
}

function rows(sheetRows: (number | null)[], pages: (number | null)[] = []): TableRowRecord[] {
  const count = Math.max(sheetRows.length, pages.length);
  return Array.from({ length: count }, (_, i) => ({
    values: {},
    sheetRow: sheetRows[i] ?? null,
    page: pages[i] ?? null,
    isTotal: false,
    section: null,
  }));
}

function result(columns: string[], values: (string | number | null)[][]): QueryResult {
  return { columns, rows: values, truncated: false };
}

const bill1 = schema('t_boq_bill_1', 'BOQ.xlsx', 'Bill 1');
const bill1b = schema('t_boq_bill_1_2', 'BOQ.xlsx', 'Bill 1');
const bill2 = schema('t_boq_bill_2', 'BOQ.xlsx', 'Bill 2');
const pdfBoq = schema('t_tender_p4', 'Tender BOQ.pdf', null, [4, 6]);

/** Bill 1 holds rows 5 to 9, a sub-total on row 10, a heading on row 11 and rows 12 to 14. */
const tableRows: Record<string, TableRowRecord[]> = {
  t_boq_bill_1: rows([5, 6, 7, 8, 9, 10, 12, 13, 14]),
  t_boq_bill_1_2: rows([20, 21, 22]),
  t_boq_bill_2: rows([4, 5, 6, 30]),
  t_tender_p4: rows([], [4, 4, 5, 6, 6]),
};
const rowsOf = (table: string) => tableRows[table] ?? [];

describe('querySources', () => {
  it('cites the exact sheet rows of one table, in ranges', () => {
    const found = result(['item_code', '_row'], [['A1', 5], ['A2', 6], ['A4', 8], ['A5', 9], ['B1', 12], ['B2', 13]]);
    expect(querySources(found, [bill1], rowsOf)).toEqual([
      { kind: 'excel', document: 'BOQ.xlsx', sheet: 'Bill 1', rowFrom: 5, rowTo: 6 },
      { kind: 'excel', document: 'BOQ.xlsx', sheet: 'Bill 1', rowFrom: 8, rowTo: 9 },
      { kind: 'excel', document: 'BOQ.xlsx', sheet: 'Bill 1', rowFrom: 12, rowTo: 13 },
    ]);
  });

  it('runs a range across a heading row the table skips, but not across an uncited sub-total', () => {
    const found = result(['_row'], [[9], [12], [13], [14]]);
    expect(querySources(found, [bill1], rowsOf)).toEqual([
      { kind: 'excel', document: 'BOQ.xlsx', sheet: 'Bill 1', rowFrom: 9, rowTo: 9 },
      { kind: 'excel', document: 'BOQ.xlsx', sheet: 'Bill 1', rowFrom: 12, rowTo: 14 },
    ]);
  });

  it('finds the _row column whatever its case and ignores empty values', () => {
    const found = result(['_ROW', 'amount'], [[7, 100], [null, 50], ['x', 1]]);
    expect(querySources(found, [bill1], rowsOf)).toEqual([
      { kind: 'excel', document: 'BOQ.xlsx', sheet: 'Bill 1', rowFrom: 7, rowTo: 7 },
    ]);
  });

  it('cites exact rows when several tables share one sheet', () => {
    const found = result(['_row'], [[5], [20], [21]]);
    expect(querySources(found, [bill1, bill1b], rowsOf)).toEqual([
      { kind: 'excel', document: 'BOQ.xlsx', sheet: 'Bill 1', rowFrom: 5, rowTo: 5 },
      { kind: 'excel', document: 'BOQ.xlsx', sheet: 'Bill 1', rowFrom: 20, rowTo: 21 },
    ]);
  });

  it('cites each table whole when the rows could come from several sheets', () => {
    const found = result(['_row'], [[5], [6]]);
    expect(querySources(found, [bill1, bill2], rowsOf)).toEqual([
      { kind: 'excel', document: 'BOQ.xlsx', sheet: 'Bill 1', rowFrom: 5, rowTo: 14 },
      { kind: 'excel', document: 'BOQ.xlsx', sheet: 'Bill 2', rowFrom: 4, rowTo: 30 },
    ]);
  });

  it('cites a table whole when the result has no row numbers, such as a total', () => {
    expect(querySources(result(['sum(amount)'], [[1250000]]), [bill2], rowsOf)).toEqual([
      { kind: 'excel', document: 'BOQ.xlsx', sheet: 'Bill 2', rowFrom: 4, rowTo: 30 },
    ]);
    expect(querySources(result(['amount'], []), [bill2], rowsOf)).toEqual([
      { kind: 'excel', document: 'BOQ.xlsx', sheet: 'Bill 2', rowFrom: 4, rowTo: 30 },
    ]);
  });

  it('cites the exact pages of a PDF table', () => {
    const found = result(['item_code', '_page'], [['3.1', 5], ['3.2', 5], ['3.9', 4]]);
    expect(querySources(found, [pdfBoq], rowsOf)).toEqual([
      { kind: 'pdf', document: 'Tender BOQ.pdf', page: 4, quote: null },
      { kind: 'pdf', document: 'Tender BOQ.pdf', page: 5, quote: null },
    ]);
  });

  it('cites every page of a PDF table read whole, from its rows or else its page range', () => {
    const expected = [4, 5, 6].map((page) => ({ kind: 'pdf', document: 'Tender BOQ.pdf', page, quote: null }));
    expect(querySources(result(['count(*)'], [[12]]), [pdfBoq], rowsOf)).toEqual(expected);
    expect(querySources(result(['count(*)'], [[12]]), [pdfBoq], () => [])).toEqual(expected);
  });

  it('cites nothing for a query that reads no loaded table, or an empty sheet table', () => {
    expect(querySources(result(['1 + 1'], [[2]]), [], rowsOf)).toEqual([]);
    expect(querySources(result(['amount'], []), [bill1], () => [])).toEqual([]);
  });
});
