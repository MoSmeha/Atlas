import { describe, expect, it } from 'vitest';
import type { SheetGrid } from '../../../src/domain/document';
import { type Area, profileRows } from '../../../src/domain/tables/area';
import { findHeader } from '../../../src/domain/tables/headerDetection';
import { sheet, TITLE_ROWS } from './grid';

function headerOf(grid: SheetGrid) {
  const width = grid.rows.reduce((widest, row) => Math.max(widest, row.length), 0);
  const area: Area = { top: 0, bottom: grid.rows.length - 1, left: 0, right: width - 1 };
  return findHeader(grid, profileRows(grid, area), area);
}

describe('findHeader', () => {
  it('finds a header below four title rows', () => {
    const grid = sheet([
      ...TITLE_ROWS,
      ['Item', 'Description', 'Unit', 'Qty', 'Rate', 'Amount'],
      ['1.1.01', 'Site clearance', 'm2', 8400, 6.5, 54_600],
      ['1.1.02', 'Bulk excavation', 'm3', 96_000, 42, 4_032_000],
    ]);
    const header = headerOf(grid);
    expect(header).toMatchObject({ top: 4, bottom: 4 });
    expect(header?.roles).toEqual(['item_code', 'description', 'unit', 'quantity', 'rate', 'amount']);
  });

  it('joins a merged two-row header, filling merged cells across their span', () => {
    const grid = sheet(
      [
        ...TITLE_ROWS,
        ['Item', 'Description', 'Unit', 'Qty', 'Rates and Amounts (SAR)', null],
        [null, null, null, null, 'Rate', 'Amount'],
        ['1.1.01', 'Site clearance', 'm2', 8400, 6.5, 54_600],
      ],
      ['A1:F1', 'A2:F2', 'A3:F3', 'A4:F4', 'A5:A6', 'B5:B6', 'C5:C6', 'D5:D6', 'E5:F5'],
    );
    const header = headerOf(grid);
    expect(header).toMatchObject({ top: 4, bottom: 5 });
    expect(header?.labels).toEqual([
      'Item',
      'Description',
      'Unit',
      'Qty',
      'Rates and Amounts (SAR) - Rate',
      'Rates and Amounts (SAR) - Amount',
    ]);
    expect(header?.roles).toEqual(['item_code', 'description', 'unit', 'quantity', 'rate', 'amount']);
  });

  it('writes a currency row under its parent as "Amount (SAR)"', () => {
    const grid = sheet([
      ['Description', 'Amount', 'Amount'],
      [null, 'SAR', 'USD'],
      ['Chillers', 1000, 270],
    ]);
    const header = headerOf(grid);
    expect(header?.labels).toEqual(['Description', 'Amount (SAR)', 'Amount (USD)']);
    expect(header?.roles).toEqual(['description', 'amount', null]);
  });

  it('starts at the parent row when the child row names more roles', () => {
    const grid = sheet(
      [
        ['Item', 'Particulars', 'Quantities', null, 'Prices', null],
        [null, null, 'Qty', 'Unit', 'Rate', 'Amount'],
        ['A1', 'Concrete', 10, 'm3', 700, 7000],
      ],
      ['A1:A2', 'B1:B2', 'C1:D1', 'E1:F1'],
    );
    const header = headerOf(grid);
    expect(header).toMatchObject({ top: 0, bottom: 1 });
    expect(header?.roles).toEqual(['item_code', 'description', 'quantity', 'unit', 'rate', 'amount']);
  });

  it('does not take a section heading under a merged description header as a header row', () => {
    const grid = sheet(
      [
        ['Item', 'Description', null, 'Qty', 'Amount'],
        [null, '1.1 Earthworks', null, null, null],
        ['1.1.01', 'Site clearance', null, 8400, 54_600],
      ],
      ['B1:C1'],
    );
    expect(headerOf(grid)).toMatchObject({ top: 0, bottom: 0 });
  });

  it('finds a header without known labels as the first wide text row', () => {
    const grid = sheet([
      ['Register of submittals'],
      ['Submittal', 'Title', 'Status'],
      ['SUB-001', 'Concrete mix design', 'Approved'],
      ['SUB-002', 'Rebar shop drawings', 'Rejected'],
    ]);
    expect(headerOf(grid)).toMatchObject({ top: 1, labels: ['Submittal', 'Title', 'Status'] });
  });

  it('is null for a sheet of notes', () => {
    expect(headerOf(sheet([['Notes'], ['All rates exclude VAT.'], ['Prices valid for 90 days.']]))).toBeNull();
  });
});
