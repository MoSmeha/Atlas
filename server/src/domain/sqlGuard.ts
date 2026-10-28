import { tokenizeSql, type SqlToken } from './sqlTokens';

export type SelectCheck = { ok: true; sql: string } | { ok: false; reason: string };

/** Words that change data, settings or files; none may appear outside strings and quoted names. */
const FORBIDDEN = new Set([
  'attach',
  'detach',
  'pragma',
  'insert',
  'update',
  'delete',
  'replace',
  'create',
  'drop',
  'alter',
  'vacuum',
  'reindex',
  'analyze',
  'load_extension',
]);
const WRITES = new Set(['insert', 'update', 'delete', 'replace']);
/** Words that can start the statement that follows a WITH list. */
const MAIN_STATEMENTS = new Set(['select', 'values', 'insert', 'update', 'delete', 'replace']);

/**
 * Checks that SQL is exactly one read-only SELECT (or WITH ... SELECT) before it runs. Keywords inside
 * 'strings' and quoted names are fine, and replace(...) is allowed as the string function. On success
 * returns the statement without comments or the trailing semicolon.
 */
export function validateSelect(sql: string): SelectCheck {
  const tokens = tokenizeSql(sql);
  const open = tokens.find((token) => !token.closed && token.kind !== 'comment');
  if (open) {
    return fail(open.kind === 'string' ? 'A text value in single quotes is never closed.' : 'A quoted name is never closed.');
  }

  const statements = splitStatements(tokens);
  if (statements.length === 0) return fail('The query is empty.');
  if (statements.length > 1) {
    return fail(`Send one statement at a time; this query has ${statements.length} statements separated by semicolons.`);
  }
  const statement = statements[0] ?? [];
  const words = statement.filter((token) => token.kind !== 'space');

  const first = words[0];
  const start = first?.kind === 'word' ? first.value.toLowerCase() : '';
  if (start !== 'select' && start !== 'with') {
    return fail(`Only SELECT queries can run (WITH ... SELECT is fine); this one starts with "${first?.text ?? ''}".`);
  }

  const forbidden = words.find((token, i) => isForbidden(token, words[i + 1]));
  if (forbidden) return fail(forbiddenReason(forbidden, start === 'with'));

  if (start === 'with' && mainStatement(words) !== 'select') {
    return fail('A WITH query must end in a SELECT that reads the rows it defines.');
  }
  return { ok: true, sql: statement.map((token) => token.text).join('').trim() };
}

/** Statements between top-level semicolons, comments turned into spaces and empty statements dropped. */
function splitStatements(tokens: SqlToken[]): SqlToken[][] {
  const statements: SqlToken[][] = [[]];
  for (const token of tokens) {
    if (token.kind === 'symbol' && token.text === ';') statements.push([]);
    else statements.at(-1)?.push(token.kind === 'comment' ? { ...token, kind: 'space', text: ' ', value: ' ' } : token);
  }
  return statements.filter((statement) => statement.some((token) => token.kind !== 'space'));
}

function isForbidden(token: SqlToken, next: SqlToken | undefined): boolean {
  const word = token.value.toLowerCase();
  if (token.kind === 'identifier') return word === 'load_extension';
  if (token.kind !== 'word' || !FORBIDDEN.has(word)) return false;
  return !(word === 'replace' && next?.kind === 'symbol' && next.text === '(');
}

function forbiddenReason(token: SqlToken, inWith: boolean): string {
  const word = token.value.toUpperCase();
  if (word === 'LOAD_EXTENSION') return 'load_extension is not allowed: queries may only read the loaded tables.';
  const quoteHint = ` If ${token.value} is a column name, put it in double quotes.`;
  if (inWith && WRITES.has(word.toLowerCase())) {
    return `A WITH query may only read; this one has ${word}, which changes data.${quoteHint}`;
  }
  return `${word} is not allowed: only read-only SELECT queries can run.${quoteHint}`;
}

/** The first statement word at the top level after the WITH list, lower case; null when there is none. */
function mainStatement(words: SqlToken[]): string | null {
  let depth = 0;
  for (const token of words.slice(1)) {
    if (token.kind === 'symbol' && token.text === '(') depth += 1;
    else if (token.kind === 'symbol' && token.text === ')') depth -= 1;
    else if (depth === 0 && token.kind === 'word' && MAIN_STATEMENTS.has(token.value.toLowerCase())) {
      return token.value.toLowerCase();
    }
  }
  return null;
}

function fail(reason: string): SelectCheck {
  return { ok: false, reason };
}
