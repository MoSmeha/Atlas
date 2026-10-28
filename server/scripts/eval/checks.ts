import { basename } from 'node:path';
import type { Answer, CellValue, ResultTable, ToolStep } from '@atlas/shared';
import { foldArabic } from '../../src/domain/language';
import { normalizeDigits } from '../../src/domain/money';
import { tolerance } from '../../src/domain/numberMatch';
import { extractNumbers } from '../../src/domain/numbers';

export interface CheckResult {
  pass: boolean;
  reason: string;
}

/** What happened while the question ran, for checks that look past the answer itself. */
export interface RunTrace {
  steps: ToolStep[];
  exportsDir: string;
}

/** A number found in the answer and how far from it a value may be and still be the same number. */
interface Candidate {
  value: number;
  allowed: number;
}

/** A row the answer table should hold: one or more codes in its cells, and an amount when given. */
export interface ExpectedRow {
  label: string;
  codes: string[];
  amount?: number;
  /** When the row names a file, it must be this one. */
  file?: string;
}

export interface RowMatch {
  matched: ExpectedRow[];
  missing: ExpectedRow[];
  /** Table rows that match no expected row. */
  extra: CellValue[][];
}

const CELL_TOLERANCE = 0.005;

/** Passes when there are no problems; otherwise the problems are the reason. */
export function verdict(problems: string[], okReason: string): CheckResult {
  return problems.length === 0 ? { pass: true, reason: okReason } : { pass: false, reason: problems.join('; ') };
}

export function formatNumber(value: number): string {
  return value.toLocaleString('en-US', { maximumFractionDigits: 2 });
}

/** Every number in the markdown (with the rounding its writing implies) and in the table cells. */
function candidates(answer: Answer): Candidate[] {
  const found = textCandidates(answer.markdown);
  for (const row of answer.table?.rows ?? []) for (const cell of row) found.push(...cellCandidates(cell));
  return found;
}

function textCandidates(text: string): Candidate[] {
  return extractNumbers(text).map((mention) => ({ value: Math.abs(mention.value), allowed: tolerance(mention) }));
}

function cellCandidates(cell: CellValue): Candidate[] {
  if (typeof cell === 'number') return [{ value: Math.abs(cell), allowed: CELL_TOLERANCE + Math.abs(cell) * 1e-12 }];
  if (typeof cell === 'string') return textCandidates(cell);
  return [];
}

function within(candidate: Candidate, expected: number): boolean {
  return Math.abs(candidate.value - Math.abs(expected)) <= candidate.allowed;
}

/** True when the answer writes the number in any format: 1250000, "1,250,000.00", "SAR 1.25M", "١٬٢٥٠٬٠٠٠". Sign is ignored. */
export function hasNumber(answer: Answer, expected: number): boolean {
  return candidates(answer).some((candidate) => within(candidate, expected));
}

/** The expected numbers the answer does not write. */
export function missingNumbers(answer: Answer, expected: readonly number[]): number[] {
  const found = candidates(answer);
  return expected.filter((value) => !found.some((candidate) => within(candidate, value)));
}

/** Lower case, ASCII digits, Arabic letter variants folded, single spaces. */
export function normalizeText(text: string): string {
  return foldArabic(normalizeDigits(text.normalize('NFKC')))
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/** The markdown, the table title, columns and cells, and the unreadable files, as one text. */
export function answerText(answer: Answer): string {
  const table = answer.table;
  const parts = [answer.markdown, ...answer.unreadableFiles];
  if (table !== null) {
    parts.push(table.title ?? '', table.columns.join(' | '));
    for (const row of table.rows) parts.push(row.map((cell) => (cell === null ? '' : String(cell))).join(' | '));
  }
  return parts.join('\n');
}

/** True when the answer (markdown or table) contains the text, ignoring case, spacing and Arabic letter variants. */
export function mentions(answer: Answer, needle: string): boolean {
  return normalizeText(answerText(answer)).includes(normalizeText(needle));
}

/** True when the text holds the code as a whole token: "1.1.05" is not found in "1.1.050" or "21.1.05". */
export function hasCode(text: string, code: string): boolean {
  const escaped = code.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(?<![\\p{L}\\p{N}.])${escaped}(?![\\p{N}]|\\.\\p{N})`, 'iu').test(normalizeDigits(text));
}

/** The codes that appear neither in the markdown nor in the table. */
export function missingCodes(answer: Answer, codes: readonly string[]): string[] {
  const text = answerText(answer);
  return codes.filter((code) => !hasCode(text, code));
}

const MONTHS = [
  ['january', 'jan', 'يناير'],
  ['february', 'feb', 'فبراير'],
  ['march', 'mar', 'مارس'],
  ['april', 'apr', 'أبريل|ابريل'],
  ['may', 'may', 'مايو'],
  ['june', 'jun', 'يونيو'],
  ['july', 'jul', 'يوليو'],
  ['august', 'aug', 'أغسطس|اغسطس'],
  ['september', 'sep|sept', 'سبتمبر'],
  ['october', 'oct', 'أكتوبر|اكتوبر'],
  ['november', 'nov', 'نوفمبر'],
  ['december', 'dec', 'ديسمبر'],
] as const;

/** True when the text writes the ISO date as "1 February 2026", "Feb 1, 2026", "2026-02-01", "01/02/2026" or in Arabic. */
export function textHasDate(text: string, isoDate: string): boolean {
  const [year, month, day] = isoDate.split('-').map(Number);
  if (year === undefined || month === undefined || day === undefined) return false;
  const names = MONTHS[month - 1];
  if (names === undefined) return false;
  const normal = foldArabic(normalizeDigits(text)).toLowerCase();
  const monthName = `(?:${names.map((name) => foldArabic(name)).join('|')})\\.?`;
  const d = `0?${day}(?:st|nd|rd|th)?`;
  const m = `0?${month}`;
  const patterns = [
    `(?<!\\d)${d},?\\s+${monthName},?\\s+${year}(?!\\d)`,
    `${monthName}\\s+${d},?\\s+${year}(?!\\d)`,
    `(?<!\\d)${year}[-/.]${m}[-/.]0?${day}(?!\\d)`,
    `(?<!\\d)0?${day}[-/.]${m}[-/.]${year}(?!\\d)`,
  ];
  return patterns.some((pattern) => new RegExp(pattern, 'iu').test(normal));
}

/** The ISO dates the answer does not write in any usual format. */
export function missingDates(answer: Answer, isoDates: readonly string[]): string[] {
  const text = answerText(answer);
  return isoDates.filter((date) => !textHasDate(text, date));
}

/** Source matching: the file name (any folder, any case), plus the page or sheet when given. */
export function hasSource(answer: Answer, want: { document: string; page?: number; sheet?: string }): boolean {
  return answer.sources.some((source) => {
    if (!sameFile(source.document, want.document)) return false;
    if (want.page !== undefined && (source.kind !== 'pdf' || source.page !== want.page)) return false;
    if (want.sheet !== undefined && (source.kind !== 'excel' || source.sheet.toLowerCase() !== want.sheet.toLowerCase())) return false;
    return true;
  });
}

export function sameFile(path: string, name: string): boolean {
  return basename(path.replaceAll('\\', '/')).toLowerCase() === basename(name.replaceAll('\\', '/')).toLowerCase();
}

/** The answer's sources, short, for a reason: "Contract_Main_Works.pdf p3, Equipment_Imports.xlsx/Regional Supply". */
export function describeSources(answer: Answer): string {
  if (answer.sources.length === 0) return 'no sources';
  return answer.sources
    .map((source) => (source.kind === 'pdf' ? `${basename(source.document)} p${source.page}` : `${basename(source.document)}/${source.sheet}`))
    .join(', ');
}

/** A problem when the answer cites no source on the document (and page, when given). */
export function sourceProblem(answer: Answer, want: { document: string; page?: number; sheet?: string }): string[] {
  if (hasSource(answer, want)) return [];
  const where = want.page !== undefined ? ` page ${want.page}` : want.sheet !== undefined ? ` sheet ${want.sheet}` : '';
  return [`no source on ${want.document}${where} (cited: ${describeSources(answer)})`];
}

/**
 * Matches the table rows to the expected rows, one to one: a row matches when it holds every code of an expected row
 * as a whole token, its amount (when given), and, when the row names one of the files, that row's file.
 */
export function matchRows(table: ResultTable | null, expected: readonly ExpectedRow[]): RowMatch {
  const files = [...new Set(expected.flatMap((row) => (row.file === undefined ? [] : [row.file])))];
  const open = [...expected];
  const extra: CellValue[][] = [];
  for (const row of table?.rows ?? []) {
    const index = open.findIndex((want) => rowMatches(row, want, files));
    if (index === -1) extra.push(row);
    else open.splice(index, 1);
  }
  return { matched: expected.filter((row) => !open.includes(row)), missing: open, extra };
}

function rowMatches(row: CellValue[], want: ExpectedRow, files: readonly string[]): boolean {
  const text = row.map((cell) => (cell === null ? '' : String(cell))).join(' | ');
  if (!want.codes.every((code) => hasCode(text, code))) return false;
  if (want.amount !== undefined && !row.some((cell) => cellCandidates(cell).some((candidate) => within(candidate, want.amount ?? 0)))) {
    return false;
  }
  if (want.file === undefined) return true;
  const named = files.filter((file) => namesFile(text, file));
  return named.length === 0 || named.includes(want.file);
}

/** True when the text names the file, with or without its extension. */
function namesFile(text: string, file: string): boolean {
  const lower = text.toLowerCase();
  const name = basename(file).toLowerCase();
  const stem = name.replace(/\.[a-z0-9]+$/, '');
  return lower.includes(name) || new RegExp(`(?<![\\w.])${stem.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\w])`).test(lower);
}

/** "3 missing (1.1.05, 2.3.02 ...)", at most five labels. */
export function listProblem(what: string, labels: readonly string[]): string[] {
  if (labels.length === 0) return [];
  const shown = labels.slice(0, 5).join(', ');
  return [`${labels.length} ${what} (${shown}${labels.length > 5 ? ', ...' : ''})`];
}

/** The lines of the answer that name the file: markdown lines and table rows. */
export function linesNaming(answer: Answer, file: string): string[] {
  const lines = answerText(answer).split('\n');
  const found: string[] = [];
  lines.forEach((line, index) => {
    if (line.toLowerCase().includes(file.toLowerCase())) found.push(`${line} ${lines[index + 1] ?? ''}`);
  });
  return found;
}
