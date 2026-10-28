import type { CellValue, DocumentSummary, ResultTable, Source, ToolStep, Usage } from '@atlas/shared';

/** Rows the CLI prints before "... N more rows". */
export const TABLE_ROWS = 20;
/** Widest a table cell gets before it is cut with "…". */
export const MAX_CELL_WIDTH = 40;

const PLAIN_NUMBER = /^-?\d+(\.\d+)?$/;
/** Columns of codes, years or positions, whose numbers get no thousands separators. */
const UNGROUPED_LABEL = /(?:^|[^a-z])(?:year|code|id|no|ref|entry|row|page)(?:[^a-z]|$)/i;
const count = new Intl.NumberFormat('en-US');

/** A number exactly as it came, never rounded, with thousands separators unless `group` is false. */
export function formatNumber(value: number, group = true): string {
  const text = String(value);
  if (!group || !PLAIN_NUMBER.test(text)) return text;
  const negative = text.startsWith('-');
  const [whole = '', fraction] = (negative ? text.slice(1) : text).split('.');
  const digits = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${negative ? '-' : ''}${digits}${fraction === undefined ? '' : `.${fraction}`}`;
}

/** "120 ms" under a second, "14.2 s" under a minute, "1 min 5 s" from there. */
export function formatDuration(ms: number): string {
  const safe = Math.max(0, ms);
  if (safe < 1000) return `${Math.round(safe)} ms`;
  const tenths = Math.round(safe / 100);
  if (tenths < 600) return `${(tenths / 10).toFixed(1)} s`;
  const seconds = Math.round(safe / 1000);
  return `${Math.floor(seconds / 60)} min ${seconds % 60} s`;
}

/** "$0.042" under a dollar, "$1.24" from a dollar, "< $0.001" for less than a tenth of a cent. */
export function formatCost(usd: number): string {
  if (usd > 0 && usd < 0.0005) return '< $0.001';
  return `$${usd.toFixed(usd >= 0.9995 ? 2 : 3)}`;
}

/** "gpt-6-astra | 23,456 input tokens (12,000 cached), 1,234 output | $0.084 | 14.2 s". */
export function formatUsage(usage: Usage): string {
  const cached = usage.cachedInputTokens > 0 ? ` (${count.format(usage.cachedInputTokens)} cached)` : '';
  const tokens = `${count.format(usage.inputTokens)} input tokens${cached}, ${count.format(usage.outputTokens)} output`;
  return [usage.model, tokens, formatCost(usage.costUsd), formatDuration(usage.durationMs)].join(' | ');
}

/** "> query_tables  SELECT ... (120 ms)", with the reason when the step failed or was refused. */
export function formatStep(step: ToolStep): string {
  const input = stepInput(step.inputSummary);
  const head = input === '' ? `> ${step.name}` : `> ${step.name}  ${input}`;
  const time = step.durationMs === null ? '' : ` (${formatDuration(step.durationMs)})`;
  const failed = step.status === 'error' || step.status === 'refused';
  const reason = failed ? `\n    ${step.status === 'refused' ? 'refused' : 'failed'}: ${oneLine(step.error ?? 'no reason given')}` : '';
  return `${head}${time}${reason}`;
}

/**
 * A step's JSON arguments as a reader sees them: SQL, a formula or a lone argument shown as it is, anything else as
 * "name: value" pairs. Arguments the server cut short (ending in "…") are mended; text that is not JSON is shown raw.
 */
export function stepInput(summary: string): string {
  const text = summary.trim();
  const args = parseArguments(text);
  if (args === null) return text;
  const fields = Object.entries(args).filter(([, value]) => value !== null && value !== '');
  const code = args.sql ?? args.expression;
  const only = typeof code === 'string' ? code : fields.length === 1 ? fields[0]?.[1] : undefined;
  if (typeof only === 'string') return oneLine(only);
  return fields.map(([name, value]) => `${name}: ${typeof value === 'string' ? value : JSON.stringify(value)}`).join(', ');
}

/** A result table as aligned plain-text columns: numbers right-aligned, the first `maxRows` rows, then a count of the rest. */
export function formatTable(table: Pick<ResultTable, 'title' | 'columns' | 'rows' | 'totalRows'>, maxRows = TABLE_ROWS): string {
  const shown = table.rows.slice(0, maxRows);
  const numeric = table.columns.map((_, i) => shown.length > 0 && shown.every((row) => isNumberOrEmpty(row[i] ?? null)));
  const cells = shown.map((row) => table.columns.map((label, i) => cell(row[i] ?? null, !UNGROUPED_LABEL.test(label))));
  const header = table.columns.map((label) => cut(oneLine(label)));
  const widths = header.map((label, i) => Math.max(label.length, ...cells.map((row) => row[i]?.length ?? 0)));
  const line = (values: string[]) =>
    values.map((value, i) => (numeric[i] ? value.padStart(widths[i] ?? 0) : value.padEnd(widths[i] ?? 0))).join('  ').trimEnd();

  const lines = [line(header), widths.map((width) => '-'.repeat(width)).join('  '), ...cells.map(line)];
  if (table.title !== null && table.title.trim() !== '') lines.unshift(oneLine(table.title));
  const more = Math.max(0, table.totalRows - shown.length);
  if (more > 0) lines.push(`... ${count.format(more)} more ${more === 1 ? 'row' : 'rows'}`);
  return lines.join('\n');
}

/** Numbered sources: "[1] BOQ_Phase1_Rev0.xlsx, sheet Bill 2, rows 14-18" or "[2] Contract.pdf, page 3: "quote"". */
export function formatSources(sources: readonly Source[]): string[] {
  return sources.map((source, i) => `[${i + 1}] ${sourcePlace(source)}`);
}

function sourcePlace(source: Source): string {
  if (source.kind === 'excel') {
    const rows = source.rowFrom === source.rowTo ? `row ${source.rowFrom}` : `rows ${source.rowFrom}-${source.rowTo}`;
    return `${source.document}, sheet ${source.sheet}, ${rows}`;
  }
  const quote = source.quote === null || source.quote.trim() === '' ? '' : `: "${cut(oneLine(source.quote), 80)}"`;
  return `${source.document}, page ${source.page}${quote}`;
}

/** One line per file that could not be read fully, names aligned, or nothing when every file read cleanly. */
export function formatProblems(documents: readonly DocumentSummary[]): string[] {
  const problems = documents.filter((document) => document.status !== 'ok');
  if (problems.length === 0) return [];
  const width = Math.max(...problems.map((document) => document.path.length));
  const files = problems.length === 1 ? '1 file' : `${problems.length} files`;
  return [
    `${files} of ${documents.length} could not be read fully:`,
    ...problems.map((document) => {
      const detail = document.statusDetail === null ? '' : ` - ${oneLine(document.statusDetail)}`;
      return `  ${document.path.padEnd(width)}  ${document.status.replace('_', ' ')}${detail}`;
    }),
  ];
}

function cell(value: CellValue, group: boolean): string {
  if (value === null) return '';
  return cut(typeof value === 'number' ? formatNumber(value, group) : oneLine(value));
}

function isNumberOrEmpty(value: CellValue): boolean {
  return value === null || typeof value === 'number';
}

function cut(text: string, max = MAX_CELL_WIDTH): string {
  return text.length <= max ? text : `${text.slice(0, max - 1).trimEnd()}…`;
}

function oneLine(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

/** The arguments object, closing a string the server cut short with "…"; null when it is not a JSON object. */
function parseArguments(text: string): Record<string, unknown> | null {
  if (!text.startsWith('{')) return null;
  return objectFrom(text) ?? (text.endsWith('…') ? objectFrom(`${text}"}`) : null);
}

function objectFrom(json: string): Record<string, unknown> | null {
  try {
    const value: unknown = JSON.parse(json);
    return value !== null && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}
