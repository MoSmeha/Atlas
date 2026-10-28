/** A tool step's input, ready to show. */
export interface StepInput {
  text: string;
  /** SQL, a formula or raw arguments, shown in monospace; anything else reads as plain text. */
  code: boolean;
}

type Args = Record<string, unknown>;
type Describe = (args: Args) => StepInput | null;

/** The server cuts long inputs at about 140 characters and ends them with this. */
const CUT = '…';
const CODE_TOOLS = new Set(['query_tables', 'calculate']);
const SQL = /^\s*(select|with)\s/i;

const plain = (text: string): StepInput => ({ text, code: false });
const code = (text: string): StepInput => ({ text, code: true });
const str = (value: unknown): string | null => (typeof value === 'string' && value.trim() !== '' ? value.trim() : null);
const num = (value: unknown): number | null => (typeof value === 'number' && Number.isFinite(value) ? value : null);

function pages(from: number | null, to: number | null): string | null {
  if (from === null) return null;
  return to === null || to === from ? `page ${from}` : `pages ${from} to ${to}`;
}

function joined(...parts: (string | null)[]): string {
  return parts.filter((part) => part !== null).join(', ');
}

const describers: Record<string, Describe> = {
  list_documents: () => null,
  search_documents: (args) => {
    const query = str(args.query);
    const document = str(args.document);
    if (query === null) return null;
    return plain(document === null ? `"${query}"` : `"${query}" in ${document}`);
  },
  read_pages: (args) => {
    const document = str(args.document);
    return document === null ? null : plain(joined(document, pages(num(args.from), num(args.to))));
  },
  look_at_page: (args) => {
    const document = str(args.document);
    const question = str(args.question);
    if (document === null) return null;
    const where = joined(document, pages(num(args.page), null));
    return plain(question === null ? where : `${where}: ${question}`);
  },
  query_tables: (args) => {
    const sql = str(args.sql);
    return sql === null ? null : code(sql);
  },
  calculate: (args) => {
    const expression = str(args.expression);
    return expression === null ? null : code(expression);
  },
  check_boq_arithmetic: (args) => plain(str(args.table) ?? str(args.document) ?? 'Every BOQ table'),
  extract_schedule: (args) => plain(str(args.document) ?? 'Every document'),
  compare_revisions: (args) => {
    const before = str(args.document_a);
    const after = str(args.document_b);
    return before === null || after === null ? null : plain(`${before} against ${after}`);
  },
  export_table: (args) => {
    const id = str(args.result_id);
    const format = str(args.format);
    if (id === null) return null;
    const as = format === 'xlsx' ? 'Excel' : format === 'csv' ? 'CSV' : format;
    return plain(as === null ? id : `${id} as ${as}`);
  },
};

/**
 * What a step was asked to do, in a reader's words: `"retention" in Contract.pdf` rather than the
 * JSON the server sends. SQL and formulas stay as written, in monospace. Input that is not JSON
 * (or a tool the client does not know) is shown as it came, in monospace only when it looks like code.
 * Nothing to show gives null.
 */
export function describeStepInput(name: string, inputSummary: string): StepInput | null {
  const text = inputSummary.trim();
  if (text === '') return describers[name]?.({}) ?? null;
  const parsed = parseArgs(text);
  if (parsed === null) return CODE_TOOLS.has(name) || SQL.test(text) || /^[{[]/.test(text) ? code(text) : plain(text);
  const describe = describers[name];
  const described = describe ? describe(parsed.args) : null;
  if (described === null) return Object.keys(parsed.args).length === 0 && describe ? null : code(text);
  return parsed.dropped ? { ...described, text: `${described.text} ${CUT}` } : described;
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
