import type { Answer, CellValue, ResultTable, Source } from '@atlas/shared';
import { sliceText } from '../../domain/text';
import type { InputItem } from '../ports/ModelClient';
import type { Session } from '../session/Session';

/** Earlier turns the model sees with each question. */
export const MEMORY_TURNS = 6;
/** Rows of an earlier answer's table repeated to the model; the whole result stays usable by its id. */
export const MEMORY_ROWS = 5;
const MAX_SOURCES = 10;
const MAX_CELL_CHARS = 80;
const MAX_ANSWER_CHARS = 4000;

/**
 * The input of a question's first turn: the chat's last MEMORY_TURNS turns, each as the user's question and the
 * answer as the model gave it, then the new question.
 */
export function conversationInput(session: Session, question: string): InputItem[] {
  const earlier = session.recentTurns(MEMORY_TURNS).flatMap((turn): InputItem[] => [
    { type: 'message', role: 'user', content: turn.question },
    { type: 'message', role: 'assistant', content: describeAnswer(turn.answer) },
  ]);
  return [...earlier, { type: 'message', role: 'user', content: question }];
}

/**
 * An earlier answer as the model sees it again: the markdown, then the first rows of its table under the result
 * id, as in "Result r3 (first 5 of 42 rows):", then "Sources: ...".
 */
export function describeAnswer(answer: Answer): string {
  const markdown = answer.markdown.trim();
  const parts = [markdown.length <= MAX_ANSWER_CHARS ? markdown : `${sliceText(markdown, MAX_ANSWER_CHARS - 1).trimEnd()}…`];
  if (answer.table !== null) parts.push(describeResult(answer.table));
  if (answer.sources.length > 0) parts.push(describeSources(answer.sources));
  return parts.join('\n\n');
}

function describeResult(table: ResultTable): string {
  const title = table.title === null ? '' : ` "${cell(table.title)}"`;
  const total = table.totalRows;
  const shown = table.rows.slice(0, MEMORY_ROWS);
  const count =
    total === 0 ? 'no rows' : shown.length < total ? `first ${shown.length} of ${total} rows` : `${total} ${total === 1 ? 'row' : 'rows'}`;
  const heading = `Result ${table.resultId}${title} (${count})`;
  if (shown.length === 0) return `${heading}.`;
  const lines = [table.columns.map(cell), ...shown.map((row) => row.map(cell))].map((cells) => cells.join(' | '));
  return [`${heading}:`, ...lines].join('\n');
}

function describeSources(sources: readonly Source[]): string {
  const shown = sources.slice(0, MAX_SOURCES).map(describeSource);
  const more = sources.length > MAX_SOURCES ? `; and ${sources.length - MAX_SOURCES} more` : '';
  return `Sources: ${shown.join('; ')}${more}.`;
}

/** For example "Main.pdf, page 3" or "BOQ.xlsx, sheet Bill 1, rows 5-40". */
function describeSource(source: Source): string {
  if (source.kind === 'pdf') return `${source.document}, page ${source.page}`;
  const rows = source.rowFrom === source.rowTo ? `row ${source.rowFrom}` : `rows ${source.rowFrom}-${source.rowTo}`;
  return `${source.document}, sheet ${source.sheet}, ${rows}`;
}

/** A value on one line without the column separator, cut to MAX_CELL_CHARS. */
function cell(value: CellValue): string {
  if (value === null) return '';
  const text = String(value).replace(/\s+/g, ' ').replaceAll('|', '/').trim();
  return text.length <= MAX_CELL_CHARS ? text : `${sliceText(text, MAX_CELL_CHARS - 1).trimEnd()}…`;
}
