import type { Answer, ResultTable } from '@atlas/shared';
import type { SavedResult } from '../session/Session';

/** Rows of an attached result sent with the answer; the full result stays exportable. */
export const MAX_TABLE_ROWS = 200;

export interface AnswerParts extends Omit<Answer, 'table'> {
  /** The saved result to show as the answer's table, or null for none. */
  result: SavedResult | null;
}

/** A saved result as the answer's table: its title and columns, the first rows, and how many rows it has in all. */
export function resultTable(result: SavedResult, maxRows = MAX_TABLE_ROWS): ResultTable {
  return {
    resultId: result.id,
    title: result.title,
    columns: [...result.columns],
    rows: result.rows.slice(0, maxRows).map((row) => [...row]),
    totalRows: result.rows.length,
  };
}

/** The shared Answer the chat route sends and the session keeps. */
export function buildAnswer(parts: AnswerParts): Answer {
  return {
    kind: parts.kind,
    language: parts.language,
    markdown: parts.markdown.trim(),
    table: parts.result === null ? null : resultTable(parts.result),
    sources: [...parts.sources],
    unreadableFiles: [...parts.unreadableFiles],
    warnings: [...parts.warnings],
  };
}
