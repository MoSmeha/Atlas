/** Sources in the same shape as @atlas/shared Source, for expected.json. */

export interface PdfSource {
  kind: 'pdf';
  document: string;
  page: number;
  quote: string | null;
}

export interface ExcelSource {
  kind: 'excel';
  document: string;
  sheet: string;
  rowFrom: number;
  rowTo: number;
}

export function pdfPage(document: string, page: number, quote: string | null = null): PdfSource {
  return { kind: 'pdf', document, page, quote };
}

export function excelRows(document: string, sheet: string, rowFrom: number, rowTo = rowFrom): ExcelSource {
  return { kind: 'excel', document, sheet, rowFrom, rowTo };
}
