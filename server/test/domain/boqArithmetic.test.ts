import { describe, expect, it } from 'vitest';
import { checkRows, itemTolerance, totalTolerance, type BoqRow } from '../../src/domain/boqArithmetic';

/** Builds rows on consecutive sheet rows from 7, as the sample BOQs lay them out. */
function sheet() {
  let next = 7;
  const at = (): number => next++;
  return {
    item: (code: string, quantity: number | null, rate: number | null, amount: number | null, section: string | null = null): BoqRow => ({
      itemCode: code,
      description: `Item ${code}`,
      quantity,
      rate,
      amount,
      isTotal: false,
      section,
      sheetRow: at(),
      page: null,
    }),
    total: (label: string, amount: number | null, section: string | null = null): BoqRow => ({
      itemCode: null,
      description: label,
      quantity: null,
      rate: null,
      amount,
      isTotal: true,
      section,
      sheetRow: at(),
      page: null,
    }),
  };
}

function pdfRow(page: number, row: Partial<BoqRow>): BoqRow {
  return {
    itemCode: null,
    description: null,
    quantity: null,
    rate: null,
    amount: null,
    isTotal: false,
    section: null,
    sheetRow: null,
    page,
    ...row,
  };
}

const rowsOf = (rows: BoqRow[]) => rows.map((row) => row.sheetRow ?? row.page);

describe('checkRows: item rows', () => {
  it('passes rows where quantity x rate is the amount', () => {
    const { item } = sheet();
    const check = checkRows([item('A1', 10, 125.5, 1255), item('A2', 2140, 385, 823900), item('A3', 0.5, 0.1, 0.05)]);
    expect(check).toEqual({ checkedRows: 3, mismatches: [] });
  });

  it('flags a typed amount with the expected value and the difference', () => {
    const { item } = sheet();
    const wrong = item('1.1.05', 1850, 46.5, 80625);
    const check = checkRows([item('1.1.04', 10, 10, 100), wrong]);
    expect(check.checkedRows).toBe(2);
    expect(check.mismatches).toEqual([
      {
        kind: 'item',
        row: wrong,
        stated: 80625,
        expected: 86025,
        difference: -5400,
        base: null,
        covered: [],
        gap: null,
        matchesSubtotals: false,
      },
    ]);
  });

  it('flags an amount ten times too small and one too large', () => {
    const { item } = sheet();
    const check = checkRows([item('3.1.07', 36, 18750, 67500), item('2.3.02', 2140, 385, 832900)]);
    expect(check.mismatches.map(({ expected, difference }) => ({ expected, difference }))).toEqual([
      { expected: 675000, difference: -607500 },
      { expected: 823900, difference: 9000 },
    ]);
  });

  it('allows a cent, or 0.05% for rounded rates, and no more', () => {
    const { item } = sheet();
    const check = checkRows([
      item('T1', 3, 33.33, 100),
      item('T2', 1000, 10, 10004),
      item('T3', 1000, 10, 10006),
      item('T4', 1, 0.5, 0.52),
    ]);
    expect(check.mismatches.map((mismatch) => mismatch.row.itemCode)).toEqual(['T3', 'T4']);
    expect(itemTolerance(100)).toBe(0.05);
    expect(itemTolerance(-2)).toBe(0.01);
  });

  it('works with exact decimals, not floating point noise', () => {
    const { item } = sheet();
    const check = checkRows([item('D1', 12.3, 4.1, 50.43), item('D2', 3, 0.1, 0.3)]);
    expect(check.mismatches).toEqual([]);
  });

  it('skips the product check on rows without a quantity or rate, such as lump sums', () => {
    const { item } = sheet();
    const check = checkRows([item('LS1', null, null, 250000), item('PS1', 1, null, 50000), item('N1', 5, 10, null)]);
    expect(check).toEqual({ checkedRows: 0, mismatches: [] });
  });
});

describe('checkRows: totals', () => {
  it('passes a bill whose sub-totals and total add up', () => {
    const { item, total } = sheet();
    const check = checkRows([
      item('1.1.01', 10, 100, 1000, '1.1'),
      item('1.1.02', 5, 200, 1000, '1.1'),
      total('Sub-total 1.1', 2000, '1.1'),
      item('1.2.01', 1, 500, 500, '1.2'),
      item('1.2.02', null, null, 250, '1.2'),
      total('Sub-total 1.2', 750, '1.2'),
      total('Total Bill 1', 2750, '1.2'),
    ]);
    expect(check).toEqual({ checkedRows: 6, mismatches: [] });
  });

  it('flags a sub-total that leaves out its last item, and the total that carries it', () => {
    const { item, total } = sheet();
    const rows = [
      item('1.1.01', 10, 100, 1000, '1.1'),
      total('Sub-total 1.1', 1000, '1.1'),
      item('1.2.01', 10, 8000, 80000, '1.2'),
      item('1.2.02', 1, 117000, 117000, '1.2'),
      total('Sub-total 1.2', 80000, '1.2'),
      total('Total Bill 1', 81000, '1.2'),
    ];
    const [first, second] = checkRows(rows).mismatches;
    expect(first).toMatchObject({ kind: 'total', row: rows[4], stated: 80000, expected: 197000, difference: -117000 });
    expect(rowsOf(first!.covered)).toEqual([9, 10]);
    expect(first!.gap).toEqual({ row: rows[3], how: 'left_out' });
    expect(first!.matchesSubtotals).toBe(false);

    expect(second).toMatchObject({ row: rows[5], stated: 81000, expected: 198000, difference: -117000, base: null });
    expect(rowsOf(second!.covered)).toEqual([7, 9, 10]);
    expect(second!.matchesSubtotals).toBe(true);
    expect(second!.gap).toBeNull();
  });

  it('says when a sub-total seems to count an item twice', () => {
    const { item, total } = sheet();
    const rows = [item('A', 1, 300, 300), item('B', 1, 450, 450), total('Sub-total', 1200)];
    const [mismatch] = checkRows(rows).mismatches;
    expect(mismatch).toMatchObject({ expected: 750, difference: 450, gap: { row: rows[1], how: 'counted_twice' } });
  });

  it('gives no gap item when no single row explains the difference', () => {
    const { item, total } = sheet();
    const [mismatch] = checkRows([item('A', 1, 300, 300), item('B', 1, 450, 450), total('Total', 700)]).mismatches;
    expect(mismatch).toMatchObject({ expected: 750, difference: -50, gap: null, matchesSubtotals: false });
  });

  it('adds up since the previous total when the table has no sections', () => {
    const { item, total } = sheet();
    const check = checkRows([
      item('A', 1, 10, 10),
      item('B', 1, 20, 20),
      total('Sub-total', 30),
      item('C', 1, 5, 5),
      total('Sub-total', 6),
      total('Total', 36),
    ]);
    expect(check.mismatches.map((mismatch) => [mismatch.row.sheetRow, mismatch.expected])).toEqual([
      [11, 5],
      [12, 35],
    ]);
  });

  it('accepts a total of all items even when it skips the sub-totals of other sections', () => {
    const { item, total } = sheet();
    const check = checkRows([
      item('1', 1, 100, 100, 'A'),
      total('Sub-total A', 100, 'A'),
      item('2', 1, 50, 50, 'B'),
      total('Sub-total B', 50, 'B'),
      total('Grand total', 150, null),
    ]);
    expect(check.mismatches).toEqual([]);
  });

  it('starts a new grand total after the previous one', () => {
    const { item, total } = sheet();
    const check = checkRows([
      item('1', 1, 100, 100, 'A'),
      item('2', 1, 200, 200, 'B'),
      total('Sub-total B', 200, 'B'),
      total('Total Bill 1', 300, 'B'),
      item('3', 1, 40, 40, 'C'),
      total('Sub-total C', 40, 'C'),
      item('4', 1, 60, 60, 'D'),
      total('Sub-total D', 60, 'D'),
      total('Total Bill 2', 100, 'D'),
    ]);
    expect(check.mismatches).toEqual([]);
  });

  it('follows carried and brought forward totals across pages', () => {
    const rows = [
      pdfRow(3, { itemCode: 'P1', quantity: 2, rate: 50, amount: 100 }),
      pdfRow(3, { itemCode: 'P2', quantity: 1, rate: 40, amount: 40 }),
      pdfRow(3, { description: 'Carried forward', amount: 140, isTotal: true }),
      pdfRow(4, { description: 'Brought forward', amount: 140, isTotal: true }),
      pdfRow(4, { itemCode: 'P3', quantity: 1, rate: 60, amount: 60 }),
      pdfRow(4, { description: 'Carried forward', amount: 200, isTotal: true }),
      pdfRow(5, { description: 'Brought forward', amount: 200, isTotal: true }),
      pdfRow(5, { itemCode: 'P4', quantity: 1, rate: 25, amount: 25 }),
      pdfRow(5, { description: 'Total', amount: 225, isTotal: true }),
    ];
    expect(checkRows(rows)).toEqual({ checkedRows: 9, mismatches: [] });
  });

  it('compares a wrong total after "Brought forward" with the running total', () => {
    const rows = [
      pdfRow(3, { itemCode: 'P1', quantity: 2, rate: 50, amount: 100 }),
      pdfRow(3, { description: 'Carried forward', amount: 100, isTotal: true }),
      pdfRow(4, { description: 'Brought forward', amount: 100, isTotal: true }),
      pdfRow(4, { itemCode: 'P2', quantity: 1, rate: 60, amount: 60 }),
      pdfRow(4, { description: 'Total', amount: 150, isTotal: true }),
    ];
    const [mismatch] = checkRows(rows).mismatches;
    expect(mismatch).toMatchObject({ stated: 150, expected: 160, difference: -10, base: rows[2] });
    expect(mismatch!.covered).toEqual([rows[3]]);
  });

  it('flags a "Brought forward" that does not repeat the total before it', () => {
    const rows = [
      pdfRow(3, { itemCode: 'P1', quantity: 2, rate: 50, amount: 100 }),
      pdfRow(3, { description: 'Carried forward', amount: 100, isTotal: true }),
      pdfRow(4, { description: 'Brought forward', amount: 1000, isTotal: true }),
    ];
    const [mismatch] = checkRows(rows).mismatches;
    expect(mismatch).toMatchObject({ row: rows[2], expected: 100, difference: 900 });
  });

  it('skips totals with no amount and totals with nothing above them', () => {
    const { item, total } = sheet();
    const check = checkRows([total('Brought forward', 5000), item('A', 1, 10, 10), total('Total', null)]);
    expect(check).toEqual({ checkedRows: 1, mismatches: [] });
  });

  it('allows half a cent per row of rounding in a total', () => {
    const { item, total } = sheet();
    const items = [item('A', 1, 0.1, 0.1), item('B', 1, 0.2, 0.2), item('C', 3, 33.333, 99.999), item('D', 1, 1, 1)];
    expect(checkRows([...items, total('Total', 101.31)]).mismatches).toEqual([]);
    expect(checkRows([...items, total('Total', 101.33)]).mismatches).toHaveLength(1);
    expect(totalTolerance(1)).toBe(0.01);
    expect(totalTolerance(10)).toBe(0.05);
  });
});
