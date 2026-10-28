import { CalculatorError } from '../CalculatorError';

export type Operator = '+' | '-' | '*' | '/' | '^' | '%' | '(' | ')' | ',' | '.' | '[' | ']';

/** One piece of an expression; `at` and `end` are character offsets into the text. */
export type Token =
  | { kind: 'number'; value: number; text: string; at: number; end: number }
  | { kind: 'name'; text: string; at: number; end: number }
  | { kind: 'quoted'; text: string; at: number; end: number }
  | { kind: 'operator'; text: Operator; at: number; end: number }
  | { kind: 'end'; at: number; end: number };

export const MAX_EXPRESSION_LENGTH = 2000;

const NUMBER = /\d+(?:\.\d+)?|\.\d+/y;
const NAME = /[A-Za-z_][A-Za-z0-9_]*/y;
const GROUPED = /,\d{3}(?!\d)/y;
const OPERATORS = new Set<string>(['+', '-', '*', '/', '^', '%', '(', ')', ',', '.', '[', ']']);

/** Splits an expression into tokens. Numbers must be plain: no thousands commas, spaces, letters or exponents. */
export function tokenize(text: string): Token[] {
  if (text.length > MAX_EXPRESSION_LENGTH) {
    throw new CalculatorError(`The expression is too long. Keep it under ${MAX_EXPRESSION_LENGTH} characters.`);
  }
  const tokens: Token[] = [];
  let i = 0;
  while (i < text.length) {
    const ch = text[i] ?? '';
    if (/\s/.test(ch)) {
      i++;
      continue;
    }
    const number = matchAt(NUMBER, text, i);
    if (number !== null) {
      const end = i + number.length;
      checkPlainNumber(text, number, end);
      tokens.push({ kind: 'number', value: Number(number), text: number, at: i, end });
      i = end;
      continue;
    }
    const name = matchAt(NAME, text, i);
    if (name !== null) {
      tokens.push({ kind: 'name', text: name, at: i, end: i + name.length });
      i += name.length;
      continue;
    }
    if (ch === '"') {
      const close = text.indexOf('"', i + 1);
      if (close === -1) throw new CalculatorError(`A quoted column name that starts at position ${i + 1} is not closed.`);
      tokens.push({ kind: 'quoted', text: text.slice(i + 1, close), at: i, end: close + 1 });
      i = close + 1;
      continue;
    }
    if (ch === '*' && text[i + 1] === '*') {
      tokens.push({ kind: 'operator', text: '^', at: i, end: i + 2 });
      i += 2;
      continue;
    }
    if (OPERATORS.has(ch)) {
      tokens.push({ kind: 'operator', text: ch as Operator, at: i, end: i + 1 });
      i++;
      continue;
    }
    throw new CalculatorError(
      `Unexpected character "${ch}" at position ${i + 1}. Use plain numbers, + - * / ^ %, parentheses, ` +
        'saved results such as r3.amount, and the functions sum, avg, min, max, count, round and abs.',
    );
  }
  tokens.push({ kind: 'end', at: text.length, end: text.length });
  return tokens;
}

function matchAt(pattern: RegExp, text: string, at: number): string | null {
  pattern.lastIndex = at;
  return pattern.exec(text)?.[0] ?? null;
}

/** Rejects 1,250,000 and 1e6, which would otherwise read as several numbers or a name. */
function checkPlainNumber(text: string, number: string, end: number): void {
  if (matchAt(GROUPED, text, end) !== null) {
    throw new CalculatorError(
      `"${text.slice(end - number.length, end + 4)}" looks like a number with a thousands comma. ` +
        'Write numbers without commas (1250000), and put a space after the commas between function arguments.',
    );
  }
  const next = text[end] ?? '';
  if (/[A-Za-z_.]/.test(next)) {
    throw new CalculatorError(
      `"${number}${next}" is not a plain number. Write numbers like 1250000 or 0.15, without letters or exponents.`,
    );
  }
}
