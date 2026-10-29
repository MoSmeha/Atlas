import { describe, expect, it } from 'vitest';
import { isMetaColumn, visibleColumns } from '../../src/domain/visibleColumns';

describe('visibleColumns', () => {
  it('leaves out _row, _page, _is_total and _section, with their values', () => {
    const table = {
      columns: ['item_code', '_row', 'amount', '_page', '_is_total', '_section'],
      rows: [
        ['3.2.04', 21, 4250000, null, 0, 'Electrical'],
        ['3.1.01', 8, 4140000, null, 0, 'HVAC'],
      ],
    };
    expect(visibleColumns(table)).toEqual({
      columns: ['item_code', 'amount'],
      rows: [
        ['3.2.04', 4250000],
        ['3.1.01', 4140000],
      ],
    });
  });

  it('keeps columns the query named, even when they hold row numbers', () => {
    const table = { columns: ['document', 'excel_row', 'section', 'amount'], rows: [['BOQ.xlsx', 21, 'MEP', 100]] };
    expect(visibleColumns(table)).toEqual(table);
  });

  it('keeps every column when all of them are meta columns', () => {
    const table = { columns: ['_section'], rows: [['Bill 1 - Preliminaries'], ['Bill 2 - Substructure']] };
    expect(visibleColumns(table)).toEqual(table);
  });

  it('does not change the table it reads', () => {
    const table = { columns: ['item_code', '_row'], rows: [['A1', 5]] };
    visibleColumns(table);
    expect(table).toEqual({ columns: ['item_code', '_row'], rows: [['A1', 5]] });
  });

  it('treats only names starting with an underscore as meta columns', () => {
    expect(['_row', '_page', '_is_total', '_section', '_ROW'].every(isMetaColumn)).toBe(true);
    expect(['row', 'excel_row', 'page_or_rows', 'count(_row)'].some(isMetaColumn)).toBe(false);
  });
});
