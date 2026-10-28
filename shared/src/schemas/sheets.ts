import { z } from 'zod';
import { CellValue } from './answer';

export const SheetRowsQuery = z.object({
  from: z.coerce.number().int().min(1).default(1),
  to: z.coerce.number().int().min(1).optional(),
});
export type SheetRowsQuery = z.infer<typeof SheetRowsQuery>;

/** Raw sheet rows for the viewer, numbered as Excel numbers them. */
export const SheetRows = z.object({
  document: z.string(),
  sheet: z.string(),
  columnCount: z.number().int(),
  totalRows: z.number().int(),
  rows: z.array(z.object({ rowNumber: z.number().int(), cells: z.array(CellValue) })),
});
export type SheetRows = z.infer<typeof SheetRows>;
