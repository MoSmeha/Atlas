import { describe, expect, it } from 'vitest';
import { findTableScheduleRows, type ScheduleTable } from '../../src/domain/scheduleTables';
import type { CleanValue } from '../../src/domain/table';

function table(
  columns: [name: string, label: string][],
  rows: CleanValue[][],
  options: { totals?: number[] } = {},
): ScheduleTable {
  return {
    document: 'Programme.xlsx',
    sheet: 'Programme',
    columns: columns.map(([name, label]) => ({ name, label })),
    rows: rows.map((values, i) => ({
      values: Object.fromEntries(columns.map(([name], j) => [name, values[j] ?? null])),
      sheetRow: 4 + i,
      isTotal: options.totals?.includes(i) ?? false,
    })),
  };
}

describe('findTableScheduleRows', () => {
  it('turns each dated row into a candidate with its sheet row, taking the finish date', () => {
    const programme = table(
      [['activity', 'Activity'], ['start', 'Start'], ['finish', 'Finish']],
      [
        ['Excavation', '2026-03-01', '2026-04-15'],
        ['Submit shop drawings', '2026-04-01', '2026-04-20'],
      ],
    );
    expect(findTableScheduleRows(programme)).toEqual([
      {
        kind: 'date',
        match: 'Start: 2026-03-01; Finish: 2026-04-15',
        sentence: 'Activity: Excavation | Start: 2026-03-01 | Finish: 2026-04-15',
        document: 'Programme.xlsx',
        isoDate: '2026-04-15',
        hijri: null,
        duration: null,
        sheet: 'Programme',
        row: 4,
      },
      expect.objectContaining({ kind: 'deliverable', isoDate: '2026-04-20', row: 5 }),
    ]);
  });

  it('reads Excel serial dates only in columns whose header names a date', () => {
    const milestones = table(
      [['milestone', 'Milestone'], ['due_date', 'Due Date'], ['amount', 'Amount']],
      [
        ['Practical completion', 46203, 46203],
        ['Handover', 46234, 50000],
      ],
    );
    const found = findTableScheduleRows(milestones);
    expect(found.map((row) => [row.kind, row.isoDate, row.match])).toEqual([
      ['deadline', '2026-06-30', 'Due Date: 2026-06-30'],
      ['deadline', '2026-07-31', 'Due Date: 2026-07-31'],
    ]);
    expect(found[0]?.sentence).toBe('Milestone: Practical completion | Due Date: 2026-06-30 | Amount: 46203');
  });

  it('ignores numbers in columns without a date header', () => {
    expect(findTableScheduleRows(table([['item', 'Item'], ['rate', 'Rate']], [['Concrete', 46082]]))).toEqual([]);
  });

  it('skips total rows and rows without a date', () => {
    const found = findTableScheduleRows(
      table(
        [['activity', 'Activity'], ['date', 'Date']],
        [
          ['Mobilisation', '01/03/2026'],
          ['Design', null],
          ['Total', '30/06/2026'],
          ['Commissioning', '15/06/2026'],
        ],
        { totals: [2] },
      ),
    );
    expect(found.map((row) => [row.row, row.isoDate])).toEqual([
      [4, '2026-03-01'],
      [7, '2026-06-15'],
    ]);
  });

  it('reads Arabic headers and Hijri dates as written', () => {
    const found = findTableScheduleRows(
      table(
        [['c_1', 'البند'], ['c_2', 'تاريخ التسليم']],
        [['تسليم المخططات', '1447/09/11 هـ']],
      ),
    );
    expect(found).toEqual([
      expect.objectContaining({ kind: 'deliverable', isoDate: null, hijri: '1447/09/11 هـ', row: 4 }),
    ]);
  });

  it('returns nothing for a table without a date column', () => {
    expect(findTableScheduleRows(table([['item', 'Item'], ['qty', 'Qty']], [['Piles', 10]]))).toEqual([]);
  });
});
