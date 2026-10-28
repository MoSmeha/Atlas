import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib';
import { FOOTER_TEXT } from '../project';

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const LEFT = 64;
const RIGHT = PAGE_WIDTH - 64;
const TOP = PAGE_HEIGHT - 84;
const BOTTOM = 76;
const CONTENT_WIDTH = RIGHT - LEFT;
const INK = rgb(0.1, 0.1, 0.12);
const MUTED = rgb(0.42, 0.42, 0.46);
const RULE = rgb(0.75, 0.75, 0.78);
const FILL = rgb(0.93, 0.94, 0.95);

export interface DocumentInfo {
  title: string;
  subject: string;
  /** Small line at the top of every page after the first. */
  runningHeader: string;
  /** Fixed metadata date so regenerating gives the same file. */
  issued: Date;
}

export interface TextStyle {
  size?: number;
  bold?: boolean;
  italic?: boolean;
  indent?: number;
  align?: 'left' | 'center';
  gapAfter?: number;
}

/** Marks a fact: the key gets the page on which the needle text was drawn. */
export type Marks = Record<string, string>;

export interface TableColumn {
  header: string;
  /** Share of the content width; the shares of a table add up to 1. */
  share: number;
}

export interface WrittenPdf {
  bytes: Uint8Array;
  pageCount: number;
  /** Page number (1-based) for every marked fact. */
  pages: Record<string, number>;
}

interface Line {
  text: string;
  start: number;
}

/** Flows headings, paragraphs, bullets and tables onto A4 pages with the standard fonts, and remembers where facts land. */
export class PdfWriter {
  private page: PDFPage;
  private y = TOP;
  private readonly pages = new Map<string, number>();

  private constructor(
    private readonly doc: PDFDocument,
    private readonly info: DocumentInfo,
    private readonly regular: PDFFont,
    private readonly bold: PDFFont,
    private readonly italic: PDFFont,
  ) {
    this.page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  }

  static async create(info: DocumentInfo): Promise<PdfWriter> {
    const doc = await PDFDocument.create({ updateMetadata: false });
    const [regular, bold, italic] = await Promise.all([
      doc.embedFont(StandardFonts.Helvetica),
      doc.embedFont(StandardFonts.HelveticaBold),
      doc.embedFont(StandardFonts.HelveticaOblique),
    ]);
    return new PdfWriter(doc, info, regular, bold, italic);
  }

  get pageNumber(): number {
    return this.doc.getPageCount();
  }

  newPage(): void {
    this.page = this.doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    this.y = TOP;
  }

  space(points: number): void {
    this.y -= points;
  }

  /** Moves the cursor down to a fixed distance from the top, for cover pages. */
  moveTo(fromTop: number): void {
    this.y = PAGE_HEIGHT - fromTop;
  }

  /** Records the current page for a fact that is not tied to one line of text. */
  mark(key: string): void {
    this.record(key, this.pageNumber);
  }

  heading(text: string, marks: Marks = {}): void {
    if (this.y - 70 < BOTTOM) this.newPage();
    this.space(6);
    this.paragraph(text, { size: 12.5, bold: true, gapAfter: 8 }, marks);
  }

  subheading(text: string, marks: Marks = {}): void {
    if (this.y - 50 < BOTTOM) this.newPage();
    this.paragraph(text, { size: 10.5, bold: true, gapAfter: 4 }, marks);
  }

  paragraph(text: string, style: TextStyle = {}, marks: Marks = {}): void {
    const size = style.size ?? 10;
    const font = this.fontFor(style);
    const indent = style.indent ?? 0;
    const lines = wrap(text, font, size, CONTENT_WIDTH - indent);
    const linePages = lines.map((line) => {
      this.ensureLine(size);
      const width = font.widthOfTextAtSize(line.text, size);
      const x = style.align === 'center' ? LEFT + (CONTENT_WIDTH - width) / 2 : LEFT + indent;
      this.page.drawText(line.text, { x, y: this.y, size, font, color: INK });
      this.y -= leading(size);
      return this.pageNumber;
    });
    this.markLines(normalise(text), lines, linePages, marks);
    this.y -= style.gapAfter ?? 6;
  }

  /** A bulleted list; `keys[i]`, when given, marks item i. */
  bullets(items: readonly string[], keys: readonly (string | null)[] = []): void {
    items.forEach((item, index) => {
      this.ensureLine(10);
      this.page.drawText('•', { x: LEFT + 6, y: this.y, size: 10, font: this.regular, color: INK });
      const key = keys[index];
      this.paragraph(item, { indent: 20, gapAfter: 3 }, key ? { [key]: item } : {});
    });
    this.y -= 4;
  }

  /** Label and value pairs in two columns, as on a cover page. */
  labelled(rows: readonly [string, string][], marks: Marks = {}): void {
    for (const [label, value] of rows) {
      this.ensureLine(10);
      this.page.drawText(label, { x: LEFT, y: this.y, size: 10, font: this.bold, color: INK });
      this.paragraph(value, { indent: 150, gapAfter: 4 }, pick(marks, value));
    }
  }

  /** A ruled table whose header repeats after a page break; `rowKeys[i]` marks row i. */
  table(columns: readonly TableColumn[], rows: readonly string[][], rowKeys: readonly (string | null)[] = []): void {
    const size = 9;
    const pad = 4;
    const widths = columns.map((column) => column.share * CONTENT_WIDTH);
    const drawRow = (cells: readonly string[], header: boolean) => {
      const font = header ? this.bold : this.regular;
      const wrapped = cells.map((cell, i) => wrap(cell, font, size, (widths[i] ?? 0) - 2 * pad));
      const height = Math.max(...wrapped.map((lines) => lines.length)) * leading(size) + 2 * pad;
      if (this.y - height < BOTTOM) {
        this.newPage();
        if (!header) drawRow(columns.map((column) => column.header), true);
      }
      const top = this.y + size;
      if (header) this.page.drawRectangle({ x: LEFT, y: top - height, width: CONTENT_WIDTH, height, color: FILL });
      let x = LEFT;
      wrapped.forEach((lines, i) => {
        lines.forEach((line, n) => {
          const baseline = top - pad - size + 1 - n * leading(size);
          this.page.drawText(line.text, { x: x + pad, y: baseline, size, font, color: INK });
        });
        x += widths[i] ?? 0;
      });
      this.rule(top - height);
      if (header) this.rule(top);
      this.y = top - height - size;
    };
    drawRow(columns.map((column) => column.header), true);
    rows.forEach((cells, index) => {
      drawRow(cells, false);
      const key = rowKeys[index];
      if (key) this.record(key, this.pageNumber);
    });
    this.y -= 8;
  }

  async finish(): Promise<WrittenPdf> {
    const total = this.doc.getPageCount();
    this.doc.getPages().forEach((page, index) => {
      if (index > 0) {
        page.drawText(this.info.runningHeader, { x: LEFT, y: PAGE_HEIGHT - 48, size: 8, font: this.regular, color: MUTED });
        page.drawLine({ start: { x: LEFT, y: PAGE_HEIGHT - 54 }, end: { x: RIGHT, y: PAGE_HEIGHT - 54 }, thickness: 0.5, color: RULE });
      }
      page.drawLine({ start: { x: LEFT, y: 54 }, end: { x: RIGHT, y: 54 }, thickness: 0.5, color: RULE });
      page.drawText(FOOTER_TEXT, { x: LEFT, y: 40, size: 8, font: this.italic, color: MUTED });
      const label = `Page ${index + 1} of ${total}`;
      const width = this.regular.widthOfTextAtSize(label, 8);
      page.drawText(label, { x: RIGHT - width, y: 40, size: 8, font: this.regular, color: MUTED });
    });
    this.doc.setTitle(this.info.title);
    this.doc.setSubject(this.info.subject);
    this.doc.setAuthor('Atlas sample generator');
    this.doc.setCreator('Atlas sample generator');
    this.doc.setProducer('pdf-lib');
    this.doc.setKeywords(['fictional', 'sample', 'Atlas']);
    this.doc.setCreationDate(this.info.issued);
    this.doc.setModificationDate(this.info.issued);
    const bytes = await this.doc.save();
    return { bytes, pageCount: total, pages: Object.fromEntries(this.pages) };
  }

  private fontFor(style: TextStyle): PDFFont {
    if (style.bold) return this.bold;
    return style.italic ? this.italic : this.regular;
  }

  private ensureLine(size: number): void {
    if (this.y - leading(size) < BOTTOM) this.newPage();
  }

  private rule(y: number): void {
    this.page.drawLine({ start: { x: LEFT, y }, end: { x: RIGHT, y }, thickness: 0.5, color: RULE });
  }

  private markLines(text: string, lines: Line[], linePages: number[], marks: Marks): void {
    for (const [key, needle] of Object.entries(marks)) {
      const offset = text.indexOf(normalise(needle));
      if (offset < 0) throw new Error(`Mark ${key}: "${needle}" is not in the text`);
      const lineIndex = lines.findLastIndex((line) => line.start <= offset);
      this.record(key, linePages[lineIndex] ?? this.pageNumber);
    }
  }

  private record(key: string, page: number): void {
    if (this.pages.has(key)) throw new Error(`Mark ${key} is used twice`);
    this.pages.set(key, page);
  }
}

function leading(size: number): number {
  return size * 1.42;
}

function normalise(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

function pick(marks: Marks, text: string): Marks {
  return Object.fromEntries(Object.entries(marks).filter(([, needle]) => text.includes(needle)));
}

/** Greedy word wrap; each line remembers where it starts in the normalised text. */
function wrap(text: string, font: PDFFont, size: number, width: number): Line[] {
  const words = normalise(text).split(' ');
  const lines: Line[] = [];
  let current = '';
  let start = 0;
  let offset = 0;
  for (const word of words) {
    const candidate = current === '' ? word : `${current} ${word}`;
    if (current !== '' && font.widthOfTextAtSize(candidate, size) > width) {
      lines.push({ text: current, start });
      current = word;
      start = offset;
    } else {
      current = candidate;
    }
    offset += word.length + 1;
  }
  lines.push({ text: current, start });
  return lines;
}
