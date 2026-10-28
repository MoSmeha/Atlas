import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib';
import { FOOTER_TEXT } from '../project';
import type { BoqSection } from './boqTypes';
import { formatAmount } from './money';
import {
  COLUMNS,
  FONT_SIZE,
  LEADING,
  PAD,
  PAGE_HEIGHT,
  PAGE_WIDTH,
  layoutPdfBoq,
  wrap,
  type PdfBoqLayout,
  type PdfBoqRow,
} from './pdfBoqLayout';

const INK = rgb(0.1, 0.1, 0.12);
const MUTED = rgb(0.42, 0.42, 0.46);
const RULE = rgb(0.72, 0.72, 0.76);
const FILL = rgb(0.92, 0.93, 0.95);
const LEFT = COLUMNS.item.left;
const RIGHT = COLUMNS.amount.right;
const EDGES = [...Object.values(COLUMNS).map((column) => column.left), RIGHT];
const QUANTITY = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 });

export interface TitleLine {
  text: string;
  size: number;
  bold?: boolean;
}

export interface PdfBoqSpec {
  fileName: string;
  /** PDF metadata title and subject. */
  title: string;
  subject: string;
  /** Small line at the top of every page after the first. */
  runningHeader: string;
  /** The title block on page 1, top to bottom. */
  heading: TitleLine[];
  /** Short paragraphs under the title block on page 1. */
  notes: string[];
  currency: string;
  /** Fixed metadata date so regenerating gives the same file. */
  issued: Date;
  sections: BoqSection[];
}

export interface GeneratedPdfBoq {
  fileName: string;
  bytes: Uint8Array;
  pageCount: number;
  layout: PdfBoqLayout;
}

interface Fonts {
  regular: PDFFont;
  bold: PDFFont;
  italic: PDFFont;
}

/** Draws a priced bill as a ruled table at fixed column positions, with the standard PDF fonts. */
export async function writePdfBoq(spec: PdfBoqSpec): Promise<GeneratedPdfBoq> {
  const doc = await PDFDocument.create({ updateMetadata: false });
  const [regular, bold, italic] = await Promise.all([
    doc.embedFont(StandardFonts.Helvetica),
    doc.embedFont(StandardFonts.HelveticaBold),
    doc.embedFont(StandardFonts.HelveticaOblique),
  ]);
  const fonts = { regular, bold, italic };
  const first = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  const tableTop = drawTitleBlock(first, spec, fonts);
  const layout = layoutPdfBoq(spec.sections, (text, isBold) => (isBold ? bold : regular).widthOfTextAtSize(text, FONT_SIZE), tableTop);
  const pages = [first];
  while (pages.length < layout.pageCount) pages.push(doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]));

  for (const row of layout.rows) drawRow(pages[row.page - 1]!, row, fonts, spec.currency);
  pages.forEach((page, index) => {
    drawColumnRules(page, layout.rows.filter((row) => row.page === index + 1));
    decorate(page, index, pages.length, spec.runningHeader, fonts);
  });

  doc.setTitle(spec.title);
  doc.setSubject(spec.subject);
  doc.setAuthor('Atlas sample generator');
  doc.setCreator('Atlas sample generator');
  doc.setProducer('pdf-lib');
  doc.setKeywords(['fictional', 'sample', 'Atlas']);
  doc.setCreationDate(spec.issued);
  doc.setModificationDate(spec.issued);
  return { fileName: spec.fileName, bytes: await doc.save(), pageCount: pages.length, layout };
}

/** Draws the title lines and notes; returns where the table may start. */
function drawTitleBlock(page: PDFPage, spec: PdfBoqSpec, fonts: Fonts): number {
  let y = PAGE_HEIGHT - 64;
  for (const line of spec.heading) {
    page.drawText(line.text, { x: LEFT, y, size: line.size, font: line.bold ? fonts.bold : fonts.regular, color: INK });
    y -= line.size * 1.5;
  }
  y -= 6;
  for (const note of spec.notes) {
    for (const text of wrap(note, (candidate) => fonts.italic.widthOfTextAtSize(candidate, 8.5), RIGHT - LEFT)) {
      page.drawText(text, { x: LEFT, y, size: 8.5, font: fonts.italic, color: MUTED });
      y -= 11.5;
    }
    y -= 3;
  }
  return y - 10;
}

function drawRow(page: PDFPage, row: PdfBoqRow, fonts: Fonts, currency: string): void {
  const bottom = row.top - row.height;
  if (row.kind === 'header' || row.kind === 'total') {
    page.drawRectangle({ x: LEFT, y: bottom, width: RIGHT - LEFT, height: row.height, color: FILL });
  }
  const baseline = (line: number) => row.top - PAD - FONT_SIZE * 0.8 - line * LEADING;
  const font = row.kind === 'item' ? fonts.regular : fonts.bold;
  const left = (text: string, column: keyof typeof COLUMNS, line = 0) =>
    page.drawText(text, { x: COLUMNS[column].left + PAD, y: baseline(line), size: FONT_SIZE, font, color: INK });
  const right = (text: string, column: keyof typeof COLUMNS) =>
    page.drawText(text, {
      x: COLUMNS[column].right - PAD - font.widthOfTextAtSize(text, FONT_SIZE),
      y: baseline(0),
      size: FONT_SIZE,
      font,
      color: INK,
    });

  if (row.kind === 'header') {
    left('Item', 'item');
    left('Description', 'description');
    left('Unit', 'unit');
    right('Qty', 'quantity');
    right(`Rate (${currency})`, 'rate');
    right(`Amount (${currency})`, 'amount');
  } else {
    if (row.code !== '') left(row.code, 'item');
    row.description.forEach((text, line) => left(text, 'description', line));
    if (row.unit !== '') left(row.unit, 'unit');
    if (row.quantity !== null) right(QUANTITY.format(row.quantity), 'quantity');
    if (row.rate !== null) right(formatAmount(row.rate), 'rate');
    if (row.amount !== null) right(formatAmount(row.amount), 'amount');
  }
  rule(page, bottom);
  if (row.kind === 'header') rule(page, row.top);
}

function drawColumnRules(page: PDFPage, rows: PdfBoqRow[]): void {
  const top = rows[0]?.top;
  const last = rows.at(-1);
  if (top === undefined || last === undefined) return;
  const bottom = last.top - last.height;
  for (const x of EDGES) page.drawLine({ start: { x, y: top }, end: { x, y: bottom }, thickness: 0.5, color: RULE });
}

function decorate(page: PDFPage, index: number, total: number, runningHeader: string, fonts: Fonts): void {
  if (index > 0) {
    page.drawText(runningHeader, { x: LEFT, y: PAGE_HEIGHT - 48, size: 8, font: fonts.regular, color: MUTED });
    rule(page, PAGE_HEIGHT - 54);
  }
  rule(page, 54);
  page.drawText(FOOTER_TEXT, { x: LEFT, y: 40, size: 8, font: fonts.italic, color: MUTED });
  const label = `Page ${index + 1} of ${total}`;
  page.drawText(label, { x: RIGHT - fonts.regular.widthOfTextAtSize(label, 8), y: 40, size: 8, font: fonts.regular, color: MUTED });
}

function rule(page: PDFPage, y: number): void {
  page.drawLine({ start: { x: LEFT, y }, end: { x: RIGHT, y }, thickness: 0.5, color: RULE });
}
