import { z } from 'zod';

/** A fact taken from a PDF: file and page, plus the quoted text when there is one. */
export const PdfSource = z.object({
  kind: z.literal('pdf'),
  document: z.string(),
  page: z.number().int().min(1),
  quote: z.string().nullable(),
});
export type PdfSource = z.infer<typeof PdfSource>;

/** A fact taken from a spreadsheet: file, sheet and the row range (1-based, as Excel shows it). */
export const ExcelSource = z.object({
  kind: z.literal('excel'),
  document: z.string(),
  sheet: z.string(),
  rowFrom: z.number().int().min(1),
  rowTo: z.number().int().min(1),
});
export type ExcelSource = z.infer<typeof ExcelSource>;

export const Source = z.discriminatedUnion('kind', [PdfSource, ExcelSource]);
export type Source = z.infer<typeof Source>;
