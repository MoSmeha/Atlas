export type SqlTokenKind = 'word' | 'identifier' | 'string' | 'comment' | 'space' | 'symbol';

export interface SqlToken {
  /** `word` is a bare keyword, name or number; `identifier` is a name in "double quotes", `backticks` or [brackets]. */
  kind: SqlTokenKind;
  /** The token exactly as written. */
  text: string;
  /** Words as written; quoted names and 'strings' without their quotes and with doubled quotes undone. */
  value: string;
  /** False when a string, quoted name or block comment runs to the end of the text without closing. */
  closed: boolean;
}

const CLOSERS: Record<string, string> = { "'": "'", '"': '"', '`': '`', '[': ']' };

/**
 * Splits SQL into tokens the way SQLite reads it: 'strings' with '' escapes, quoted names, -- and block
 * comments, and words made of ASCII letters, digits, _ and $ or any character above U+007F. Never throws.
 */
export function tokenizeSql(sql: string): SqlToken[] {
  const tokens: SqlToken[] = [];
  let at = 0;
  while (at < sql.length) {
    const token = readToken(sql, at);
    tokens.push(token);
    at += token.text.length;
  }
  return tokens;
}

function readToken(sql: string, at: number): SqlToken {
  const char = sql[at] ?? '';
  if (isSpace(char)) return plain('space', runOf(sql, at, isSpace));
  if (isWordChar(char)) return plain('word', runOf(sql, at, isWordChar));
  if (sql.startsWith('--', at)) {
    const end = sql.indexOf('\n', at);
    return plain('comment', sql.slice(at, end === -1 ? sql.length : end));
  }
  if (sql.startsWith('/*', at)) {
    const end = sql.indexOf('*/', at + 2);
    const text = sql.slice(at, end === -1 ? sql.length : end + 2);
    return { kind: 'comment', text, value: text, closed: end !== -1 };
  }
  const closer = CLOSERS[char];
  if (closer !== undefined) return readQuoted(sql, at, char, closer);
  return plain('symbol', char);
}

/** A quoted string or name; a doubled closing quote stands for one quote, except inside [brackets]. */
function readQuoted(sql: string, at: number, opener: string, closer: string): SqlToken {
  const kind = opener === "'" ? 'string' : 'identifier';
  let value = '';
  let i = at + 1;
  while (i < sql.length) {
    const char = sql[i] ?? '';
    if (char === closer) {
      if (opener !== '[' && sql[i + 1] === closer) {
        value += closer;
        i += 2;
        continue;
      }
      return { kind, text: sql.slice(at, i + 1), value, closed: true };
    }
    value += char;
    i += 1;
  }
  return { kind, text: sql.slice(at), value, closed: false };
}

function plain(kind: SqlTokenKind, text: string): SqlToken {
  return { kind, text, value: text, closed: true };
}

function runOf(sql: string, at: number, test: (char: string) => boolean): string {
  let end = at;
  while (end < sql.length && test(sql[end] ?? '')) end += 1;
  return sql.slice(at, end);
}

/** SQLite's whitespace: space, tab, line feed, vertical tab, form feed, carriage return. */
function isSpace(char: string): boolean {
  return char === ' ' || (char >= '\t' && char <= '\r');
}

function isWordChar(char: string): boolean {
  return /[A-Za-z0-9_$]/.test(char) || char.charCodeAt(0) > 0x7f;
}
