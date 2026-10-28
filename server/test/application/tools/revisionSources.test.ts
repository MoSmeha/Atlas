import { describe, expect, it } from 'vitest';
import type { TableSchema } from '../../../src/application/ports/DocumentIndex';
import { revisionSources, type RevisionSide } from '../../../src/application/tools/revisionSources';
import { compareBoqs, type RevisionRow } from '../../../src/domain/revisions';

function row(sheetRow: number, code: string | null, amount: number, isTotal = false): RevisionRow {
  return {
    itemCode: code,
    description: code === null ? 'Sub-total' : `Item ${code}`,
    quantity: isTotal ? null : 1,
    rate: isTotal ? null : amount,
    amount,
    isTotal,
    section: null,
    sheetRow,
    page: null,
    sheet: 'Bill 1',
    currency: 'SAR',
  };
}

function side(document: string, rows: RevisionRow[]): RevisionSide {
  const schema: TableSchema = {
    name: 'boq_1',
    document,
    title: null,
    sheet: 'Bill 1',
    pageFrom: null,
    pageTo: null,
    columns: [],
    rowCount: rows.length,
    currency: 'SAR',
  };
  return { document, tables: [{ schema, rows }] };
}

describe('revisionSources', () => {
  it('splits a range at an uncited total and joins neighbouring rows, document A first', () => {
    const a = side('Rev0.xlsx', [row(5, '1', 10), row(6, '2', 20), row(7, null, 30, true), row(8, '3', 40), row(9, '4', 50)]);
    const b = side('Rev1.xlsx', [row(5, '1', 11), row(6, '2', 21), row(7, null, 32, true), row(8, '3', 40), row(9, '4', 55)]);
    const diff = compareBoqs(a.tables[0]?.rows ?? [], b.tables[0]?.rows ?? []);
    expect(revisionSources(diff, a, b)).toEqual([
      { kind: 'excel', document: 'Rev0.xlsx', sheet: 'Bill 1', rowFrom: 5, rowTo: 6 },
      { kind: 'excel', document: 'Rev0.xlsx', sheet: 'Bill 1', rowFrom: 9, rowTo: 9 },
      { kind: 'excel', document: 'Rev1.xlsx', sheet: 'Bill 1', rowFrom: 5, rowTo: 6 },
      { kind: 'excel', document: 'Rev1.xlsx', sheet: 'Bill 1', rowFrom: 9, rowTo: 9 },
    ]);
  });

  it('cites only the document an added or removed item is in', () => {
    const a = side('Rev0.xlsx', [row(5, '1', 10)]);
    const b = side('Rev1.xlsx', [row(5, '1', 10), row(6, '2', 20)]);
    const diff = compareBoqs(a.tables[0]?.rows ?? [], b.tables[0]?.rows ?? []);
    expect(revisionSources(diff, a, b)).toEqual([{ kind: 'excel', document: 'Rev1.xlsx', sheet: 'Bill 1', rowFrom: 6, rowTo: 6 }]);
  });
});
