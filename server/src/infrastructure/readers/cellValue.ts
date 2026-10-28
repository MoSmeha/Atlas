import ExcelJS from 'exceljs';
import type { RawCell } from '../../domain/document';

/**
 * The value Atlas keeps for one exceljs cell. Formula cells give their cached result (null when the file has none,
 * never the formula text), rich text and hyperlinks give their plain text, text is trimmed and blank text is null,
 * and error values such as #DIV/0! are null. A cell covered by a merge is null; the merge's top-left cell has the value.
 */
export function rawCellValue(cell: ExcelJS.Cell): RawCell {
  if (cell.type === ExcelJS.ValueType.Merge) return null;
  if (cell.type === ExcelJS.ValueType.Formula) return plainValue(cell.result);
  return plainValue(cell.value);
}

/** Typed as unknown because exceljs is looser than its types: a hyperlink's text can be rich text or a number. */
function plainValue(value: unknown): RawCell {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string') return trimmed(value);
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'boolean') return value;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value !== 'object') return null;
  if ('richText' in value && Array.isArray(value.richText)) return trimmed(value.richText.map(richTextPart).join(''));
  if ('hyperlink' in value && 'text' in value) return plainValue(value.text);
  return null;
}

function richTextPart(part: unknown): string {
  return typeof part === 'object' && part !== null && 'text' in part && typeof part.text === 'string' ? part.text : '';
}

function trimmed(text: string): string | null {
  const value = text.trim();
  return value === '' ? null : value;
}
