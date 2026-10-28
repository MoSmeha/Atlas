import type { BoqBill, BoqItem, BoqRevision, BoqSection } from './boqTypes';
import { lineAmount, sumAmounts } from './money';

/** Rows 1 to 4 hold the titles; rows 5 and 6 the two-row header; the body starts at row 7. */
export const TITLE_ROWS = 4;
export const HEADER_ROWS = [5, 6] as const;
export const FIRST_BODY_ROW = 7;
export const SUMMARY_SHEET = 'Summary';

export interface SectionLine {
  kind: 'section';
  row: number;
  section: BoqSection;
  text: string;
}

export interface ItemLine {
  kind: 'item';
  row: number;
  section: BoqSection;
  item: BoqItem;
  /** The amount as written in the file. */
  amount: number;
  /** Quantity x rate. */
  correctAmount: number;
  /** Formula without "=", or null when the amount is a typed value. */
  formula: string | null;
}

export interface SubtotalLine {
  kind: 'subtotal';
  row: number;
  section: BoqSection;
  text: string;
  formula: string;
  /** What the formula gives, as cached in the file. */
  value: number;
  /** The sum of every item amount in the section. */
  correctValue: number;
  rangeFrom: number;
  rangeTo: number;
}

export interface TotalLine {
  kind: 'total';
  row: number;
  text: string;
  formula: string;
  value: number;
  /** The sum of every item amount in the bill. */
  correctValue: number;
}

export type BillLine = SectionLine | ItemLine | SubtotalLine | TotalLine;

export interface BillLayout {
  bill: BoqBill;
  lines: BillLine[];
  items: ItemLine[];
  subtotals: SubtotalLine[];
  total: TotalLine;
  footerRow: number;
}

export interface SummaryLine {
  row: number;
  bill: BoqBill;
  formula: string;
  value: number;
}

export interface SummaryLayout {
  headerRow: number;
  lines: SummaryLine[];
  totalRow: number;
  totalText: string;
  totalFormula: string;
  total: number;
  footerRow: number;
}

export interface BoqLayout {
  revision: BoqRevision;
  bills: BillLayout[];
  summary: SummaryLayout;
}

/** Decides the Excel row of every line, and the formulas and cached values the workbook will hold. */
export function layoutBoq(revision: BoqRevision): BoqLayout {
  const bills = revision.bills.map(layoutBill);
  return { revision, bills, summary: layoutSummary(bills) };
}

function layoutBill(bill: BoqBill): BillLayout {
  const lines: BillLine[] = [];
  const items: ItemLine[] = [];
  const subtotals: SubtotalLine[] = [];
  let row = FIRST_BODY_ROW;
  for (const section of bill.sections) {
    lines.push({ kind: 'section', row: row++, section, text: `${section.code} ${section.title}` });
    const sectionItems = section.items.map((item): ItemLine => {
      const at = row++;
      const correctAmount = lineAmount(item.quantity, item.rate);
      const typed = item.typedAmount !== undefined;
      return {
        kind: 'item',
        row: at,
        section,
        item,
        amount: typed ? (item.typedAmount as number) : correctAmount,
        correctAmount,
        formula: typed ? null : `D${at}*E${at}`,
      };
    });
    if (sectionItems.length === 0) throw new Error(`Section ${section.code} has no items`);
    const rangeFrom = sectionItems[0]!.row;
    const rangeTo = sectionItems.at(-1)!.row - (section.subtotalMissesLastItem ? 1 : 0);
    const subtotal: SubtotalLine = {
      kind: 'subtotal',
      row: row++,
      section,
      text: `Sub-total ${section.code} ${section.title}`,
      formula: `SUM(F${rangeFrom}:F${rangeTo})`,
      value: sumAmounts(sectionItems.filter((line) => line.row <= rangeTo).map((line) => line.amount)),
      correctValue: sumAmounts(sectionItems.map((line) => line.amount)),
      rangeFrom,
      rangeTo,
    };
    lines.push(...sectionItems, subtotal);
    items.push(...sectionItems);
    subtotals.push(subtotal);
    row++;
  }
  const total: TotalLine = {
    kind: 'total',
    row: row++,
    text: `Total Bill ${bill.number} - ${bill.title} (carried to Summary)`,
    formula: subtotals.map((line) => `F${line.row}`).join('+'),
    value: sumAmounts(subtotals.map((line) => line.value)),
    correctValue: sumAmounts(items.map((line) => line.amount)),
  };
  lines.push(total);
  return { bill, lines, items, subtotals, total, footerRow: row + 1 };
}

function layoutSummary(bills: BillLayout[]): SummaryLayout {
  const headerRow = TITLE_ROWS + 1;
  const lines = bills.map((layout, index) => ({
    row: headerRow + 1 + index,
    bill: layout.bill,
    formula: `'${layout.bill.sheet}'!F${layout.total.row}`,
    value: layout.total.value,
  }));
  const first = lines[0]?.row ?? headerRow + 1;
  const last = lines.at(-1)?.row ?? first;
  const totalRow = last + 2;
  return {
    headerRow,
    lines,
    totalRow,
    totalText: 'Total for Phase 1 carried to the Form of Tender (excluding VAT)',
    totalFormula: `SUM(C${first}:C${last})`,
    total: sumAmounts(lines.map((line) => line.value)),
    footerRow: totalRow + 2,
  };
}
