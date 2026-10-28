import type { Answer, DocumentSummary, ErrorDetail, ResultTable } from '@atlas/shared';

export interface ScriptStep {
  name: string;
  inputSummary: string;
  resultSummary: string;
  durationMs: number;
  /** A failed or refused call, as the trace shows it; the run carries on after it. */
  failure?: { status: 'error' | 'refused'; error: string };
}

export interface Tokens {
  input: number;
  cached: number;
  output: number;
  reasoning: number;
}

/** One canned run of the agent: tool steps, the streamed text, then an answer or an error. */
export interface Script {
  steps: ScriptStep[];
  /** Streamed first, then withdrawn with answer_reset, as when a guard rejects a draft. */
  draft: string | null;
  /** Milliseconds between streamed chunks. */
  chunkMs: number;
  tokens: Tokens;
  outcome:
    | { type: 'answer'; answer: Omit<Answer, 'table'>; table: Omit<ResultTable, 'resultId'> | null }
    | { type: 'error'; error: ErrorDetail };
}

/** Everything a script may read about the loaded folder. */
export interface ScriptContext {
  question: string;
  documents: DocumentSummary[];
}

const MAX_INPUT_CHARS = 140;

/**
 * Tool arguments as the real server summarises them for the trace: one JSON line without the null
 * fields, cut to about 140 characters with "…". No arguments give an empty string.
 */
export function toolInput(args: Record<string, unknown>): string {
  const line = JSON.stringify(Object.fromEntries(Object.entries(args).filter(([, value]) => value !== null)));
  if (line === '{}') return '';
  return line.length <= MAX_INPUT_CHARS ? line : `${line.slice(0, MAX_INPUT_CHARS - 1).trimEnd()}…`;
}

export function listStep(documents: DocumentSummary[]): ScriptStep {
  const readable = documents.filter((d) => d.status === 'ok').length;
  return {
    name: 'list_documents',
    inputSummary: toolInput({}),
    resultSummary: `${documents.length} files, ${readable} readable`,
    durationMs: 18,
  };
}

/** Names of files Atlas could not search, for "not found" answers. */
export function unreadable(documents: DocumentSummary[]): string[] {
  return documents.filter((d) => ['corrupt', 'encrypted', 'scanned', 'too_large'].includes(d.status)).map((d) => d.name);
}

export const sar = (amount: number) => `SAR ${amount.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
