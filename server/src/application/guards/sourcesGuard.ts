import type { Answer, DocumentSummary, ExcelSource, FileStatus, PdfSource, Source } from '@atlas/shared';
import { sliceText } from '../../domain/text';
import type { DocumentIndex } from '../ports/DocumentIndex';
import type { SavedResult, Session } from '../session/Session';
import { listDocuments } from '../tools/listDocuments';
import type { SubmittedSource } from '../tools/submitAnswer';
import { guardMessages } from './guardMessages';
import type { AnswerProblem } from './problems';

/** Files Atlas could not read at all; a "not found" answer names them, since the answer may be inside. */
export const UNREADABLE_STATUSES: readonly FileStatus[] = ['corrupt', 'encrypted', 'empty', 'too_large'];
const MAX_QUOTE_CHARS = 300;

export interface SourcesInput {
  index: DocumentIndex;
  session: Session;
  kind: Answer['kind'];
  sources: readonly SubmittedSource[];
  resultId: string | null;
  /** The answer is about the folder's files themselves (see isAboutFolder), so it needs no source. */
  aboutFolder?: boolean;
}

export interface SourcesCheck {
  /** The valid sources in the shared shape, then the attached result's own sources, without repeats. */
  sources: Source[];
  /** The saved result result_id names; null when there is none or it does not exist. */
  result: SavedResult | null;
  problems: AnswerProblem[];
}

/**
 * Checks every source against the index: the document must be loaded and readable, a PDF page must be between 1
 * and its page count, an Excel sheet must exist and its rows start at 1. Valid ones become the shared Source shape;
 * each invalid one is a problem. result_id must name a saved result in the session. An answer of kind "answer"
 * with no valid source is a problem too, unless it is about the folder's files themselves.
 */
export function checkSources(input: SourcesInput): SourcesCheck {
  const problems: AnswerProblem[] = [];
  const result = input.resultId === null ? null : input.session.result(input.resultId);
  if (input.resultId !== null && result === null) problems.push({ type: 'result', resultId: input.resultId });

  const valid: Source[] = [];
  for (const submitted of input.sources) {
    const checked = toSource(input.index, submitted);
    if (typeof checked === 'string') problems.push({ type: 'source', reason: checked });
    else valid.push(checked);
  }
  const sources = withoutRepeats([...valid, ...(result?.sources ?? [])]);
  if (input.kind === 'answer' && sources.length === 0 && input.aboutFolder !== true) problems.push({ type: 'no_source' });
  return { sources, result, problems };
}

/**
 * Whether an answer is about the folder's files themselves, such as which files could not be read and why: kind
 * "answer", no sources given, and list_documents was the only tool this question called. list_documents returns
 * the index's own record of the files, not their content, so it has no Source to cite.
 */
export function isAboutFolder(answer: { kind: Answer['kind']; sources: readonly unknown[] }, toolCalls: readonly string[]): boolean {
  return (
    answer.kind === 'answer' &&
    answer.sources.length === 0 &&
    toolCalls.length > 0 &&
    toolCalls.every((name) => name === listDocuments.name)
  );
}

/**
 * Applies the source rule to an accepted answer: one of kind "answer" with no valid source becomes "not found"
 * with the fixed text in its language, unless it is about the folder's files themselves. A "not found" answer and
 * an answer about the folder name the files that could not be read.
 */
export function requireSources(
  index: DocumentIndex,
  answer: Pick<Answer, 'kind' | 'language' | 'markdown'>,
  sources: readonly Source[],
  aboutFolder = false,
): Pick<Answer, 'kind' | 'markdown' | 'unreadableFiles'> {
  if (aboutFolder && answer.kind === 'answer' && sources.length === 0) {
    return { kind: 'answer', markdown: answer.markdown, unreadableFiles: unreadableFiles(index) };
  }
  const kind = answer.kind === 'answer' && sources.length === 0 ? 'not_found' : answer.kind;
  if (kind !== 'not_found') return { kind, markdown: answer.markdown, unreadableFiles: [] };
  const markdown = kind === answer.kind && answer.markdown.trim() !== '' ? answer.markdown : guardMessages.notFound(answer.language);
  return { kind, markdown, unreadableFiles: unreadableFiles(index) };
}

/** Paths of the loaded files that could not be read, sorted. */
export function unreadableFiles(index: DocumentIndex): string[] {
  return index
    .documents()
    .filter((doc) => UNREADABLE_STATUSES.includes(doc.status))
    .map((doc) => doc.path)
    .toSorted((a, b) => a.localeCompare(b));
}

/** The source in the shared shape, or why it cannot be one. */
function toSource(index: DocumentIndex, submitted: SubmittedSource): Source | string {
  const name = submitted.document.trim();
  const doc = index.find(name);
  if (doc === null) return `"${name}" is not a loaded document.`;
  if (UNREADABLE_STATUSES.includes(doc.status) || doc.status === 'skipped') {
    return `${doc.path} could not be read, so it cannot be a source.`;
  }
  if (doc.kind === 'pdf') return pdfSource(doc, submitted);
  if (doc.kind === 'excel') return excelSource(doc, submitted);
  return `${doc.path} is not a PDF or Excel file, so it cannot be a source.`;
}

function pdfSource(doc: DocumentSummary, submitted: SubmittedSource): PdfSource | string {
  const pageCount = doc.pageCount ?? 0;
  if (submitted.page === null) return `${doc.path} is a PDF, so its source needs a page number.`;
  if (submitted.page < 1 || submitted.page > pageCount) {
    return `${doc.path} has ${pageCount === 1 ? '1 page' : `${pageCount} pages`}, so page ${submitted.page} does not exist.`;
  }
  return { kind: 'pdf', document: doc.path, page: submitted.page, quote: cleanQuote(submitted.quote) };
}

function excelSource(doc: DocumentSummary, submitted: SubmittedSource): ExcelSource | string {
  const sheets = doc.sheets.length === 0 ? 'it has no sheets' : `its sheets are ${doc.sheets.join(', ')}`;
  const sheet = submitted.sheet === null ? (doc.sheets.length === 1 ? doc.sheets[0] : undefined) : findSheet(doc.sheets, submitted.sheet);
  if (sheet === undefined) {
    return submitted.sheet === null
      ? `${doc.path} is a workbook, so its source needs a sheet name; ${sheets}.`
      : `${doc.path} has no sheet "${submitted.sheet}"; ${sheets}.`;
  }
  const from = submitted.row_from ?? submitted.row_to;
  const to = submitted.row_to ?? submitted.row_from;
  if (from === null || to === null) return `The source in ${doc.path}, sheet ${sheet}, needs row_from and row_to.`;
  const [first, last] = from <= to ? [from, to] : [to, from];
  if (first < 1) return `Rows start at 1, so row ${first} of ${doc.path}, sheet ${sheet}, does not exist.`;
  return { kind: 'excel', document: doc.path, sheet, rowFrom: first, rowTo: last };
}

/** The sheet as the workbook names it, matching the exact name first and then ignoring case and outer spaces. */
function findSheet(sheets: readonly string[], wanted: string): string | undefined {
  const key = wanted.trim().toLowerCase();
  return sheets.find((sheet) => sheet === wanted) ?? sheets.find((sheet) => sheet.trim().toLowerCase() === key);
}

function cleanQuote(quote: string | null): string | null {
  const text = quote?.replace(/\s+/g, ' ').trim() ?? '';
  if (text === '') return null;
  return text.length <= MAX_QUOTE_CHARS ? text : `${sliceText(text, MAX_QUOTE_CHARS - 1).trimEnd()}…`;
}

function withoutRepeats(sources: Source[]): Source[] {
  const seen = new Set<string>();
  return sources.filter((source) => {
    const key = source.kind === 'pdf' ? `pdf|${source.document}|${source.page}` : `excel|${source.document}|${source.sheet}|${source.rowFrom}|${source.rowTo}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
