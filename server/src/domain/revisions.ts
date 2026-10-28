import type { BoqRow } from './boqArithmetic';
import { currencyKey, sumByCurrency } from './currency';
import { sumExact } from './decimal';
import { foldArabic } from './language';

/** How alike two descriptions must be (token Dice coefficient) for items whose codes do not match to pair up. */
export const DESCRIPTION_MATCH = 0.8;

/** A BOQ row of one revision, with its sheet and the currency of its amount. */
export interface RevisionRow extends BoqRow {
  /** Items match only within a sheet of the same name when both revisions have one. */
  sheet: string | null;
  currency: string | null;
}

export interface ValueChange {
  old: number | null;
  new: number | null;
  /** New minus old; null when either is missing, and for rate and amount when the currency changed. */
  delta: number | null;
}

export type ChangedField = 'quantity' | 'rate' | 'amount' | 'currency';

export interface ChangedItem {
  a: RevisionRow;
  b: RevisionRow;
  /** description: the codes were missing or different and the descriptions are near-identical. */
  matchedBy: 'code' | 'description';
  /** What differs, in this order: quantity, rate, amount, currency. */
  fields: ChangedField[];
  quantity: ValueChange;
  rate: ValueChange;
  amount: ValueChange;
}

export interface RevisionDiff {
  /** Items only in B, in B order. */
  added: RevisionRow[];
  /** Items only in A, in A order. */
  removed: RevisionRow[];
  /** Matched items whose quantity, rate, amount or currency differs, in B order. */
  changed: ChangedItem[];
  unchanged: number;
  /** Matched pairs, changed or not, that paired up by description. */
  matchedByDescription: number;
  /** Item rows compared in each revision; totals, headings and notes are left out. */
  itemsA: number;
  itemsB: number;
  /** Sums of item amounts per currency in each revision. */
  totalsA: Record<string, number>;
  totalsB: Record<string, number>;
  /** Item amounts of B minus those of A, per currency; currencies are never added together. */
  totalDeltaByCurrency: Record<string, number>;
}

interface Entry {
  row: RevisionRow;
  /** Position among its revision's item rows. */
  index: number;
  code: string | null;
  tokens: Set<string>;
}

interface Candidate {
  a: Entry;
  b: Entry;
  score: number;
  sameSection: boolean;
}

interface Pair {
  a: Entry;
  b: Entry;
  matchedBy: ChangedItem['matchedBy'];
}

const SEPARATORS = /[\s._\-‐-―/\\]+/g;
const WORD = /[\p{L}\p{N}]+/gu;
const ARABIC_DIGIT = /[٠-٩۰-۹]/g;

/** A priced item: not a total, and with a quantity, rate or amount. Headings and notes have none. */
export function isItemRow(row: BoqRow): boolean {
  return !row.isTotal && (row.quantity !== null || row.rate !== null || row.amount !== null);
}

/** An item code for matching: upper case, Arabic digits as ASCII, every run of separators as one dot, so "1-1-01 " is "1.1.01". */
export function itemCodeKey(code: string | null): string | null {
  if (code === null) return null;
  const key = asciiDigits(code).toUpperCase().replace(SEPARATORS, '.').replace(/^\.+|\.+$/g, '');
  return key === '' ? null : key;
}

/** Token Dice coefficient of two descriptions: 1 for the same words, 0 when none are shared or one is empty. */
export function descriptionSimilarity(a: string | null, b: string | null): number {
  return dice(tokensOf(a), tokensOf(b));
}

/**
 * Compares two revisions of a BOQ, rows in document order. Item rows pair up by normalised item code, then
 * the rest by description (Dice >= 0.8, best pairs first, one-to-one). When both revisions have a sheet of
 * the same name, its items pair only with items of that sheet. Totals are left out.
 */
export function compareBoqs(rowsA: readonly RevisionRow[], rowsB: readonly RevisionRow[]): RevisionDiff {
  const itemsA = rowsA.filter(isItemRow);
  const itemsB = rowsB.filter(isItemRow);
  const pairs = buckets(itemsA, itemsB).flatMap(([a, b]) => matchBucket(a, b));
  const pairedA = new Set(pairs.map((pair) => pair.a.row));
  const pairedB = new Set(pairs.map((pair) => pair.b.row));

  const changed: ChangedItem[] = [];
  for (const pair of pairs.toSorted((x, y) => x.b.index - y.b.index)) {
    const item = compareItems(pair);
    if (item) changed.push(item);
  }
  const amounts = (rows: RevisionRow[], sign: 1 | -1) =>
    rows.flatMap((row) => (row.amount === null ? [] : [{ amount: sign * row.amount, currency: row.currency }]));
  return {
    added: itemsB.filter((row) => !pairedB.has(row)),
    removed: itemsA.filter((row) => !pairedA.has(row)),
    changed,
    unchanged: pairs.length - changed.length,
    matchedByDescription: pairs.filter((pair) => pair.matchedBy === 'description').length,
    itemsA: itemsA.length,
    itemsB: itemsB.length,
    totalsA: sumByCurrency(amounts(itemsA, 1)),
    totalsB: sumByCurrency(amounts(itemsB, 1)),
    totalDeltaByCurrency: sumByCurrency([...amounts(itemsA, -1), ...amounts(itemsB, 1)]),
  };
}

/** Groups items by sheet when both revisions have that sheet; all other items share one group. */
function buckets(itemsA: RevisionRow[], itemsB: RevisionRow[]): [Entry[], Entry[]][] {
  const sheetsA = new Set(itemsA.map((row) => sheetKey(row.sheet)));
  const sheetsB = new Set(itemsB.map((row) => sheetKey(row.sheet)));
  const groups = new Map<string | null, [Entry[], Entry[]]>();
  const add = (rows: RevisionRow[], side: 0 | 1) =>
    rows.forEach((row, index) => {
      const sheet = sheetKey(row.sheet);
      const key = sheet !== null && sheetsA.has(sheet) && sheetsB.has(sheet) ? sheet : null;
      const group = groups.get(key) ?? [[], []];
      groups.set(key, group);
      group[side].push({ row, index, code: itemCodeKey(row.itemCode), tokens: tokensOf(row.description) });
    });
  add(itemsA, 0);
  add(itemsB, 1);
  return [...groups.values()];
}

/** Pairs by code first (the same section, then the closer description, wins a repeated code), then by description. */
function matchBucket(as: Entry[], bs: Entry[]): Pair[] {
  const byCode = new Map<string, Entry[]>();
  for (const b of bs) if (b.code !== null) byCode.set(b.code, [...(byCode.get(b.code) ?? []), b]);
  const codeCandidates = as.flatMap((a) =>
    (a.code === null ? [] : (byCode.get(a.code) ?? [])).map((b) => {
      const sameSection = sectionKey(a.row) === sectionKey(b.row);
      return { a, b, sameSection, score: (sameSection ? 2 : 0) + dice(a.tokens, b.tokens) };
    }),
  );
  const pairs = greedy(codeCandidates, 'code');
  const pairedA = new Set(pairs.map((pair) => pair.a));
  const pairedB = new Set(pairs.map((pair) => pair.b));
  const restB = bs.filter((b) => !pairedB.has(b));
  const descriptionCandidates: Candidate[] = [];
  for (const a of as) {
    if (pairedA.has(a)) continue;
    for (const b of restB) {
      if (!couldMatch(a.tokens, b.tokens)) continue;
      const score = dice(a.tokens, b.tokens);
      if (score >= DESCRIPTION_MATCH) descriptionCandidates.push({ a, b, score, sameSection: sectionKey(a.row) === sectionKey(b.row) });
    }
  }
  return [...pairs, ...greedy(descriptionCandidates, 'description')];
}

/** One-to-one pairs, best score first; ties go to the same section, then the nearer position. */
function greedy(candidates: Candidate[], matchedBy: Pair['matchedBy']): Pair[] {
  const order = (x: Candidate, y: Candidate) =>
    y.score - x.score ||
    Number(y.sameSection) - Number(x.sameSection) ||
    Math.abs(x.a.index - x.b.index) - Math.abs(y.a.index - y.b.index) ||
    x.a.index - y.a.index ||
    x.b.index - y.b.index;
  const usedA = new Set<Entry>();
  const usedB = new Set<Entry>();
  const pairs: Pair[] = [];
  for (const { a, b } of candidates.toSorted(order)) {
    if (usedA.has(a) || usedB.has(b)) continue;
    usedA.add(a);
    usedB.add(b);
    pairs.push({ a, b, matchedBy });
  }
  return pairs;
}

function compareItems({ a: { row: a }, b: { row: b }, matchedBy }: Pair): ChangedItem | null {
  const currencyChanged = a.currency !== null && b.currency !== null && currencyKey(a.currency) !== currencyKey(b.currency);
  const quantity = valueChange(a.quantity, b.quantity, false);
  const rate = valueChange(a.rate, b.rate, currencyChanged);
  const amount = valueChange(a.amount, b.amount, currencyChanged);
  const fields: ChangedField[] = [];
  if (differs(quantity)) fields.push('quantity');
  if (differs(rate)) fields.push('rate');
  if (differs(amount)) fields.push('amount');
  if (currencyChanged) fields.push('currency');
  return fields.length === 0 ? null : { a, b, matchedBy, fields, quantity, rate, amount };
}

function valueChange(old: number | null, next: number | null, currencyChanged: boolean): ValueChange {
  const delta = old === null || next === null || currencyChanged ? null : sumExact([next, -old]);
  return { old, new: next, delta };
}

/** Missing on one side only, or apart by more than floating-point noise. */
function differs({ old, new: next }: ValueChange): boolean {
  if (old === null || next === null) return old !== next;
  return Math.abs(next - old) > 1e-9 * Math.max(1, Math.abs(old), Math.abs(next));
}

/** The best Dice two token sets could reach, from their sizes alone. */
function couldMatch(a: Set<string>, b: Set<string>): boolean {
  return (2 * Math.min(a.size, b.size)) / (a.size + b.size) >= DESCRIPTION_MATCH;
}

function dice(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let shared = 0;
  for (const token of a) if (b.has(token)) shared++;
  return (2 * shared) / (a.size + b.size);
}

function tokensOf(text: string | null): Set<string> {
  return new Set(text === null ? [] : (foldArabic(asciiDigits(text).toLowerCase()).match(WORD) ?? []));
}

function sheetKey(sheet: string | null): string | null {
  const key = sheet?.trim().toLowerCase() ?? '';
  return key === '' ? null : key;
}

function sectionKey(row: BoqRow): string {
  return row.section?.trim().toLowerCase() ?? '';
}

function asciiDigits(text: string): string {
  return text.replace(ARABIC_DIGIT, (digit) => {
    const code = digit.charCodeAt(0);
    return String(code - (code >= 0x06f0 ? 0x06f0 : 0x0660));
  });
}
