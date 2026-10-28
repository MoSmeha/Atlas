import { z } from 'zod';
import { Source } from './sources';

export const AnswerKind = z.enum(['answer', 'not_found', 'out_of_scope']);
export type AnswerKind = z.infer<typeof AnswerKind>;

export const CellValue = z.union([z.string(), z.number(), z.null()]);
export type CellValue = z.infer<typeof CellValue>;

/** Rows computed by a tool and saved under an id; the answer attaches them, never retypes them. */
export const ResultTable = z.object({
  resultId: z.string(),
  title: z.string().nullable(),
  columns: z.array(z.string()),
  rows: z.array(z.array(CellValue)),
  totalRows: z.number().int(),
});
export type ResultTable = z.infer<typeof ResultTable>;

export const Answer = z.object({
  kind: AnswerKind,
  language: z.enum(['en', 'ar']),
  markdown: z.string(),
  table: ResultTable.nullable(),
  sources: z.array(Source),
  /** Files that could not be read, named when the answer is "not found". */
  unreadableFiles: z.array(z.string()),
  /** Guard notes, for example a number that no tool returned. */
  warnings: z.array(z.string()),
});
export type Answer = z.infer<typeof Answer>;
