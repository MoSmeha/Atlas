import { sumExact } from './decimal';

/** One row of a bill of quantities, as the arithmetic check reads it. */
export interface BoqRow {
  itemCode: string | null;
  description: string | null;
  quantity: number | null;
  rate: number | null;
  amount: number | null;
  /** A "Total", "Sub-total" or "Carried forward" row. */
  isTotal: boolean;
  section: string | null;
  /** Excel row number; null for PDF tables. */
  sheetRow: number | null;
  /** PDF page; null for sheets. */
  page: number | null;
}

export interface BoqMismatch {
  /** item: quantity x rate is not the amount. total: a total is not the sum of the rows it closes. */
  kind: 'item' | 'total';
  row: BoqRow;
  stated: number;
  expected: number;
  /** Stated minus expected. */
  difference: number;
  /** For a running total, the earlier total it carries on from, such as a "Brought forward" row. */
  base: BoqRow | null;
  /** For a total, the item rows its expected value adds up; empty for an item row. */
  covered: BoqRow[];
  /** A covered item whose amount is exactly the gap, so the total seems to leave it out or count it twice. */
  gap: { row: BoqRow; how: 'left_out' | 'counted_twice' } | null;
  /** A grand total that adds up the sub-totals above it correctly, so its gap comes from a wrong sub-total. */
  matchesSubtotals: boolean;
}

export interface BoqCheck {
  /** Item rows with a quantity, rate and amount, and total rows with an amount and rows to add up. */
  checkedRows: number;
  mismatches: BoqMismatch[];
}

/** How far quantity x rate may be from the amount: a cent, or 0.05% for rates rounded in the document. */
export function itemTolerance(amount: number): number {
  return Math.max(0.01, 0.0005 * Math.abs(amount));
}

/** How far a total may be from its rows: a cent, or half a cent per row for amounts rounded to the cent. */
export function totalTolerance(rowCount: number): number {
  return Math.max(0.01, 0.005 * rowCount);
}

interface Item {
  index: number;
  row: BoqRow;
  amount: number;
}

interface SeenTotal {
  index: number;
  row: BoqRow;
  amount: number;
  /** A "Brought forward" row: it follows another total and repeats it. */
  carried: boolean;
  /** It has item rows right above it, as a sub-total has. */
  closesItems: boolean;
}

/** A way a total can add up: an optional earlier total plus some item rows. */
interface Reading {
  base: SeenTotal | null;
  items: Item[];
}

/** What the walk over one table has seen so far. */
interface Walk {
  items: Item[];
  totals: SeenTotal[];
  /** First row index a grand total adds up from: the table start, or the row after the last grand total. */
  grandStart: number;
}

/**
 * Checks the arithmetic of one BOQ table, rows in document order.
 * Item rows: quantity x rate against the amount, when the row has all three.
 * Total rows: the amount against the item rows it closes, which by default are the items of its section
 * since the previous total of that section (or the table start). A total that follows other totals is a
 * grand total of the items since the last grand total. Running totals ("Brought forward" plus the items
 * after it) and section totals over several page totals also count as adding up.
 */
export function checkRows(rows: readonly BoqRow[]): BoqCheck {
  const mismatches: BoqMismatch[] = [];
  const walk: Walk = { items: [], totals: [], grandStart: 0 };
  let checkedRows = 0;

  rows.forEach((row, index) => {
    if (row.amount === null) return;
    if (!row.isTotal) {
      walk.items.push({ index, row, amount: row.amount });
      if (row.quantity === null || row.rate === null) return;
      checkedRows++;
      const mismatch = checkItem(row, row.quantity, row.rate, row.amount);
      if (mismatch) mismatches.push(mismatch);
      return;
    }
    const outcome = checkTotal(walk, { index, row, amount: row.amount, carried: false, closesItems: false });
    if (outcome !== 'skipped') checkedRows++;
    if (outcome !== 'skipped' && outcome !== 'ok') mismatches.push(outcome);
  });
  return { checkedRows, mismatches };
}

function checkItem(row: BoqRow, quantity: number, rate: number, amount: number): BoqMismatch | null {
  const expected = Number((quantity * rate).toPrecision(15));
  const difference = sumExact([amount, -expected]);
  if (Math.abs(difference) <= itemTolerance(amount)) return null;
  return { kind: 'item', row, stated: amount, expected, difference, base: null, covered: [], gap: null, matchesSubtotals: false };
}

/** Checks one total row and records it in the walk; 'skipped' when there is nothing above it to add up. */
function checkTotal(walk: Walk, total: SeenTotal): BoqMismatch | 'ok' | 'skipped' {
  const { row, index } = total;
  const previous = walk.totals.at(-1) ?? null;
  const previousInSection = walk.totals.findLast((seen) => seen.row.section === row.section) ?? null;
  const after = (start: number) => walk.items.filter((item) => item.index > start);
  const inSection = (item: Item) => item.row.section === row.section;

  const sectionItems = after(previousInSection?.index ?? -1).filter(inSection);
  const sincePrevious = after(previous?.index ?? -1);
  const sinceGrand = after(walk.grandStart - 1);
  const running: Reading | null =
    previous !== null && previous.row.section === row.section ? { base: previous, items: sincePrevious } : null;
  const readings: Reading[] = [sectionItems, sincePrevious, sinceGrand.filter(inSection), sinceGrand]
    .filter((list) => list.length > 0)
    .map((list) => ({ base: null, items: list }));
  if (running) readings.push(running);

  const followsTotal = sincePrevious.length === 0;
  const runs = running !== null && adds(total, running);
  const subtotals = walk.totals.filter((seen) => seen.index >= walk.grandStart && seen.closesItems);
  total.carried = followsTotal && runs;
  total.closesItems = !followsTotal;
  walk.totals.push(total);
  if (followsTotal && !runs) walk.grandStart = index + 1;
  if (readings.length === 0) return 'skipped';
  if (readings.some((reading) => adds(total, reading))) return 'ok';

  const reading = primaryReading(previousInSection, running, [sectionItems, sincePrevious, sinceGrand]);
  const expected = expectedOf(reading);
  const difference = sumExact([total.amount, -expected]);
  const matchesSubtotals = followsTotal && subtotals.length > 0 && adds(total, { base: null, items: subtotals });
  return {
    kind: 'total',
    row,
    stated: total.amount,
    expected,
    difference,
    base: reading.base?.row ?? null,
    covered: reading.items.map((item) => item.row),
    gap: matchesSubtotals ? null : gapItem(reading, difference),
    matchesSubtotals,
  };
}

/** The last covered item whose amount is the size of the gap. */
function gapItem(reading: Reading, difference: number): BoqMismatch['gap'] {
  const size = Math.abs(difference);
  const tolerance = totalTolerance(reading.items.length);
  const item = reading.items.findLast((candidate) => Math.abs(Math.abs(candidate.amount) - size) <= tolerance);
  return item ? { row: item.row, how: difference < 0 ? 'left_out' : 'counted_twice' } : null;
}

/**
 * The reading a wrong total is compared with: a running total after a "Brought forward" row, otherwise the
 * first non-empty of its section's items, the items since the previous total, and the items since the last grand total.
 */
function primaryReading(previousInSection: SeenTotal | null, running: Reading | null, lists: Item[][]): Reading {
  if (running && previousInSection?.carried) return running;
  const items = lists.find((list) => list.length > 0);
  return items ? { base: null, items } : (running as Reading);
}

function adds(total: SeenTotal, reading: Reading): boolean {
  return Math.abs(sumExact([total.amount, -expectedOf(reading)])) <= totalTolerance(reading.items.length + (reading.base ? 1 : 0));
}

function expectedOf(reading: Reading): number {
  return sumExact([...(reading.base ? [reading.base.amount] : []), ...reading.items.map((item) => item.amount)]);
}
