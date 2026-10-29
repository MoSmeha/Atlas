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

  it('cites the rows of both sides of a join, each on the only sheet that has it', () => {
    // Rows 12 and 13 are only in Bill 1; rows 4 and 30 only in Bill 2.
    const found = result(['item_code', '_row', '_row'], [['A1', 12, 30], ['A2', 13, 4]]);
    expect(querySources(found, [bill1, bill2], rowsOf)).toEqual([
      { kind: 'excel', document: 'BOQ.xlsx', sheet: 'Bill 1', rowFrom: 12, rowTo: 13 },
      { kind: 'excel', document: 'BOQ.xlsx', sheet: 'Bill 2', rowFrom: 4, rowTo: 4 },
      { kind: 'excel', document: 'BOQ.xlsx', sheet: 'Bill 2', rowFrom: 30, rowTo: 30 },
    ]);
  });

  it('cites nothing for a query that reads no loaded table, or an empty sheet table', () => {
    expect(querySources(result(['1 + 1'], [[2]]), [], rowsOf)).toEqual([]);
    expect(querySources(result(['amount'], []), [bill1], () => [])).toEqual([]);
  });
});

/** Two revisions of one BOQ with the same sheet names, and a PDF BOQ: a UNION ALL over them repeats row numbers. */
const rev0Mep = schema('t_rev0_mep', 'BOQs/BOQ_Rev0.xlsx', 'MEP');
const rev0Civil = schema('t_rev0_civil', 'BOQs/BOQ_Rev0.xlsx', 'Civil');
const rev1Mep = schema('t_rev1_mep', 'BOQs/BOQ_Rev1.xlsx', 'MEP');
const facade = schema('t_facade', 'Facade.pdf', null, [1, 3]);
const unionRows: Record<string, TableRowRecord[]> = {
  // Rows 8 to 12 are items and row 13 the sheet total.
  t_rev0_mep: rows([8, 9, 10, 11, 12, 13]),
  t_rev0_civil: rows([8, 9, 10, 11, 12, 13]),
  // Rev 1 adds items on rows 13 and 14 and moves the total to row 15.
  t_rev1_mep: rows([8, 9, 10, 11, 12, 13, 14, 15]),
  t_facade: rows([], [1, 1, 2, 3]),
};
const unionRowsOf = (table: string) => unionRows[table] ?? [];
const unionTables = [rev0Mep, rev0Civil, rev1Mep, facade];
const rev0MepWhole = { kind: 'excel', document: 'BOQs/BOQ_Rev0.xlsx', sheet: 'MEP', rowFrom: 8, rowTo: 13 };
const rev0CivilWhole = { kind: 'excel', document: 'BOQs/BOQ_Rev0.xlsx', sheet: 'Civil', rowFrom: 8, rowTo: 13 };
const rev1MepWhole = { kind: 'excel', document: 'BOQs/BOQ_Rev1.xlsx', sheet: 'MEP', rowFrom: 8, rowTo: 15 };

describe('querySources over a UNION ALL', () => {
  it('cites each row on its own sheet, from the document and sheet columns, in ranges', () => {
    const found = result(
      ['document', 'sheet', 'item_code', 'amount', '_row', '_page'],
      [
        ['BOQ_Rev0.xlsx', 'MEP', '3.2.04', 4250000, 9, null],
        ['BOQ_Rev0.xlsx', 'MEP', '3.1.01', 4140000, 11, null],
        ['BOQ_Rev0.xlsx', 'MEP', '3.1.04', 3306000, 12, null],
        ['BOQ_Rev0.xlsx', 'Civil', '1.3.02', 11760000, 8, null],
        ['BOQ_Rev1.xlsx', 'MEP', '3.2.04', 4300000, 9, null],
        ['BOQ_Rev1.xlsx', 'MEP', '3.9.01', 1200000, 14, null],
        ['Facade.pdf', null, 'F.2.01', 20590000, null, 2],
        ['Facade.pdf', null, 'F.1.03', 1100000, null, 1],
      ],
    );
    expect(querySources(found, unionTables, unionRowsOf)).toEqual([
      { kind: 'excel', document: 'BOQs/BOQ_Rev0.xlsx', sheet: 'MEP', rowFrom: 9, rowTo: 9 },
      { kind: 'excel', document: 'BOQs/BOQ_Rev0.xlsx', sheet: 'MEP', rowFrom: 11, rowTo: 12 },
      { kind: 'excel', document: 'BOQs/BOQ_Rev0.xlsx', sheet: 'Civil', rowFrom: 8, rowTo: 8 },
      { kind: 'excel', document: 'BOQs/BOQ_Rev1.xlsx', sheet: 'MEP', rowFrom: 9, rowTo: 9 },
      { kind: 'excel', document: 'BOQs/BOQ_Rev1.xlsx', sheet: 'MEP', rowFrom: 14, rowTo: 14 },
      { kind: 'pdf', document: 'Facade.pdf', page: 1, quote: null },
      { kind: 'pdf', document: 'Facade.pdf', page: 2, quote: null },
    ]);
  });

  it('matches names whatever their case: path, file name, name without extension, sheet or table name', () => {
    const found = result(
      ['file', 'tab', '_row'],
      [
        ['boqs/boq_rev0.xlsx', 'civil', 10],
        ['BOQ_Rev1', ' mep ', 8],
        ['t_rev0_mep', null, 8],
      ],
    );
    expect(querySources(found, unionTables, unionRowsOf)).toEqual([
      { kind: 'excel', document: 'BOQs/BOQ_Rev0.xlsx', sheet: 'Civil', rowFrom: 10, rowTo: 10 },
      { kind: 'excel', document: 'BOQs/BOQ_Rev1.xlsx', sheet: 'MEP', rowFrom: 8, rowTo: 8 },
      { kind: 'excel', document: 'BOQs/BOQ_Rev0.xlsx', sheet: 'MEP', rowFrom: 8, rowTo: 8 },
    ]);
  });

  it('still uses a sheet column whose PDF rows hold something that is no sheet', () => {
    const found = result(
      ['document', 'sheet', '_row', '_page'],
      [
        ['BOQ_Rev0.xlsx', 'MEP', 10, null],
        ['BOQ_Rev0.xlsx', 'Civil', 10, null],
        ['BOQ_Rev0.xlsx', 'Civil', 11, null],
        ['Facade.pdf', 'Facade BOQ', null, 3],
      ],
    );
    expect(querySources(found, unionTables, unionRowsOf)).toEqual([
      { kind: 'excel', document: 'BOQs/BOQ_Rev0.xlsx', sheet: 'MEP', rowFrom: 10, rowTo: 10 },
      { kind: 'excel', document: 'BOQs/BOQ_Rev0.xlsx', sheet: 'Civil', rowFrom: 10, rowTo: 11 },
      { kind: 'pdf', document: 'Facade.pdf', page: 3, quote: null },
    ]);
  });

  it('traces a row without naming columns to the only sheet that has it', () => {
    const found = result(['item_code', '_row'], [['3.9.01', 14], ['3.9.02', 15]]);
    expect(querySources(found, [rev0Mep, rev1Mep], unionRowsOf)).toEqual([
      { kind: 'excel', document: 'BOQs/BOQ_Rev1.xlsx', sheet: 'MEP', rowFrom: 14, rowTo: 15 },
    ]);
  });

  it('cites whole only the tables an untraced row could come from, beside the traced rows', () => {
    // Rev 1 has one sheet, so its row 14 is traced; row 9 of Rev 0 is on both of its sheets.
    const found = result(['document', 'item_code', '_row'], [['BOQ_Rev1.xlsx', '3.9.01', 14], ['BOQ_Rev0.xlsx', '3.1.01', 9]]);
    expect(querySources(found, unionTables, unionRowsOf)).toEqual([
      { kind: 'excel', document: 'BOQs/BOQ_Rev1.xlsx', sheet: 'MEP', rowFrom: 14, rowTo: 14 },
      rev0MepWhole,
      rev0CivilWhole,
    ]);
  });

  it('leaves out traced rows that a table cited whole already covers', () => {
    // Row 14 is only in Rev 1, but row 9 could be either revision's, so both are cited whole.
    const found = result(['item_code', '_row'], [['3.9.01', 14], ['3.1.01', 9]]);
    expect(querySources(found, [rev0Mep, rev1Mep], unionRowsOf)).toEqual([rev0MepWhole, rev1MepWhole]);
  });

  it('falls back to every table whole when no row can be traced', () => {
    const found = result(['item_code', '_row'], [['3.1.01', 9], ['1.3.02', 10]]);
    expect(querySources(found, [rev0Mep, rev0Civil, rev1Mep], unionRowsOf)).toEqual([rev0MepWhole, rev0CivilWhole, rev1MepWhole]);
  });

  it('does not take a description that happens to be a sheet name for the sheet', () => {
    const found = result(['description', '_row'], [['Civil', 9], ['Chilled water pipework', 10], ['Power cabling', 11]]);
    expect(querySources(found, [rev0Mep, rev0Civil], unionRowsOf)).toEqual([rev0MepWhole, rev0CivilWhole]);
  });
});
