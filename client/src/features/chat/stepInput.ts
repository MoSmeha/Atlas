import { isolate } from '../../i18n/bidi';
import type { Language } from '../../i18n/language';
import { type StepInputWords, traceCopy } from './traceCopy';

/** A tool step's input, ready to show. */
export interface StepInput {
  text: string;
  /**
   * `code`: SQL, a formula or raw arguments, in monospace, left to right. `words`: the client's own line in the
   * interface language, so it follows the page's direction. `raw`: plain text as the server sent it, in its own
   * direction.
   */
  kind: 'code' | 'words' | 'raw';
}

type Args = Record<string, unknown>;
type Describe = (args: Args, say: StepInputWords) => StepInput | null;

/** The server cuts long inputs at about 140 characters and ends them with this. */
const CUT = '…';
const CODE_TOOLS = new Set(['query_tables', 'calculate']);
const SQL = /^\s*(select|with)\s/i;

const plain = (text: string): StepInput => ({ text, kind: 'words' });
const code = (text: string): StepInput => ({ text, kind: 'code' });
const raw = (text: string): StepInput => ({ text, kind: 'raw' });
const str = (value: unknown): string | null => (typeof value === 'string' && value.trim() !== '' ? value.trim() : null);
const num = (value: unknown): number | null => (typeof value === 'number' && Number.isFinite(value) ? value : null);

/**
 * A query, question or file name, isolated so it keeps its own direction inside the line, in either
 * language, and its neighbours, such as the quotes or ", page 3", stay in place.
 */
function words(value: unknown): string | null {
  const text = str(value);
  return text === null ? null : isolate(text);
}

function pages(say: StepInputWords, from: number | null, to: number | null): string | null {
  if (from === null) return null;
  return to === null || to === from ? say.page(from) : say.pages(from, to);
}

function joined(say: StepInputWords, ...parts: (string | null)[]): string {
  return parts.filter((part) => part !== null).join(say.separator);
}

const describers: Record<string, Describe> = {
  list_documents: () => null,
  search_documents: (args, say) => {
    const query = words(args.query);
    const document = words(args.document);
    if (query === null) return null;
    return plain(document === null ? say.quoted(query) : say.within(query, document));
  },
  read_pages: (args, say) => {
    const document = words(args.document);
    return document === null ? null : plain(joined(say, document, pages(say, num(args.from), num(args.to))));
  },
  look_at_page: (args, say) => {
    const document = words(args.document);
    const question = words(args.question);
    if (document === null) return null;
    const where = joined(say, document, pages(say, num(args.page), null));
    return plain(question === null ? where : say.asked(where, question));
  },
  query_tables: (args) => {
    const sql = str(args.sql);
    return sql === null ? null : code(sql);
  },
  calculate: (args) => {
    const expression = str(args.expression);
    return expression === null ? null : code(expression);
  },
  check_boq_arithmetic: (args, say) => plain(words(args.table) ?? words(args.document) ?? say.everyBoqTable),
  extract_schedule: (args, say) => plain(words(args.document) ?? say.everyDocument),
  compare_revisions: (args, say) => {
    const before = words(args.document_a);
    const after = words(args.document_b);
    return before === null || after === null ? null : plain(say.against(before, after));
  },
  export_table: (args, say) => {
    const id = str(args.result_id);
    const format = str(args.format);
    if (id === null) return null;
    const as = format === 'xlsx' ? 'Excel' : format === 'csv' ? 'CSV' : format;
    return plain(as === null ? id : say.exportAs(isolate(id), as));
  },
};

/**
 * What a step was asked to do, in a reader's words: `"retention" in Contract.pdf` rather than the
 * JSON the server sends. SQL and formulas stay as written, in monospace. Input that is not JSON
 * (or a tool the client does not know) is shown as it came, in monospace only when it looks like code.
 * Nothing to show gives null.
 */
export function describeStepInput(name: string, inputSummary: string, language: Language = 'en'): StepInput | null {
  const say = traceCopy[language].input;
  const text = inputSummary.trim();
  if (text === '') return describers[name]?.({}, say) ?? null;
  const parsed = parseArgs(text);
  if (parsed === null) return CODE_TOOLS.has(name) || SQL.test(text) || /^[{[]/.test(text) ? code(text) : raw(text);
  const describe = describers[name];
  const described = describe ? describe(parsed.args, say) : null;
  if (described === null) return Object.keys(parsed.args).length === 0 && describe ? null : code(text);
  return parsed.dropped ? { ...described, text: `${described.text} ${CUT}` } : described;
}

/** The direction to show an input in: code left to right, the server's text in its own, the client's line the page's. */
export function stepInputDir(input: StepInput): 'ltr' | 'auto' | undefined {
  return input.kind === 'code' ? 'ltr' : input.kind === 'raw' ? 'auto' : undefined;
}

/**
 * Reads the JSON arguments, mending an input the server cut short: a cut inside a string closes
 * that string with "…"; a cut anywhere else drops the unfinished field (`dropped`).
 */
function parseArgs(text: string): { args: Args; dropped: boolean } | null {
  if (!text.startsWith('{')) return null;
  if (!text.endsWith(CUT)) {
    const args = objectFrom(text);
    return args && { args, dropped: false };
  }
  const base = withoutDanglingEscape(text.slice(0, -CUT.length));
  const closed = objectFrom(`${base}${CUT}"}`);
  if (closed) return { args: closed, dropped: false };
  const comma = base.lastIndexOf(',');
  const shortened = comma === -1 ? null : objectFrom(`${base.slice(0, comma)}}`);
  return shortened && { args: shortened, dropped: true };
}

function objectFrom(json: string): Args | null {
  try {
    const value: unknown = JSON.parse(json);
    return value !== null && typeof value === 'object' && !Array.isArray(value) ? (value as Args) : null;
  } catch {
    return null;
  }
}

/** A cut right after a backslash would leave an escape with nothing to escape. */
function withoutDanglingEscape(text: string): string {
  const slashes = text.length - text.replace(/\\+$/, '').length;
  return slashes % 2 === 1 ? text.slice(0, -1) : text;
}
