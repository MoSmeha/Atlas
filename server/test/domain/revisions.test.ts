import { describe, expect, it } from 'vitest';
import {
  compareBoqs,
  descriptionSimilarity,
  isItemRow,
  itemCodeKey,
  type RevisionRow,
} from '../../src/domain/revisions';

/** Builds a revision's rows on consecutive sheet rows from 8, as the sample BOQs lay them out. */
function revision(sheet: string | null = 'Substructure', currency: string | null = 'SAR') {
  let next = 8;
  return {
    item: (
      code: string | null,
      description: string,
      quantity: number | null,
      rate: number | null,
      amount: number | null,
      extra: Partial<RevisionRow> = {},
    ): RevisionRow => ({
      itemCode: code,
      description,
      quantity,
      rate,
      amount,
      isTotal: false,
      section: null,
      sheetRow: next++,
      page: null,
      sheet,
      currency,
      ...extra,
    }),
    total: (label: string, amount: number): RevisionRow => ({
      itemCode: null,
      description: label,
      quantity: null,
      rate: null,
      amount,
      isTotal: true,
      section: null,
      sheetRow: next++,
      page: null,
      sheet,
      currency,
    }),
  };
}

const codes = (rows: RevisionRow[]) => rows.map((row) => row.itemCode);

describe('itemCodeKey', () => {
  it('ignores case, surrounding space and the kind of separator', () => {
    expect(itemCodeKey(' 1.1.01 ')).toBe('1.1.01');
    expect(itemCodeKey('1-1-01')).toBe('1.1.01');
    expect(itemCodeKey('1 / 1 _ 01')).toBe('1.1.01');
    expect(itemCodeKey('a.2–3')).toBe('A.2.3');
    expect(itemCodeKey('B\\4')).toBe('B.4');
  });

  it('reads Arabic-Indic digits as ASCII digits', () => {
    expect(itemCodeKey('١.٢.٠٣')).toBe('1.2.03');
    expect(itemCodeKey('۴-۵')).toBe('4.5');
  });

  it('is null for no code or separators only', () => {
    expect(itemCodeKey(null)).toBeNull();
    expect(itemCodeKey('  ')).toBeNull();
    expect(itemCodeKey(' - ')).toBeNull();
  });
});

describe('descriptionSimilarity', () => {
  it('is the token Dice coefficient, ignoring case and punctuation', () => {
    expect(descriptionSimilarity('Formwork to slab soffits', 'formwork to SLAB soffits.')).toBe(1);
    expect(descriptionSimilarity('Formwork to slab soffits', 'Formwork to slab edges')).toBe(0.75);
    expect(descriptionSimilarity('Excavation', 'Blockwork')).toBe(0);
  });

  it('is 0 when either description is missing or empty', () => {
    expect(descriptionSimilarity(null, 'Excavation')).toBe(0);
    expect(descriptionSimilarity('', '')).toBe(0);
  });
});

describe('isItemRow', () => {
  it('keeps rows with a quantity, rate or amount and drops totals, headings and notes', () => {
    const rows = revision();
    expect(isItemRow(rows.item('1.1.01', 'Excavation', 10, 5, 50))).toBe(true);
    expect(isItemRow(rows.item('1.9', 'Rate only item', null, 120, null))).toBe(true);
    expect(isItemRow(rows.item('1.1', 'Earthworks', null, null, null))).toBe(false);
    expect(isItemRow(rows.total('Sub-total 1.1', 50))).toBe(false);
  });
});

describe('compareBoqs', () => {
  it('matches items by normalised code and reports quantity, rate and amount changes with old, new and delta', () => {
    const a = revision();
    const b = revision();
    const diff = compareBoqs(
      [
        a.item('1.1.01', 'Site clearance', 1, 85000, 85000),
        a.item('1.1.02', 'Bulk excavation', 96000, 42, 4032000),
        a.item('1.3.03', 'Reinforcement to the raft', 2400, 3450, 8280000),
      ],
      [
        b.item('1-1-01', 'Site clearance', 1, 85000, 85000),
        b.item(' 1.1.02', 'Bulk excavation', 101500, 42, 4263000),
        b.item('1.3.03', 'Reinforcement to the raft', 2400, 3610, 8664000),
      ],
    );
    expect(diff.added).toEqual([]);
    expect(diff.removed).toEqual([]);
    expect(diff.unchanged).toBe(1);
    expect(diff.matchedByDescription).toBe(0);
    expect(diff.changed.map((item) => ({ code: item.b.itemCode, by: item.matchedBy, fields: item.fields }))).toEqual([
      { code: ' 1.1.02', by: 'code', fields: ['quantity', 'amount'] },
      { code: '1.3.03', by: 'code', fields: ['rate', 'amount'] },
    ]);
    const [excavation, steel] = diff.changed;
    expect(excavation?.quantity).toEqual({ old: 96000, new: 101500, delta: 5500 });
    expect(excavation?.rate).toEqual({ old: 42, new: 42, delta: 0 });
    expect(excavation?.amount).toEqual({ old: 4032000, new: 4263000, delta: 231000 });
    expect(steel?.rate).toEqual({ old: 3450, new: 3610, delta: 160 });
    expect(diff.totalDeltaByCurrency).toEqual({ SAR: 615000 });
  });

  it('reports items only in B as added and items only in A as removed, in document order', () => {
    const a = revision('MEP');
    const b = revision('MEP');
    const diff = compareBoqs(
      [
        a.item('3.4.01', 'Testing and commissioning', 1, 950000, 950000),
        a.item('3.4.02', 'Independent commissioning agent', 1, 380000, 380000),
      ],
      [
        b.item('3.2.07', 'Electric vehicle charging points, 22 kW', 40, 14500, 580000),
        b.item('3.4.01', 'Testing and commissioning', 1, 950000, 950000),
        b.item('3.9.01', 'Rate only: extra sprinkler heads', null, 450, null),
      ],
    );
    expect(codes(diff.added)).toEqual(['3.2.07', '3.9.01']);
    expect(codes(diff.removed)).toEqual(['3.4.02']);
    expect(diff.changed).toEqual([]);
    expect(diff.unchanged).toBe(1);
    expect(diff.itemsA).toBe(2);
    expect(diff.itemsB).toBe(3);
    expect(diff.totalsA).toEqual({ SAR: 1330000 });
    expect(diff.totalsB).toEqual({ SAR: 1530000 });
    expect(diff.totalDeltaByCurrency).toEqual({ SAR: 200000 });
  });

  it('falls back to a near-identical description when codes are missing or different', () => {
    const a = revision();
    const b = revision();
    const diff = compareBoqs(
      [
        a.item(null, 'Termite treatment to the underside of the raft', 900, 12, 10800),
        a.item('1.2.06', 'Pile load tests, static, to 2.5 times working load', 3, 39000, 117000),
        a.item('1.5.01', 'Dewatering during basement construction', 1, 500000, 500000),
      ],
      [
        b.item('1.4.01', 'Termite treatment to the underside of the raft', 900, 12.5, 11250),
        b.item('1.2.07', 'Pile load tests, static, to 2.5 times the working load', 3, 39000, 117000),
        b.item('1.5.02', 'Dewatering and groundwater control', 1, 500000, 500000),
      ],
    );
    expect(diff.matchedByDescription).toBe(2);
    expect(diff.unchanged).toBe(1);
    expect(diff.changed).toHaveLength(1);
    expect(diff.changed[0]).toMatchObject({ matchedBy: 'description', fields: ['rate', 'amount'] });
    expect(diff.changed[0]?.a.itemCode).toBeNull();
    expect(diff.changed[0]?.b.itemCode).toBe('1.4.01');
    expect(codes(diff.removed)).toEqual(['1.5.01']);
    expect(codes(diff.added)).toEqual(['1.5.02']);
  });

  it('pairs descriptions one to one, best match first', () => {
    const a = revision();
    const b = revision();
    const diff = compareBoqs(
      [
        a.item('A', 'Blockwork 200 mm hollow concrete to external walls', 100, 90, 9000),
        a.item('B', 'Blockwork 200 mm hollow concrete to external walls and parapets', 50, 95, 4750),
      ],
      [b.item('C', 'Blockwork 200 mm hollow concrete to external walls and parapets', 60, 95, 5700)],
    );
    expect(diff.changed.map((item) => [item.a.itemCode, item.b.itemCode])).toEqual([['B', 'C']]);
    expect(codes(diff.removed)).toEqual(['A']);
    expect(diff.added).toEqual([]);
  });

  it('leaves totals, sub-totals and headings out of the matching and the totals', () => {
    const a = revision();
    const b = revision();
    const diff = compareBoqs(
      [a.item('1.1', 'Earthworks', null, null, null), a.item('1.1.01', 'Excavation', 10, 5, 50), a.total('Sub-total 1.1', 50)],
      [b.item('1.1.01', 'Excavation', 10, 5, 50), b.total('Sub-total 1.1 Earthworks', 99), b.total('Total carried to summary', 99)],
    );
    expect(diff).toMatchObject({ added: [], removed: [], changed: [], unchanged: 1, itemsA: 1, itemsB: 1 });
    expect(diff.totalDeltaByCurrency).toEqual({ SAR: 0 });
  });

  it('matches items only within the same sheet when both revisions have it', () => {
    const subA = revision('Substructure');
    const supA = revision('Superstructure');
    const subB = revision('Substructure');
    const supB = revision('Superstructure');
    const diff = compareBoqs(
      [subA.item('A1', 'Excavation', 10, 5, 50), supA.item('A1', 'Concrete columns', 4, 1000, 4000)],
      [supB.item('A1', 'Concrete columns', 4, 1100, 4400), subB.item('A1', 'Excavation', 10, 5, 50)],
    );
    expect(diff.unchanged).toBe(1);
    expect(diff.changed).toHaveLength(1);
    expect(diff.changed[0]?.a.sheet).toBe('Superstructure');
    expect(diff.changed[0]?.b.sheet).toBe('Superstructure');
    expect(diff.changed[0]?.amount.delta).toBe(400);
  });

  it('does not match an item moved to another sheet both revisions have', () => {
    const subA = revision('Substructure');
    const supA = revision('Superstructure');
    const subB = revision('Substructure');
    const supB = revision('Superstructure');
    const diff = compareBoqs(
      [subA.item('1.1', 'Excavation', 10, 5, 50), subA.item('1.9', 'Waterproofing', 2, 3, 6), supA.item('2.1', 'Columns', 1, 1, 1)],
      [subB.item('1.1', 'Excavation', 10, 5, 50), supB.item('2.1', 'Columns', 1, 1, 1), supB.item('1.9', 'Waterproofing', 2, 3, 6)],
    );
    expect(diff.unchanged).toBe(2);
    expect(diff.removed.map((row) => [row.itemCode, row.sheet])).toEqual([['1.9', 'Substructure']]);
    expect(diff.added.map((row) => [row.itemCode, row.sheet])).toEqual([['1.9', 'Superstructure']]);
  });

  it('matches across sheets one revision lacks, and with PDF rows that have no sheet', () => {
    const pdf = revision(null);
    const sheet = revision('BOQ Rev 1');
    const diff = compareBoqs(
      [pdf.item('A1', 'Excavation', 10, 5, 50, { sheetRow: null, page: 3 })],
      [sheet.item('a1', 'Excavation', 12, 5, 60)],
    );
    expect(diff.changed.map((item) => item.fields)).toEqual([['quantity', 'amount']]);
  });

  it('settles a repeated code by section, then by description', () => {
    const a = revision(null);
    const b = revision(null);
    const diff = compareBoqs(
      [
        a.item('A', 'Excavation', 10, 5, 50, { section: 'Bill 1' }),
        a.item('A', 'Concrete blinding', 2, 300, 600, { section: 'Bill 2' }),
      ],
      [
        b.item('A', 'Concrete blinding', 2, 320, 640, { section: 'Bill 2' }),
        b.item('A', 'Excavation', 10, 5, 50, { section: 'Bill 1' }),
      ],
    );
    expect(diff.unchanged).toBe(1);
    expect(diff.changed.map((item) => [item.a.description, item.b.description])).toEqual([['Concrete blinding', 'Concrete blinding']]);
  });

  it('sums the total delta per currency and never across currencies', () => {
    const a = revision('Imported', null);
    const b = revision('Imported', null);
    const diff = compareBoqs(
      [
        a.item('1', 'Chillers', 2, 100000, 200000, { currency: 'USD' }),
        a.item('2', 'Local works', 1, 50000, 50000, { currency: 'SR' }),
        a.item('3', 'Spare parts', 1, 9000, 9000, { currency: 'EUR' }),
      ],
      [
        b.item('1', 'Chillers', 2, 110000, 220000, { currency: 'US$' }),
        b.item('2', 'Local works', 1, 52000, 52000, { currency: 'SAR' }),
        b.item('4', 'Training', 1, 1000, 1000, { currency: null }),
      ],
    );
    expect(diff.totalDeltaByCurrency).toEqual({ USD: 20000, SAR: 2000, EUR: -9000, UNSPECIFIED: 1000 });
    expect(diff.totalsA).toEqual({ USD: 200000, SAR: 50000, EUR: 9000 });
    expect(diff.changed.map((item) => item.fields)).toEqual([
      ['rate', 'amount'],
      ['rate', 'amount'],
    ]);
  });

  it('marks a change of currency and gives no rate or amount delta across it', () => {
    const a = revision('Imported', 'SAR');
    const b = revision('Imported', 'USD');
    const diff = compareBoqs([a.item('1', 'Chillers', 2, 375000, 750000)], [b.item('1', 'Chillers', 3, 100000, 300000)]);
    expect(diff.changed[0]).toMatchObject({
      fields: ['quantity', 'rate', 'amount', 'currency'],
      quantity: { old: 2, new: 3, delta: 1 },
      rate: { old: 375000, new: 100000, delta: null },
      amount: { old: 750000, new: 300000, delta: null },
    });
    expect(diff.totalDeltaByCurrency).toEqual({ SAR: -750000, USD: 300000 });
  });

  it('treats a value missing on one side as a change with no delta, and float noise as no change', () => {
    const a = revision();
    const b = revision();
    const diff = compareBoqs(
      [a.item('1', 'Fill', 1850, 46.5, 86025), a.item('2', 'Provisional sum', null, null, 250000)],
      [b.item('1', 'Fill', 1850, 46.5, 86024.99999999999), b.item('2', 'Provisional sum', 1, null, 250000)],
    );
    expect(diff.unchanged).toBe(1);
    expect(diff.changed[0]).toMatchObject({ fields: ['quantity'], quantity: { old: null, new: 1, delta: null } });
  });

  it('gives exact decimal deltas', () => {
    const a = revision();
    const b = revision();
    const diff = compareBoqs([a.item('1', 'Paint', 0.1, 10, 1)], [b.item('1', 'Paint', 0.3, 10, 3)]);
    expect(diff.changed[0]?.quantity.delta).toBe(0.2);
  });

  it('reports everything as added or removed when one side has no items', () => {
    const b = revision();
    const diff = compareBoqs([], [b.item('1', 'Fill', 1, 2, 2)]);
    expect(codes(diff.added)).toEqual(['1']);
    expect(diff.totalsA).toEqual({});
    expect(diff.totalDeltaByCurrency).toEqual({ SAR: 2 });
  });
});
