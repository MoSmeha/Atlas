import type { Answer, CellValue, ResultTable, Source } from '@atlas/shared';
import { sliceText } from './text';

/** Characters of answer prose a voice call reads out; a longer answer is cut at a sentence and the rest stays on screen. */
export const MAX_SPOKEN_PROSE = 700;
/** Rows of the attached table a call reads out. */
export const MAX_SPOKEN_ROWS = 5;
/** Sources a call names. */
export const MAX_SPOKEN_SOURCES = 3;
/** The whole text, well inside the 500 tokens the voice service takes per update, even in Arabic. */
export const MAX_SPEECH_CHARS = 1_400;
const MAX_CELL_CHARS = 60;
const MAX_WARNING_CHARS = 160;

interface Phrases {
  /** After prose that was cut short. */
  rest: string;
  table: (rows: number, title: string | null) => string;
  /** Before the rows read out: all of them, or the first few. */
  rows: (shown: number, total: number) => string;
  columns: string;
  sources: (count: number) => string;
  moreSources: (count: number) => string;
  page: (page: number) => string;
  sheet: (sheet: string) => string;
  rowRange: (from: number, to: number) => string;
  unreadable: string;
  note: string;
}

const PHRASES: Record<Answer['language'], Phrases> = {
  en: {
    rest: 'The rest of the answer is on the screen.',
    table: (rows, title) => `The table on the screen${title === null ? '' : `, "${title}",`} has ${rows} ${rows === 1 ? 'row' : 'rows'}.`,
    rows: (shown, total) => (shown === total ? (total === 1 ? 'It reads:' : 'They are:') : `The first ${shown}:`),
    columns: 'Columns:',
    sources: (count) => (count === 1 ? 'Source:' : 'Sources:'),
    moreSources: (count) => `and ${count} more`,
    page: (page) => `page ${page}`,
    sheet: (sheet) => `sheet ${sheet}`,
    rowRange: (from, to) => (from === to ? `row ${from}` : `rows ${from} to ${to}`),
    unreadable: 'Files that could not be read:',
    note: 'Note:',
  },
  ar: {
    rest: 'باقي الإجابة على الشاشة.',
    table: (rows, title) => `على الشاشة جدول${title === null ? '' : ` «${title}»`}، عدد صفوفه ${rows}.`,
    rows: (shown, total) => (shown === total ? 'وهي:' : 'أول الصفوف:'),
    columns: 'الأعمدة:',
    sources: (count) => (count === 1 ? 'المصدر:' : 'المصادر:'),
    moreSources: (count) => `وغيرها (${count})`,
    page: (page) => `صفحة ${page}`,
    sheet: (sheet) => `ورقة ${sheet}`,
    rowRange: (from, to) => (from === to ? `الصف ${from}` : `الصفوف ${from} إلى ${to}`),
    unreadable: 'ملفات تعذّرت قراءتها:',
    note: 'ملاحظة:',
  },
};

/**
 * What a voice call says for a checked answer: its prose without Markdown, cut at a sentence when long, then the
 * attached table's size and first rows, the sources, and the files that could not be read. Every number is the
 * answer's own, written with thousands separators and never rounded. The fixed words follow the answer's language.
 */
export function speechFor(answer: Answer): string {
  const words = PHRASES[answer.language];
  const prose = cutAtSentence(plainText(answer.markdown), MAX_SPOKEN_PROSE);
  const parts = [prose.text];
  if (prose.cut) parts.push(words.rest);
  if (answer.table !== null) parts.push(...describeTable(answer.table, words));
  if (answer.sources.length > 0) parts.push(describeSources(answer.sources, words));
  if (answer.unreadableFiles.length > 0) parts.push(`${words.unreadable} ${answer.unreadableFiles.join(', ')}.`);
  const warning = answer.warnings[0];
  if (warning !== undefined) parts.push(`${words.note} ${clip(warning, MAX_WARNING_CHARS)}`);
  const text = parts.filter((part) => part !== '').join('\n');
  return text.length <= MAX_SPEECH_CHARS ? text : `${sliceText(text, MAX_SPEECH_CHARS - 1).trimEnd()}…`;
}

const FENCED_CODE = /```[\s\S]*?(?:```|$)/g;
/** A Markdown table row or its separator line. */
const TABLE_LINE = /^\|.*\|$|^\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?$/;
const HEADING = /^#{1,6}\s+/;
const QUOTE = /^>\s?/;
const LIST_MARKER = /^(?:[-*+•]|\d{1,2}[.)])\s+/;
const ENDS_SENTENCE = /[.!?؟:;،…]$/;

/**
 * Markdown as plain sentences: tables and code blocks left out; headings, list items and quotes kept as sentences of
 * their own; links, emphasis, inline code and HTML reduced to their text. Underscores inside words, as in file names,
 * stay.
 */
export function plainText(markdown: string): string {
  const paragraphs: string[][] = [[]];
  for (const raw of markdown.replace(/\r\n?/g, '\n').replace(FENCED_CODE, '\n').split('\n')) {
    const line = raw.trim();
    const current = paragraphs.at(-1) ?? [];
    if (line === '') {
      if (current.length > 0) paragraphs.push([]);
      continue;
    }
    if (TABLE_LINE.test(line)) continue;
    const structural = HEADING.test(line) || LIST_MARKER.test(line);
    const text = inline(line.replace(HEADING, '').replace(QUOTE, '').replace(LIST_MARKER, ''));
    if (text === '') continue;
    current.push(structural && !ENDS_SENTENCE.test(text) ? `${text}.` : text);
  }
  return paragraphs
    .map((lines) => lines.join(' '))
    .filter((paragraph) => paragraph !== '')
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function inline(text: string): string {
  return text
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/`([^`]*)`/g, '$1')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/__(.+?)__/g, '$1')
    .replace(/~~(.+?)~~/g, '$1')
    .replace(/(?<![\p{L}\p{N}*])\*(?!\s)(.+?)(?<!\s)\*(?![\p{L}\p{N}*])/gu, '$1')
    .replace(/(?<![\p{L}\p{N}_])_(?!\s)(.+?)(?<!\s)_(?![\p{L}\p{N}_])/gu, '$1')
    .replace(/<[^>]+>/g, '')
    .trim();
}

/** Sentence-ending punctuation followed by a space or the end of the text. */
const SENTENCE_END = /[.!?؟](?=\s|$)/g;

/** The text when it fits; otherwise its sentences up to `max` characters, or the words that fit with "…". */
export function cutAtSentence(text: string, max: number): { text: string; cut: boolean } {
  if (text.length <= max) return { text, cut: false };
  let end = 0;
  for (const match of text.matchAll(SENTENCE_END)) {
    const after = match.index + match[0].length;
    if (after > max) break;
    end = after;
  }
  if (end >= max / 3) return { text: text.slice(0, end).trim(), cut: true };
  const head = sliceText(text, max - 1);
  const space = head.lastIndexOf(' ');
  return { text: `${(space > max / 2 ? head.slice(0, space) : head).trimEnd()}…`, cut: true };
}

function describeTable(table: ResultTable, words: Phrases): string[] {
  const columns = table.columns.flatMap((name, index) => (name.startsWith('_') ? [] : [{ index, label: columnLabel(name) }]));
  const lines = [words.table(table.totalRows, table.title === null || table.title.trim() === '' ? null : clip(table.title, 80))];
  const shown = table.rows.slice(0, MAX_SPOKEN_ROWS);
  if (columns.length === 0 || shown.length === 0) return lines;
  lines.push(`${words.columns} ${columns.map((column) => column.label).join(', ')}.`);
  const rows = shown.map((row) =>
    columns
      .map((column) => spokenCell(row[column.index] ?? null, column.label))
      .filter((cell) => cell !== '')
      .join(', '),
  );
  lines.push(`${words.rows(shown.length, table.totalRows)} ${rows.join('; ')}.`);
  return lines;
}

function describeSources(sources: readonly Source[], words: Phrases): string {
  const named = sources.slice(0, MAX_SPOKEN_SOURCES).map((source) => {
    if (source.kind === 'pdf') return `${source.document}, ${words.page(source.page)}`;
    return `${source.document}, ${words.sheet(source.sheet)}, ${words.rowRange(source.rowFrom, source.rowTo)}`;
  });
  const more = sources.length - named.length;
  return `${words.sources(sources.length)} ${named.join('; ')}${more > 0 ? `; ${words.moreSources(more)}` : ''}.`;
}

/** Labels of columns that hold codes, years or positions, whose numbers read without separators. */
const UNGROUPED_LABEL = /(?:^|[^a-z])(?:year|code|id|no|ref|entry|row|page)(?:[^a-z]|$)/i;
const PLAIN_NUMBER = /^-?\d+(\.\d+)?$/;

function spokenCell(value: CellValue, label: string): string {
  if (value === null) return '';
  if (typeof value === 'number') return spokenNumber(value, !UNGROUPED_LABEL.test(label));
  return clip(value, MAX_CELL_CHARS);
}

/** A number exactly as stored, with thousands separators unless it is a code: 1234567.5 reads 1,234,567.5. */
export function spokenNumber(value: number, group = true): string {
  const text = String(value);
  if (!group || !PLAIN_NUMBER.test(text)) return text;
  const negative = text.startsWith('-');
  const [whole = '', fraction] = (negative ? text.slice(1) : text).split('.');
  const digits = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${negative ? '-' : ''}${digits}${fraction === undefined ? '' : `.${fraction}`}`;
}

/** An SQL name such as item_code reads "Item code"; any other header stays as written. */
function columnLabel(name: string): string {
  if (!/^[a-z][a-z0-9]*(?:_[a-z0-9]+)+$/i.test(name) && !/^[a-z]+$/.test(name)) return clip(name, MAX_CELL_CHARS);
  const words = name.split('_').map((word) => (/^(sar|usd|eur|gbp|aed|vat|boq|id)$/i.test(word) ? word.toUpperCase() : word.toLowerCase()));
  const first = words[0] ?? '';
  return [first.charAt(0).toUpperCase() + first.slice(1), ...words.slice(1)].join(' ');
}

function clip(text: string, max: number): string {
  const line = text.replace(/\s+/g, ' ').trim();
  return line.length <= max ? line : `${sliceText(line, max - 1).trimEnd()}…`;
}
