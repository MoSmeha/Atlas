import type { BoqLayout, ItemLine } from './boqLayout';
import { sumAmounts } from './money';

export interface ItemState {
  sheet: string;
  row: number;
  quantity: number;
  rate: number;
  amount: number;
}

export interface ListedItem extends ItemState {
  item: string;
  description: string;
}

export interface ChangedItem {
  item: string;
  description: string;
  changed: ('quantity' | 'rate' | 'amount')[];
  from: ItemState;
  to: ItemState;
  amountDelta: number;
}

export interface RevisionDiff {
  from: string;
  to: string;
  added: ListedItem[];
  removed: ListedItem[];
  changed: ChangedItem[];
  /** Item-row totals per currency in each file, amounts as written. */
  totalDelta: { currency: string; from: number; to: number; delta: number }[];
}

/** Compares two revisions item by item (matched on item code), the way a quantity surveyor would. */
export function diffRevisions(before: BoqLayout, after: BoqLayout): RevisionDiff {
  const oldItems = itemsByCode(before);
  const newItems = itemsByCode(after);
  const changed: ChangedItem[] = [];
  for (const [code, next] of newItems) {
    const previous = oldItems.get(code);
    if (!previous) continue;
    const fields = (['quantity', 'rate', 'amount'] as const).filter((field) => valueOf(previous, field) !== valueOf(next, field));
    if (fields.length === 0) continue;
    changed.push({
      item: code,
      description: next.item.description,
      changed: fields,
      from: state(previous),
      to: state(next),
      amountDelta: sumAmounts([next.amount, -previous.amount]),
    });
  }
  const from = totalOf(before);
  const to = totalOf(after);
  return {
    from: before.revision.fileName,
    to: after.revision.fileName,
    added: [...newItems].filter(([code]) => !oldItems.has(code)).map(([, line]) => listed(line)),
    removed: [...oldItems].filter(([code]) => !newItems.has(code)).map(([, line]) => listed(line)),
    changed,
    totalDelta: [{ currency: after.revision.currency, from, to, delta: sumAmounts([to, -from]) }],
  };
}

interface PlacedItem extends ItemLine {
  sheet: string;
}

function itemsByCode(layout: BoqLayout): Map<string, PlacedItem> {
  return new Map(
    layout.bills.flatMap((bill) => bill.items.map((line) => [line.item.code, { ...line, sheet: bill.bill.sheet }] as const)),
  );
}

function valueOf(line: PlacedItem, field: 'quantity' | 'rate' | 'amount'): number {
  return field === 'amount' ? line.amount : line.item[field];
}

function state(line: PlacedItem): ItemState {
  return { sheet: line.sheet, row: line.row, quantity: line.item.quantity, rate: line.item.rate, amount: line.amount };
}

function listed(line: PlacedItem): ListedItem {
  return { item: line.item.code, description: line.item.description, ...state(line) };
}

function totalOf(layout: BoqLayout): number {
  return sumAmounts(layout.bills.flatMap((bill) => bill.items.map((line) => line.amount)));
}
