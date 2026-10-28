/** A rectangle on a PDF page in points, origin at the top-left corner. */
export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** A word and its horizontal extent; table detection lines words up into columns. */
export interface PositionedWord {
  text: string;
  x0: number;
  x1: number;
}

export interface TextLine {
  text: string;
  box: Box;
  words: PositionedWord[];
}

export interface TextBlock {
  box: Box;
  lines: TextLine[];
}

export interface PdfPage {
  /** 1-based page number. */
  number: number;
  width: number;
  height: number;
  /** Plain text in reading order. */
  text: string;
  /** False for a scanned page with no text layer; the agent reads those with look_at_page. */
  hasTextLayer: boolean;
  blocks: TextBlock[];
}

export interface ParsedPdf {
  kind: 'pdf';
  pages: PdfPage[];
}

/** A cell as the reader found it. Formula cells hold their cached result. */
export type RawCell = string | number | boolean | Date | null;

/** A merged range in sheet coordinates, 1-based and inclusive. */
export interface MergedRange {
  top: number;
  left: number;
  bottom: number;
  right: number;
}

export interface SheetGrid {
  name: string;
  /** rows[0] is sheet row 1 and rows[r][0] is column A. In a merged range only the top-left cell has a value. */
  rows: RawCell[][];
  merges: MergedRange[];
}

export interface ParsedWorkbook {
  kind: 'excel';
  sheets: SheetGrid[];
}

export type ParsedDocument = ParsedPdf | ParsedWorkbook;
