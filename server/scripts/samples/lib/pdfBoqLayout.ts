import type { BoqItem, BoqSection } from './boqTypes';
import { lineAmount, sumAmounts } from './money';

export const PAGE_WIDTH = 595.28;
export const PAGE_HEIGHT = 841.89;
/** Where the table starts on pages after the first, below the running header. */
export const LATER_PAGE_TOP = PAGE_HEIGHT - 72;
/** The lowest point a row may reach, above the footer. */
export const BOTTOM = 72;
export const FONT_SIZE = 8.5;
export const LEADING = 11.5;
export const PAD = 5;

/** Fixed column edges in points from the left of the page; every page uses the same x positions. */
export const COLUMNS = {
  item: { left: 40, right: 88 },
  description: { left: 88, right: 318 },
  unit: { left: 318, right: 352 },
  quantity: { left: 352, right: 412 },
  rate: { left: 412, right: 482 },
  amount: { left: 482, right: 555 },
} as const;

export type PdfBoqRowKind = 'header' | 'broughtForward' | 'section' | 'item' | 'carriedForward' | 'total';

export interface PdfBoqRow {
  kind: PdfBoqRowKind;
  page: number;
  /** Top edge of the row, in PDF points from the bottom of the page. */
  top: number;
  height: number;
  code: string;
  /** The description wrapped to the column width, one string per printed line. */
  description: string[];
  unit: string;
  quantity: number | null;
  rate: number | null;
  amount: number | null;
}

export interface PdfBoqItem {
  page: number;
  section: BoqSection;
  item: BoqItem;
  amount: number;
  descriptionLines: number;
}

export interface PageAmount {
  page: number;
  amount: number;
}

export interface PdfBoqLayout {
  rows: PdfBoqRow[];
  items: PdfBoqItem[];
  /** Running total printed at the bottom of each page that continues. */
  carriedForward: PageAmount[];
  /** The same running total printed at the top of the next page. */
  broughtForward: PageAmount[];
  total: PageAmount;
  pageCount: number;
}

/** Width of `text` at FONT_SIZE, regular or bold. */
export type Measure = (text: string, bold: boolean) => number;

export const CARRIED_FORWARD = 'Carried forward';
export const BROUGHT_FORWARD = 'Brought forward';
export const TOTAL_TEXT = 'Total carried to Summary';

/**
 * Places a priced bill on A4 pages: the header repeats on every page, each page that continues ends with
 * "Carried forward" and the next starts with "Brought forward", and the last row is the total.
 */
export function layoutPdfBoq(sections: readonly BoqSection[], measure: Measure, firstTop: number): PdfBoqLayout {
  const rows: PdfBoqRow[] = [];
  const items: PdfBoqItem[] = [];
  const carriedForward: PageAmount[] = [];
  const broughtForward: PageAmount[] = [];
  let page = 1;
  let y = firstTop;
  let running = 0;

  const make = (kind: PdfBoqRowKind, description: string, bold: boolean, fields: Partial<PdfBoqRow> = {}) => {
    const lines = wrap(description, (text) => measure(text, bold), descriptionWidth());
    return { kind, code: '', unit: '', quantity: null, rate: null, amount: null, ...fields, description: lines, height: rowHeight(lines.length) };
  };
  const place = (row: Omit<PdfBoqRow, 'page' | 'top'>) => {
    rows.push({ ...row, page, top: y });
    y -= row.height;
  };
  const carryHeight = rowHeight(1);
  const fits = (height: number) => y - height - carryHeight >= BOTTOM;
  const startPage = () => {
    place(make('header', 'Description', true));
    if (page > 1) {
      place(make('broughtForward', BROUGHT_FORWARD, true, { amount: running }));
      broughtForward.push({ page, amount: running });
    }
  };
  const breakPage = () => {
    place(make('carriedForward', CARRIED_FORWARD, true, { amount: running }));
    carriedForward.push({ page, amount: running });
    page++;
    y = LATER_PAGE_TOP;
    startPage();
  };

  startPage();
  for (const section of sections) {
    const heading = make('section', section.title, true, { code: section.code });
    const itemRows = section.items.map((item) => {
      const amount = item.typedAmount ?? lineAmount(item.quantity, item.rate);
      const row = make('item', item.description, false, {
        code: item.code,
        unit: item.unit,
        quantity: item.quantity,
        rate: item.rate,
        amount,
      });
      return { item, amount, row };
    });
    if (!fits(heading.height + (itemRows[0]?.row.height ?? 0))) breakPage();
    place(heading);
    for (const { item, amount, row } of itemRows) {
      if (!fits(row.height)) breakPage();
      place(row);
      running = sumAmounts([running, amount]);
      items.push({ page, section, item, amount, descriptionLines: row.description.length });
    }
  }
  const total = make('total', TOTAL_TEXT, true, { amount: running });
  if (!fits(total.height)) breakPage();
  place(total);
  return { rows, items, carriedForward, broughtForward, total: { page, amount: running }, pageCount: page };
}

export function rowHeight(lines: number): number {
  return lines * LEADING + 2 * PAD - (LEADING - FONT_SIZE);
}

function descriptionWidth(): number {
  return COLUMNS.description.right - COLUMNS.description.left - 2 * PAD;
}

/** Greedy word wrap: each line's `width` stays within `limit` unless one word alone is wider. */
export function wrap(text: string, width: (text: string) => number, limit: number): string[] {
  const lines: string[] = [];
  let current = '';
  for (const word of text.replace(/\s+/g, ' ').trim().split(' ')) {
    const candidate = current === '' ? word : `${current} ${word}`;
    if (current !== '' && width(candidate) > limit) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  lines.push(current);
  return lines;
}
