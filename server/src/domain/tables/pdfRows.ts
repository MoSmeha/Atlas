import type { RawCell } from '../document';
import { columnTypes, leadingTextColumns, type SourceColumn, type SourceRow } from './buildTable';
import { headingText, isSectionHeading, isTotalRow } from './totalRows';

/** One printed line of a table, its text split into the table's columns ('' where a column is empty). */
export interface TableLine {
  page: number;
  top: number;
  bottom: number;
  height: number;
  cells: string[];
}

/** data and total lines start a row; a heading names the section below; text sits only in the description. */
type Kind = 'data' | 'total' | 'heading' | 'text';

/** Lines of one row sit closer than this share of the line height; most tables leave more room between rows. */
const ROW_GAP = 0.35;
const MAX_HEADING_LENGTH = 80;
const MAX_HEADING_WORDS = 10;
/** Small words a title leaves in lower case. */
const MIN_TITLE_WORD = 4;

interface Context {
  lines: readonly TableLine[];
  kinds: readonly Kind[];
  description: number;
  code: number;
}

/**
 * Turns a table's printed lines into rows. A line with an item code, measures or amounts starts a row; a line with
 * text only in the description continues the row above it (descriptions wrap), unless it looks like a section heading
 * (all capitals or a short title, followed by rows); a line with only an item code and a title is a heading too.
 * Where rows are spaced further apart than the lines inside them, text lines above a row's numbers in the same row
 * belong to that row, so descriptions printed above bottom-aligned numbers are kept with them. Totals keep isTotal.
 */
export function assembleRows(lines: readonly TableLine[], columns: readonly SourceColumn[]): SourceRow[] {
  const types = columnTypes(columns, lines.map((line) => ({ cells: rawCells(line) })));
  const headingColumns = leadingTextColumns(columns, types);
  const detailColumns = new Set(columns.flatMap((column, i) => (column.role === 'unit' || column.role === 'rate' ? [i] : [])));
  const description = columns.findIndex((column) => column.role === 'description');
  const context: Context = {
    lines,
    kinds: lines.map((line) => kindOf(rawCells(line), headingColumns, detailColumns, description)),
    description,
    code: columns.findIndex((column) => column.role === 'item_code'),
  };
  const builder = new RowBuilder(context);
  for (const group of rowGroups(lines)) {
    const starts = group.filter((i) => isStart(context.kinds[i]));
    const start = starts[0];
    if (starts.length === 1 && start !== undefined) oneRow(context, builder, group, start);
    else if (starts.length === 0) noRow(context, builder, group);
    else group.forEach((i) => lineByLine(context, builder, i));
  }
  return builder.finish();
}

function rawCells(line: TableLine): RawCell[] {
  return line.cells.map((cell) => (cell === '' ? null : cell));
}

function kindOf(cells: readonly RawCell[], headingColumns: ReadonlySet<number>, detailColumns: ReadonlySet<number>, description: number): Kind {
  const filled = cells.flatMap((cell, i) => (cell === null ? [] : [i]));
  if (filled.length === 1 && filled[0] === description) return 'text';
  if (filled.some((i) => !headingColumns.has(i))) return isTotalRow(cells, detailColumns) ? 'total' : 'data';
  return isSectionHeading(cells, headingColumns) ? 'heading' : 'data';
}

function isStart(kind: Kind | undefined): boolean {
  return kind === 'data' || kind === 'total';
}

/** Runs of lines on one page with no more than a line's spacing between them: one row each, when rows have room around them. */
function rowGroups(lines: readonly TableLine[]): number[][] {
  const groups: number[][] = [];
  lines.forEach((line, i) => {
    const previous = lines[i - 1];
    const group = groups.at(-1);
    const apart =
      previous === undefined ||
      previous.page !== line.page ||
      line.top - previous.bottom > ROW_GAP * Math.min(line.height, previous.height);
    if (apart || group === undefined) groups.push([i]);
    else group.push(i);
  });
  return groups;
}

/**
 * A group holding one row: text lines above its numbers start its description and lines below continue it. A line in
 * capitals above a description that is not is the section heading, and an item code printed above the numbers is the row's.
 */
function oneRow(context: Context, builder: RowBuilder, group: readonly number[], start: number): void {
  const { lines, kinds, description, code } = context;
  const line = lines[start];
  if (line === undefined) return;
  const cells = rawCells(line);
  const own = cells[description];
  const capitalRow = typeof own === 'string' && isCapitals(own);
  const lead: string[] = [];
  let leadCode: string | null = null;
  for (const i of group.filter((index) => index < start)) {
    const text = lineText(context, i);
    const above = rawCells(lines[i] ?? line);
    const aboveCode = above[code];
    if (kinds[i] === 'heading' && typeof aboveCode === 'string' && cells[code] == null && leadCode === null) {
      leadCode = aboveCode;
      const rest = above[description];
      if (typeof rest === 'string') lead.push(rest);
    } else if (kinds[i] === 'heading' || (lead.length === 0 && !capitalRow && isCapitals(text))) {
      builder.heading(text);
    } else {
      lead.push(text);
    }
  }
  builder.start(line, cells, kinds[start] === 'total', lead, leadCode);
  for (const i of group.filter((index) => index > start)) {
    if (kinds[i] === 'text') builder.extend(lineText(context, i));
    else builder.heading(lineText(context, i));
  }
}

/**
 * A group without numbers, read as one piece so a wrapped heading stays whole: a heading when it has an item code or
 * looks like one and rows follow, otherwise more description for the row above (as at the top of a page).
 */
function noRow(context: Context, builder: RowBuilder, group: readonly number[]): void {
  const text = group.map((i) => lineText(context, i)).join(' ');
  const last = group.at(-1) ?? 0;
  const coded = group.some((i) => context.kinds[i] === 'heading');
  if (coded || (looksLikeHeading(text) && followedByRow(context, last))) builder.heading(text);
  else builder.extend(text);
}

/** Lines read in turn: rows start at data lines, and text lines continue the row above unless they are headings. */
function lineByLine(context: Context, builder: RowBuilder, i: number): void {
  const { lines, kinds } = context;
  const line = lines[i];
  const kind = kinds[i];
  if (line === undefined) return;
  if (kind === 'data' || kind === 'total') builder.start(line, rawCells(line), kind === 'total');
  else if (kind === 'heading') builder.heading(lineText(context, i));
  else if (looksLikeHeading(lineText(context, i)) && followedByRow(context, i)) builder.heading(lineText(context, i));
  else builder.extend(lineText(context, i));
}

function lineText(context: Context, i: number): string {
  const line = context.lines[i];
  if (line === undefined) return '';
  return context.kinds[i] === 'text' ? (line.cells[context.description] ?? '') : headingText(rawCells(line));
}

/** Whether rows follow line i, past any further heading lines, before a total, plain text or the end of the table. */
function followedByRow(context: Context, i: number): boolean {
  for (let next = i + 1; next < context.lines.length; next++) {
    const kind = context.kinds[next];
    if (kind === 'data' || kind === 'heading') return true;
    if (kind !== 'text' || !looksLikeHeading(lineText(context, next))) return false;
  }
  return false;
}

/** A short title in capitals or title case, without the punctuation that ends a sentence or a wrapped line. */
export function looksLikeHeading(text: string): boolean {
  const words = text.split(' ');
  if (text.length > MAX_HEADING_LENGTH || words.length > MAX_HEADING_WORDS || /[.,;]$/.test(text)) return false;
  if (isCapitals(text)) return true;
  if (!/^[\p{Lu}\d]/u.test(text) || !/[A-Za-z]{3}/.test(text)) return false;
  return words
    .filter((word) => new RegExp(`^\\p{L}{${MIN_TITLE_WORD},}`, 'u').test(word))
    .every((word) => /^\p{Lu}/u.test(word));
}

/** Latin text in capitals: at least three letters and no lower-case one. */
function isCapitals(text: string): boolean {
  return /[A-Z]{2,}/.test(text) && (text.match(/[A-Z]/g)?.length ?? 0) >= 3 && !/[a-z]/.test(text);
}

interface DraftRow {
  line: TableLine;
  cells: RawCell[];
  isTotal: boolean;
  section: string | null;
}

/** Collects rows and the section they fall under; consecutive headings join with " - ", as in cleanSheet. */
class RowBuilder {
  private readonly rows: DraftRow[] = [];
  private section: string | null = null;
  private afterHeading = false;
  /** Description text seen before any row, given to the next row. */
  private pending: string[] = [];

  constructor(private readonly context: Context) {}

  heading(text: string): void {
    this.flushPending();
    this.section = this.afterHeading && this.section !== null ? `${this.section} - ${text}` : text;
    this.afterHeading = true;
  }

  start(line: TableLine, cells: RawCell[], isTotal: boolean, lead: readonly string[] = [], leadCode: string | null = null): void {
    const { description, code } = this.context;
    const texts = [...this.pending, ...lead];
    this.pending = [];
    if (description >= 0) {
      const own = cells[description];
      const joined = [...texts, ...(typeof own === 'string' ? [own] : [])].join(' ');
      cells[description] = joined === '' ? null : joined;
    }
    if (code >= 0 && leadCode !== null && cells[code] == null) cells[code] = leadCode;
    const afterTotal = this.rows.at(-1)?.isTotal === true;
    this.rows.push({ line, cells, isTotal, section: isTotal && afterTotal ? null : this.section });
    this.afterHeading = false;
  }

  /** Adds text to the description of the last row, or keeps it for the next row when there is none yet. */
  extend(text: string): void {
    const row = this.rows.at(-1);
    const { description } = this.context;
    if (text === '') return;
    if (row === undefined || description < 0) {
      this.pending.push(text);
      return;
    }
    const own = row.cells[description];
    row.cells[description] = typeof own === 'string' ? `${own} ${text}` : text;
  }

  finish(): SourceRow[] {
    this.flushPending();
    return this.rows.map((row) => ({ cells: row.cells, sheetRow: null, page: row.line.page, isTotal: row.isTotal, section: row.section }));
  }

  private flushPending(): void {
    const texts = this.pending;
    this.pending = [];
    if (this.rows.length > 0) texts.forEach((text) => this.extend(text));
  }
}
