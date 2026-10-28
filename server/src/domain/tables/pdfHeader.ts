import { currencyCode } from '../currency';
import type { PositionedWord } from '../document';
import type { ColumnRole } from '../table';
import { cellNumber } from './cellText';
import { columnRole } from './columnRoles';
import { type PageLine, type WordRun, wordRuns, wordText } from './pdfLines';

/** A table column as its header places it on the page. */
export interface PdfColumn {
  label: string;
  role: ColumnRole | null;
  /** Horizontal extent of the header label in points. */
  x0: number;
  x1: number;
}

/** A header found on a page: its columns and the lines it takes up. */
export interface PdfHeader {
  /** Columns from left to right. */
  columns: PdfColumn[];
  /** Index of the header's first and last line in the page's lines. */
  first: number;
  last: number;
}

interface Label {
  words: PositionedWord[];
  role: ColumnRole | null;
}

const MIN_ROLES = 3;
/** Share of a header's words that must be in labels naming a role, so a sentence about rates is not a header. */
const MIN_ROLE_WORDS = 0.6;
/** A quick first check: share of words that name a role on their own ("Description of Works" has one in three). */
const MIN_SINGLE_ROLE_WORDS = 0.4;
const MAX_HEADER_WORDS = 30;
/** Longest label in words, as in "Total Amount (SAR)". */
const MAX_LABEL_WORDS = 5;
/** A header's second line ("(SAR)" under "Rate") sits closer than this share of the line height. */
const TIGHT_GAP = 0.6;
const MAX_HEADER_LINES = 3;
/** How far a repeated header's columns may sit from the first one's, in points. */
const SAME_PLACE = 10;
const NOTE = /^\(.*\)$/;

const roleCache = new Map<string, ColumnRole | null>();

/** columnRole, remembered: the same few words are looked up on every page. */
function roleOf(text: string): ColumnRole | null {
  const known = roleCache.get(text);
  if (known !== undefined) return known;
  const role = columnRole(text);
  if (roleCache.size >= 10_000) roleCache.clear();
  roleCache.set(text, role);
  return role;
}

/**
 * The table header at lines[index]: a line whose labels name at least three column roles (Item, Description, Unit,
 * Qty, Rate, Amount and their synonyms) and that is mostly those labels. Up to two tight lines below join it when they
 * complete its labels, as "(SAR)" under "Rate" or "No." under "Item". Null when the line is not a header.
 */
export function readHeader(lines: readonly PageLine[], index: number): PdfHeader | null {
  const line = lines[index];
  if (line === undefined) return null;
  let columns = headerColumns(line);
  if (columns === null) return null;
  let last = index;
  for (let next = index + 1; next < index + MAX_HEADER_LINES; next++) {
    const above = lines[next - 1];
    const below = lines[next];
    if (above === undefined || below === undefined || below.top - above.bottom > TIGHT_GAP * below.height) break;
    const joined = continueLabels(columns, below);
    if (joined === null) break;
    columns = joined;
    last = next;
  }
  return { columns, first: index, last };
}

/** Whether two headers have the same labels in about the same places, as when a header repeats on each page. */
export function sameColumns(a: readonly PdfColumn[], b: readonly PdfColumn[]): boolean {
  return (
    a.length === b.length &&
    a.every((column, i) => {
      const other = b[i];
      return (
        other !== undefined &&
        column.label.toLowerCase() === other.label.toLowerCase() &&
        Math.abs(centre(column) - centre(other)) <= SAME_PLACE
      );
    })
  );
}

function headerColumns(line: PageLine): PdfColumn[] | null {
  if (line.words.length > MAX_HEADER_WORDS) return null;
  const roleWords = line.words.filter((word) => roleOf(word.text) !== null).length;
  if (roleWords < MIN_ROLES || roleWords < MIN_SINGLE_ROLE_WORDS * line.words.length) return null;
  const labels = wordRuns(line).flatMap(splitLabels);
  if (labels.some((label) => cellNumber(wordText(label.words)) !== null)) return null;
  const named = labels.filter((label) => label.role !== null);
  if (new Set(named.map((label) => label.role)).size < MIN_ROLES) return null;
  const labelWords = named.reduce((count, label) => count + label.words.length, 0);
  if (labelWords < MIN_ROLE_WORDS * line.words.length) return null;
  return withUniqueRoles(attachNotes(labels).map(toColumn));
}

/** A run is one label when it names a role as a whole; otherwise the longest role labels are taken from its words in turn. */
function splitLabels(run: WordRun): Label[] {
  const whole = roleOf(wordText(run.words));
  if (whole !== null) return [{ words: run.words, role: whole }];
  const labels: Label[] = [];
  let loose: PositionedWord[] = [];
  for (let start = 0; start < run.words.length; ) {
    const match = longestLabel(run.words, start);
    if (match === null) {
      loose.push(...run.words.slice(start, start + 1));
      start++;
      continue;
    }
    if (loose.length > 0) labels.push({ words: loose, role: null });
    loose = [];
    labels.push(match);
    start += match.words.length;
  }
  if (loose.length > 0) labels.push({ words: loose, role: null });
  return labels;
}

function longestLabel(words: readonly PositionedWord[], start: number): Label | null {
  for (let end = Math.min(words.length, start + MAX_LABEL_WORDS); end > start; end--) {
    const slice = words.slice(start, end);
    const role = roleOf(wordText(slice));
    if (role !== null) return { words: slice, role };
  }
  return null;
}

/** A label that only names a currency or a note in brackets ("SAR", "(m3)") belongs to the label on its left. */
function attachNotes(labels: readonly Label[]): Label[] {
  const joined: Label[] = [];
  for (const label of labels) {
    const previous = joined.at(-1);
    if (previous !== undefined && label.role === null && isNote(wordText(label.words))) {
      previous.words = [...previous.words, ...label.words];
    } else {
      joined.push({ ...label });
    }
  }
  return joined;
}

function isNote(text: string): boolean {
  return currencyCode(text) !== null || NOTE.test(text);
}

function toColumn(label: Label): PdfColumn {
  return {
    label: wordText(label.words),
    role: label.role,
    x0: Math.min(...label.words.map((word) => word.x0)),
    x1: Math.max(...label.words.map((word) => word.x1)),
  };
}

/** Each role goes to the first column that names it. */
function withUniqueRoles(columns: readonly PdfColumn[]): PdfColumn[] {
  const used = new Set<ColumnRole>();
  return columns.map((column) => {
    if (column.role === null || used.has(column.role)) return { ...column, role: null };
    used.add(column.role);
    return column;
  });
}

/**
 * The labels with a second header line joined in: each of its runs sits under a column and is a currency or a note in
 * brackets ("Rate (SAR)"), or completes the label to one that names a role ("Item No.", "Unit Rate"). Null otherwise.
 */
function continueLabels(columns: readonly PdfColumn[], line: PageLine): PdfColumn[] | null {
  const next = columns.map((column) => ({ ...column }));
  const changed = new Set<number>();
  for (const run of wordRuns(line)) {
    const text = wordText(run.words);
    const index = columnUnder(columns, run);
    const column = next[index];
    if (column === undefined || changed.has(index) || cellNumber(text) !== null) return null;
    const code = currencyCode(text);
    const label = code !== null ? `${column.label} (${code})` : `${column.label} ${text}`;
    const role = roleOf(label);
    if (code === null && !NOTE.test(text) && role === null) return null;
    next[index] = { label, role: role ?? column.role, x0: Math.min(column.x0, run.x0), x1: Math.max(column.x1, run.x1) };
    changed.add(index);
  }
  return withUniqueRoles(next);
}

/** The column whose label is above the run: the one it overlaps most, else the nearest by centre; -1 when none is close. */
function columnUnder(columns: readonly PdfColumn[], run: WordRun): number {
  let best = -1;
  let bestOverlap = 0;
  columns.forEach((column, i) => {
    const overlap = Math.min(column.x1, run.x1) - Math.max(column.x0, run.x0);
    if (overlap > bestOverlap) {
      best = i;
      bestOverlap = overlap;
    }
  });
  if (best >= 0) return best;
  const middle = (run.x0 + run.x1) / 2;
  let nearest = -1;
  let distance = Infinity;
  columns.forEach((column, i) => {
    const d = Math.abs(centre(column) - middle);
    if (d < distance && d <= column.x1 - column.x0 + (run.x1 - run.x0)) {
      nearest = i;
      distance = d;
    }
  });
  return nearest;
}

function centre(extent: { x0: number; x1: number }): number {
  return (extent.x0 + extent.x1) / 2;
}
