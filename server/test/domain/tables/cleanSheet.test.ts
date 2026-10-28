import { describe, expect, it } from 'vitest';
import type { RawCell } from '../../../src/domain/document';
import type { CleanTable } from '../../../src/domain/table';
import { cleanSheet } from '../../../src/domain/tables/cleanSheet';
import { sheet, TITLE_ROWS } from './grid';

function only(tables: CleanTable[]): CleanTable {
  expect(tables).toHaveLength(1);
  return tables[0] as CleanTable;
}

const columnsOf = (table: CleanTable) => table.columns.map(({ name, role, type }) => ({ name, role, type }));
const valuesOf = (table: CleanTable) => table.rows.map((row) => row.values);

describe('cleanSheet', () => {
  it('finds the header below four title rows and keeps Excel row numbers', () => {
    const grid = sheet(
      [
        ...TITLE_ROWS,
        ['Item', 'Description', 'Unit', 'Qty', 'Rate', 'Amount (SAR)'],
        ['1.1.01', 'Site clearance', 'm2', 8400, 6.5, 54_600],
        [],
        ['1.1.02', 'Bulk excavation', 'm3', 96_000, 42, 4_032_000],
      ],
      [],
      'Substructure',
    );
    const table = only(cleanSheet(grid));
    expect(table).toMatchObject({
      title: 'Najd Gate Mixed-Use Tower - Bill of Quantities - Phase 1 - Revision 0 - Date: 28 December 2025',
      sheet: 'Substructure',
      pageFrom: null,
      pageTo: null,
      currency: 'SAR',
    });
    expect(columnsOf(table)).toEqual([
      { name: 'item_code', role: 'item_code', type: 'text' },
      { name: 'description', role: 'description', type: 'text' },
      { name: 'unit', role: 'unit', type: 'text' },
      { name: 'quantity', role: 'quantity', type: 'integer' },
      { name: 'rate', role: 'rate', type: 'number' },
      { name: 'amount', role: 'amount', type: 'integer' },
    ]);
    expect(table.columns[5]?.label).toBe('Amount (SAR)');
    expect(table.rows.map((row) => row.sheetRow)).toEqual([6, 8]);
    expect(valuesOf(table)).toEqual([
      ['1.1.01', 'Site clearance', 'm2', 8400, 6.5, 54_600],
      ['1.1.02', 'Bulk excavation', 'm3', 96_000, 42, 4_032_000],
    ]);
  });

  it('joins a merged two-row header and takes the currency from it', () => {
    const grid = sheet(
      [
        ...TITLE_ROWS,
        ['Item', 'Description', 'Unit', 'Qty', 'Rates and Amounts (SAR)', null],
        [null, null, null, null, 'Rate', 'Amount'],
        ['1.1.01', 'Site clearance', 'm2', 8400, 6.5, 54_600],
      ],
      ['A1:F1', 'A2:F2', 'A3:F3', 'A4:F4', 'A5:A6', 'B5:B6', 'C5:C6', 'D5:D6', 'E5:F5'],
    );
    const table = only(cleanSheet(grid));
    expect(table.columns.map((column) => [column.name, column.label])).toEqual([
      ['item_code', 'Item'],
      ['description', 'Description'],
      ['unit', 'Unit'],
      ['quantity', 'Qty'],
      ['rate', 'Rates and Amounts (SAR) - Rate'],
      ['amount', 'Rates and Amounts (SAR) - Amount'],
    ]);
    expect(table.currency).toBe('SAR');
    expect(table.rows).toEqual([
      { values: ['1.1.01', 'Site clearance', 'm2', 8400, 6.5, 54_600], sheetRow: 7, page: null, isTotal: false, section: null },
    ]);
  });

  it('gives two tables for two tables on one sheet, each with its own title and header', () => {
    const grid = sheet([
      ['Bill 1 - Earthworks'],
      ['Item', 'Description', 'Unit', 'Qty', 'Rate', 'Amount'],
      ['1.01', 'Site clearance', 'm2', 8400, 6.5, 54_600],
      [null, 'Total Bill 1', null, null, null, 54_600],
      [],
      ['Provisional Sums (SAR)'],
      ['Ref', 'Description', 'Amount'],
      ['PS-1', 'Testing and commissioning', 250_000],
      ['PS-2', 'Utility connections', 400_000],
    ]);
    const tables = cleanSheet(grid);
    expect(tables.map((table) => table.title)).toEqual(['Bill 1 - Earthworks', 'Provisional Sums (SAR)']);
    expect(tables.map((table) => table.columns.map((column) => column.name))).toEqual([
      ['item_code', 'description', 'unit', 'quantity', 'rate', 'amount'],
      ['item_code', 'description', 'amount'],
    ]);
    expect(tables.map((table) => table.currency)).toEqual([null, 'SAR']);
    expect(tables[1]?.rows.map((row) => [row.sheetRow, ...row.values])).toEqual([
      [8, 'PS-1', 'Testing and commissioning', 250_000],
      [9, 'PS-2', 'Utility connections', 400_000],
    ]);
  });

  it('marks total and sub-total rows and carries section headings down to their rows', () => {
    const grid = sheet([
      ['Item', 'Description', 'Unit', 'Qty', 'Rate', 'Amount'],
      ['BILL 1'],
      [null, 'SUBSTRUCTURE'],
      [null, '1.1 Earthworks'],
      ['1.1.01', 'Site clearance', 'm2', 8400, 6.5, 54_600],
      ['1.1.02', 'Total station hire for setting out', 'week', 10, 1500, 15_000],
      [null, 'Sub-total 1.1 Earthworks', null, null, null, 69_600],
      [],
      [null, '1.2 Piling'],
      ['1.2.01', 'Bored piles', 'nr', 180, 21_400, 3_852_000],
      [null, 'Subtotal 1.2 Piling', null, null, null, 3_852_000],
      [null, 'Grand Total carried to Summary', null, null, null, 3_921_600],
    ]);
    const table = only(cleanSheet(grid));
    expect(table.rows.map((row) => [row.sheetRow, row.isTotal, row.section])).toEqual([
      [5, false, 'BILL 1 - SUBSTRUCTURE - 1.1 Earthworks'],
      [6, false, 'BILL 1 - SUBSTRUCTURE - 1.1 Earthworks'],
      [7, true, 'BILL 1 - SUBSTRUCTURE - 1.1 Earthworks'],
      [10, false, '1.2 Piling'],
      [11, true, '1.2 Piling'],
      [12, true, null],
    ]);
  });

  it('maps Arabic headers to roles and reads Arabic-Indic digits', () => {
    const grid = sheet([
      ['جدول الكميات - المرحلة الأولى'],
      ['البند', 'الوصف', 'الوحدة', 'الكمية', 'سعر الوحدة', 'المبلغ (ريال)', 'ملاحظات'],
      ['١-١', 'أعمال الحفر', 'م٣', '٩٦٬٠٠٠', '٤٢', '٤٬٠٣٢٬٠٠٠', 'حسب المخططات'],
      ['١-٢', 'خرسانة النظافة', 'م٢', '٦٬٤٠٠', '٢٨٫٥', '١٨٢٬٤٠٠', null],
      [null, 'الإجمالي', null, null, null, '٤٬٢١٤٬٤٠٠', null],
    ]);
    const table = only(cleanSheet(grid));
    expect(columnsOf(table)).toEqual([
      { name: 'item_code', role: 'item_code', type: 'text' },
      { name: 'description', role: 'description', type: 'text' },
      { name: 'unit', role: 'unit', type: 'text' },
      { name: 'quantity', role: 'quantity', type: 'integer' },
      { name: 'rate', role: 'rate', type: 'number' },
      { name: 'amount', role: 'amount', type: 'integer' },
      { name: 'col_7', role: null, type: 'text' },
    ]);
    expect(table.columns[6]?.label).toBe('ملاحظات');
    expect(table.title).toBe('جدول الكميات - المرحلة الأولى');
    expect(table.currency).toBe('SAR');
    expect(valuesOf(table)).toEqual([
      ['١-١', 'أعمال الحفر', 'م٣', 96_000, 42, 4_032_000, 'حسب المخططات'],
      ['١-٢', 'خرسانة النظافة', 'م٢', 6400, 28.5, 182_400, null],
      [null, 'الإجمالي', null, null, null, 4_214_400, null],
    ]);
    expect(table.rows.map((row) => row.isTotal)).toEqual([false, false, true]);
  });

  it('parses amounts written as "SAR 1.2M", "1,250,000.00" and in Arabic-Indic digits', () => {
    const grid = sheet([
      ['Description', 'Amount'],
      ['Chillers', 'SAR 1.2M'],
      ['Generators', '1,250,000.00'],
      ['Pumps', '١٬٢٥٠٬٠٠٠'],
      ['Fans', '(1,000)'],
      ['Testing', 'Included'],
    ]);
    const table = only(cleanSheet(grid));
    expect(table.columns[1]).toMatchObject({ name: 'amount', type: 'integer' });
    expect(table.rows.map((row) => row.values[1])).toEqual([1_200_000, 1_250_000, 1_250_000, -1000, null]);
    expect(table.currency).toBe('SAR');
  });

  it('adds a currency column when amounts mix currencies', () => {
    const grid = sheet([
      ['Description', 'Amount'],
      ['Chillers', 'USD 1,200,000'],
      ['Civil works', 'SAR 3,500,000'],
      ['Facade', 'EUR 800,000'],
    ]);
    const table = only(cleanSheet(grid));
    expect(table.currency).toBeNull();
    expect(table.columns.at(-1)).toEqual({ name: 'currency', label: 'Currency', type: 'text', role: 'currency' });
    expect(valuesOf(table)).toEqual([
      ['Chillers', 1_200_000, 'USD'],
      ['Civil works', 3_500_000, 'SAR'],
      ['Facade', 800_000, 'EUR'],
    ]);
  });

  it('names columns uniquely, role names first, and labels unlabelled columns by letter', () => {
    const grid = sheet([
      ['Amount Rev 0', 'Description', 'Amount', 'Amount', null],
      [100, 'Concrete', 120, 130, 'checked'],
      [200, 'Steel', 210, 220, null],
    ]);
    const table = only(cleanSheet(grid));
    expect(table.columns.map((column) => [column.name, column.label])).toEqual([
      ['amount_rev_0', 'Amount Rev 0'],
      ['description', 'Description'],
      ['amount', 'Amount'],
      ['amount_2', 'Amount'],
      ['column_e', 'Column E'],
    ]);
  });

  it('gives no table for a sheet without one', () => {
    expect(cleanSheet(sheet([]))).toEqual([]);
    expect(cleanSheet(sheet([['Notes'], ['All rates exclude VAT.']]))).toEqual([]);
    expect(cleanSheet(sheet([['Item', 'Description', 'Amount']]))).toEqual([]);
  });

  it('cleans a 10,000-row sheet in under a second', () => {
    const rows: RawCell[][] = [...TITLE_ROWS, ['Item', 'Description', 'Unit', 'Qty', 'Rate', 'Amount (SAR)']];
    for (let i = 1; i <= 10_000; i++) {
      if (i % 50 === 1) rows.push([null, `Section ${Math.ceil(i / 50)}`]);
      rows.push([`L-${i}`, `Ledger line ${i} for materials and labour`, 'nr', i % 97, '1,250.50', `SAR ${(i % 97) * 1250.5}`]);
    }
    rows.push([null, 'Grand Total', null, null, null, 'SAR 60,000,000']);
    const started = performance.now();
    const table = only(cleanSheet(sheet(rows)));
    const elapsed = performance.now() - started;
    expect(table.rows).toHaveLength(10_001);
    expect(table.rows.at(-1)?.isTotal).toBe(true);
    expect(table.rows[0]?.section).toBe('Section 1');
    expect(table.currency).toBe('SAR');
    expect(elapsed).toBeLessThan(1000);
  });
});
