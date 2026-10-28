import type { PdfPage } from '../document';
import type { CleanTable } from '../table';
import { buildTable, type SourceColumn } from './buildTable';
import { cellNumber } from './cellText';
import { type ColumnLayout, columnLayout, fitLine } from './pdfColumns';
import { type PdfHeader, readHeader, sameColumns } from './pdfHeader';
import { lineText, type PageLine, pageLines } from './pdfLines';
import { assembleRows, type TableLine } from './pdfRows';
import { isTotalLabel } from './totalRows';

interface DocLine extends PageLine {
  /** A running header or footer: the same text (numbers aside) at the same height on another page, near the edge. */
  furniture: boolean;
}

interface Page {
  number: number;
  height: number;
  lines: DocLine[];
}

/** A line the table took, and where it is: the index of its page in the document and of the line on the page. */
interface Taken {
  line: TableLine;
  page: number;
  index: number;
}

/** What reading one page of a table gave, and whether the table may go on to the next page. */
interface PageRun {
  taken: Taken[];
  next: boolean;
}

/** Share of the page height at the top and bottom where running headers and footers sit. */
const MARGIN_ZONE = 0.15;
/** Lines above this share of a following page may be skipped before the table goes on (running header, page title). */
const TOP_ZONE = 0.25;
/** Points between two placings of a running header or footer. */
const SAME_SPOT = 4;
/** A gap of more line heights than this ends the table on that page. */
const MAX_GAP_LINES = 4;
/** Lines at the top of a following page that are not running headers found elsewhere: a page title, say. */
const MAX_SKIPPED = 2;
/** Lines looked at below a page's first lines to see whether rows follow. */
const LOOKAHEAD = 4;
const MAX_TITLE_LINES = 3;
const MAX_TITLE_SCAN = 8;
const MAX_TITLE_LINE = 100;
const MAX_TITLE_LENGTH = 300;
const NUMBER_ROLES = new Set(['quantity', 'rate', 'amount']);
const ARABIC_LETTER = /(?=\p{L})\p{Script=Arabic}/gu;
const LATIN_LETTER = /(?=\p{L})\p{Script=Latin}/gu;

/**
 * The tables of a PDF from its positioned words. A table starts at a header line naming at least three column roles;
 * its columns run from each label to the next and following lines are split into them. Wrapped descriptions join their
 * row, section headings carry down, and totals ("Carried forward", "Page total", "Sub-total") are kept and marked. A
 * table runs on over the following pages while their lines fit its columns, skipping a repeated header and running
 * headers and footers, and stops at a line that does not fit, such as a paragraph across the columns. Rows carry their
 * page number; columns are typed and amounts parsed as in cleanSheet.
 */
export function extractPdfTables(pages: readonly PdfPage[]): CleanTable[] {
  const doc = documentPages(pages);
  const tables: CleanTable[] = [];
  let floor = { page: 0, line: -1 };
  let page = 0;
  let line = 0;
  while (page < doc.length) {
    const lines = doc[page]?.lines ?? [];
    if (line >= lines.length) {
      page++;
      line = 0;
      continue;
    }
    const header = readHeader(lines, line);
    if (header === null) {
      line++;
      continue;
    }
    const titleFloor = floor.page === page ? floor.line : -1;
    const found = readTable(doc, page, header, tableTitle(lines, header.first, titleFloor));
    if (found === null) {
      line = header.last + 1;
      continue;
    }
    tables.push(found.table);
    floor = found.end;
    page = found.end.page;
    line = found.end.line + 1;
  }
  return tables;
}

function documentPages(pages: readonly PdfPage[]): Page[] {
  const read = pages.map((page) => ({ page, lines: pageLines(page) }));
  const spots = new Map<string, { page: number; top: number }[]>();
  for (const { page, lines } of read) {
    for (const line of lines) {
      if (!inMargin(line, page.height)) continue;
      const key = furnitureKey(line);
      const found = spots.get(key);
      if (found === undefined) spots.set(key, [{ page: page.number, top: line.top }]);
      else found.push({ page: page.number, top: line.top });
    }
  }
  return read.map(({ page, lines }) => ({
    number: page.number,
    height: page.height,
    lines: lines.map((line) => ({
      ...line,
      furniture:
        inMargin(line, page.height) &&
        (spots.get(furnitureKey(line)) ?? []).some((spot) => spot.page !== page.number && Math.abs(spot.top - line.top) <= SAME_SPOT),
    })),
  }));
}

function inMargin(line: PageLine, height: number): boolean {
  return line.top < MARGIN_ZONE * height || line.top > (1 - MARGIN_ZONE) * height;
}

/** Page numbers and dates change from page to page; the rest of a running header does not. */
function furnitureKey(line: PageLine): string {
  return lineText(line).replace(/\d+/g, '#').toLowerCase();
}

function readTable(doc: readonly Page[], start: number, header: PdfHeader, title: string | null): { table: CleanTable; end: { page: number; line: number } } | null {
  const first = doc[start];
  if (first === undefined) return null;
  const layout = columnLayout(header.columns, [...first.lines.slice(header.last + 1), ...(doc[start + 1]?.lines ?? [])]);
  const taken: Taken[] = [];
  for (let p = start; p < doc.length; p++) {
    const page = doc[p];
    if (page === undefined) break;
    const run = readPage(page, p, p === start ? header.last + 1 : 0, layout, p > start);
    taken.push(...run.taken);
    if (!run.next) break;
  }
  const kept = taken.slice(0, keptLength(taken, layout));
  const last = kept.at(-1);
  if (last === undefined) return null;
  const rtl = isRtl(header);
  const columns = sourceColumns(header);
  const lines = kept.map(({ line }) => (rtl ? { ...line, cells: line.cells.toReversed() } : line));
  const rows = assembleRows(lines, columns);
  if (rows.length === 0) return null;
  const place = { title, sheet: null, pageFrom: first.number, pageTo: rows.at(-1)?.page ?? first.number };
  return { table: buildTable(place, columns, rows), end: { page: last.page, line: last.index } };
}

/** Plain text after a gap at the end of a table is a note or the next table's title, not more of the last row. */
function keptLength(taken: readonly Taken[], layout: ColumnLayout): number {
  let kept = taken.length;
  for (let k = taken.length - 1; k > 0; k--) {
    const line = taken[k]?.line;
    const above = taken[k - 1]?.line;
    if (line === undefined || above === undefined || !isPlainText(line.cells, layout)) break;
    if (above.page === line.page && line.top - above.bottom > line.height) kept = k;
  }
  return kept;
}

function isPlainText(cells: readonly string[], layout: ColumnLayout): boolean {
  return cells.every((text, i) => {
    const role = layout.columns[i]?.role ?? null;
    return text === '' || ((role === 'item_code' || role === 'description') && cellNumber(text) === null);
  });
}

/**
 * The table's lines on one page from line `from`. On a following page, running headers and a repeated header at the
 * top are skipped. The table stops at another header, or at a line that does not fit or comes after a wide gap; it
 * may go on to the next page when only running footers or the bottom margin follow.
 */
function readPage(page: Page, pageIndex: number, from: number, layout: ColumnLayout, following: boolean): PageRun {
  const { lines } = page;
  const taken: Taken[] = [];
  let skipped = 0;
  let previous: PageLine | undefined = following ? undefined : lines[from - 1];
  for (let i = from; i < lines.length; i++) {
    const line = lines[i];
    if (line === undefined) break;
    const header = readHeader(lines, i);
    if (header !== null) {
      if (!following || taken.length > 0 || !sameColumns(header.columns, layout.columns)) return { taken, next: false };
      i = header.last;
      previous = lines[i];
      continue;
    }
    const cells = fitLine(line, layout);
    if (line.furniture && !hasNumber(cells, layout)) continue;
    const gap = previous !== undefined && line.top - previous.bottom > MAX_GAP_LINES * line.height;
    if (following && taken.length === 0 && (cells === null || !rowsFollow(lines, i, layout))) {
      if (skipped >= MAX_SKIPPED || line.top > TOP_ZONE * page.height || isSentence(lineText(line))) return { taken, next: false };
      skipped++;
      continue;
    }
    if (cells === null || gap) return { taken, next: onlyFooter(page, i) };
    taken.push({ line: { page: page.number, top: line.top, bottom: line.bottom, height: line.height, cells }, page: pageIndex, index: i });
    previous = line;
  }
  // A following page that adds nothing (prose, a picture) breaks the table.
  return { taken, next: !following || taken.length > 0 };
}

function hasNumber(cells: readonly string[] | null, layout: ColumnLayout): boolean {
  return (
    cells !== null &&
    cells.some((text, i) => {
      const role = layout.columns[i]?.role ?? null;
      return role !== null && NUMBER_ROLES.has(role) && cellNumber(text) !== null;
    })
  );
}

/** Whether a row with numbers or an item code comes within the next few fitting lines, so the table goes on here. */
function rowsFollow(lines: readonly DocLine[], from: number, layout: ColumnLayout): boolean {
  const code = layout.columns.findIndex((column) => column.role === 'item_code');
  for (let i = from; i < Math.min(lines.length, from + LOOKAHEAD); i++) {
    const line = lines[i];
    if (line === undefined || readHeader(lines, i) !== null) return false;
    const cells = fitLine(line, layout);
    if (cells === null) return false;
    if (hasNumber(cells, layout) || (code >= 0 && (cells[code] ?? '') !== '')) return true;
  }
  return false;
}

/** The lines from `from` on are all running footers or sit in the bottom margin. */
function onlyFooter(page: Page, from: number): boolean {
  return page.lines.slice(from).every((line) => line.furniture || line.top > (1 - MARGIN_ZONE) * page.height);
}

function sourceColumns(header: PdfHeader): SourceColumn[] {
  const columns = header.columns.map(({ label, role }) => ({ label, role }));
  return isRtl(header) ? columns.toReversed() : columns;
}

/** An Arabic header reads from the right, so its columns are listed right to left. */
function isRtl(header: PdfHeader): boolean {
  const labels = header.columns.map((column) => column.label).join(' ');
  return (labels.match(ARABIC_LETTER)?.length ?? 0) > (labels.match(LATIN_LETTER)?.length ?? 0);
}

/**
 * The short lines just above the header, joined with " - ". Notes written as sentences between the title and the
 * header are passed over; a total, a wide gap or the previous table (`floor`) ends the search.
 */
function tableTitle(lines: readonly DocLine[], first: number, floor: number): string | null {
  const titles: string[] = [];
  let below = lines[first];
  for (let i = first - 1; i > floor && i >= first - MAX_TITLE_SCAN; i--) {
    const line = lines[i];
    if (line === undefined || below === undefined || below.top - line.bottom > MAX_GAP_LINES * line.height) break;
    below = line;
    if (line.furniture) continue;
    const text = lineText(line);
    if (isTotalLabel(text)) break;
    if (text.length > MAX_TITLE_LINE || isSentence(text)) {
      if (titles.length > 0) break;
      continue;
    }
    titles.unshift(text);
    if (titles.length === MAX_TITLE_LINES) break;
  }
  const title = titles.join(' - ');
  return title === '' ? null : title.slice(0, MAX_TITLE_LENGTH);
}

function isSentence(text: string): boolean {
  return /[.!?؟]$/.test(text) && text.split(' ').length >= 5;
}
