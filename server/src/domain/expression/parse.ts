import { CalculatorError } from '../CalculatorError';
import { tokenize, type Operator, type Token } from './tokenize';

export const FUNCTIONS = ['sum', 'avg', 'min', 'max', 'count', 'round', 'abs'] as const;
export type FunctionName = (typeof FUNCTIONS)[number];

export type BinaryOperator = '+' | '-' | '*' | '/' | '^';

/** Character offsets of a node in the expression text, so errors can quote the part that failed. */
interface Span {
  from: number;
  to: number;
}

/** A parsed expression. Result ids are lower case (r3); column names are kept as written. */
export type Expr = Span &
  (
    | { type: 'number'; value: number; text: string }
    | { type: 'negate'; operand: Expr }
    | { type: 'percent'; operand: Expr }
    | { type: 'binary'; op: BinaryOperator; left: Expr; right: Expr }
    | { type: 'call'; name: FunctionName; args: Expr[] }
    | { type: 'result'; id: string }
    | { type: 'column'; id: string; column: string }
    | { type: 'cell'; id: string; column: string; index: number }
  );

const ARITY: Record<FunctionName, { min: number; max: number }> = {
  sum: { min: 1, max: Infinity },
  avg: { min: 1, max: Infinity },
  min: { min: 1, max: Infinity },
  max: { min: 1, max: Infinity },
  count: { min: 1, max: 1 },
  round: { min: 1, max: 2 },
  abs: { min: 1, max: 1 },
};

const MAX_DEPTH = 50;
const RESULT_ID = /^r\d+$/i;
const ALLOWED = 'Use plain numbers, saved results such as r3.amount, and the functions sum, avg, min, max, count, round and abs.';

/** Parses arithmetic with + - * / ^ (right-associative), postfix %, unary minus, functions and result references. */
export function parseExpression(text: string): Expr {
  return new Parser(tokenize(text)).parse();
}

class Parser {
  private position = 0;
  private depth = 0;

  constructor(private readonly tokens: Token[]) {}

  parse(): Expr {
    if (this.peek().kind === 'end') throw new CalculatorError('The expression is empty.');
    const expr = this.additive();
    const next = this.peek();
    if (next.kind !== 'end') throw this.unexpected(next);
    return expr;
  }

  private additive(): Expr {
    let left = this.multiplicative();
    for (let op = this.take('+', '-'); op !== null; op = this.take('+', '-')) {
      const right = this.multiplicative();
      left = { type: 'binary', op, left, right, from: left.from, to: right.to };
    }
    return left;
  }

  private multiplicative(): Expr {
    let left = this.unary();
    for (let op = this.take('*', '/'); op !== null; op = this.take('*', '/')) {
      const right = this.unary();
      left = { type: 'binary', op, left, right, from: left.from, to: right.to };
    }
    return left;
  }

  /** Unary minus binds looser than ^, so -2^2 is -4. */
  private unary(): Expr {
    const start = this.peek();
    const sign = this.take('-', '+');
    if (sign === null) return this.power();
    const operand = this.nested(() => this.unary());
    return sign === '-' ? { type: 'negate', operand, from: start.at, to: operand.to } : operand;
  }

  private power(): Expr {
    const base = this.postfix();
    if (this.take('^') === null) return base;
    const exponent = this.nested(() => this.unary());
    return { type: 'binary', op: '^', left: base, right: exponent, from: base.from, to: exponent.to };
  }

  private postfix(): Expr {
    const operand = this.primary();
    const percent = this.peek();
    if (this.take('%') === null) return operand;
    return { type: 'percent', operand, from: operand.from, to: percent.end };
  }

  private primary(): Expr {
    const token = this.next();
    if (token.kind === 'number') return { type: 'number', value: token.value, text: token.text, from: token.at, to: token.end };
    if (token.kind === 'operator' && token.text === '(') {
      const inner = this.nested(() => this.additive());
      const close = this.expect(')');
      return { ...inner, from: token.at, to: close.end };
    }
    if (token.kind === 'name') {
      if (this.isOperator(this.peek(), '(')) return this.call(token);
      if (RESULT_ID.test(token.text)) return this.reference(token);
      throw new CalculatorError(`Unknown name "${token.text}". ${ALLOWED}`);
    }
    throw this.unexpected(token);
  }

  private call(name: Extract<Token, { kind: 'name' }>): Expr {
    const fn = FUNCTIONS.find((candidate) => candidate === name.text.toLowerCase());
    if (fn === undefined) throw new CalculatorError(`Unknown function "${name.text}". ${ALLOWED}`);
    this.expect('(');
    const args: Expr[] = [];
    if (!this.isOperator(this.peek(), ')')) {
      do args.push(this.nested(() => this.additive()));
      while (this.take(',') !== null);
    }
    const close = this.expect(')');
    const { min, max } = ARITY[fn];
    if (args.length < min || args.length > max) throw new CalculatorError(arityMessage(fn));
    return { type: 'call', name: fn, args, from: name.at, to: close.end };
  }

  private reference(name: Extract<Token, { kind: 'name' }>): Expr {
    const id = name.text.toLowerCase();
    if (this.take('.') === null) return { type: 'result', id, from: name.at, to: name.end };
    const column = this.next();
    if (column.kind !== 'name' && column.kind !== 'quoted') {
      throw new CalculatorError(`Write a column name after "${id}.", for example ${id}.amount.`);
    }
    if (this.take('[') === null) return { type: 'column', id, column: column.text, from: name.at, to: column.end };
    const index = this.next();
    if (index.kind !== 'number' || !/^\d+$/.test(index.text)) {
      throw new CalculatorError(`A row index must be a whole number, such as ${id}.${column.text}[0] for the first row.`);
    }
    const close = this.expect(']');
    return { type: 'cell', id, column: column.text, index: index.value, from: name.at, to: close.end };
  }

  private nested(parse: () => Expr): Expr {
    if (++this.depth > MAX_DEPTH) throw new CalculatorError('The expression is nested too deeply. Split it into smaller calculations.');
    try {
      return parse();
    } finally {
      this.depth--;
    }
  }

  private peek(): Token {
    return this.tokens[this.position] ?? this.tokens[this.tokens.length - 1]!;
  }

  private next(): Token {
    const token = this.peek();
    if (token.kind !== 'end') this.position++;
    return token;
  }

  /** Consumes the next token when it is one of the operators. */
  private take<T extends Operator>(...operators: T[]): T | null {
    const token = this.peek();
    if (token.kind !== 'operator' || !operators.includes(token.text as T)) return null;
    this.position++;
    return token.text as T;
  }

  private expect(operator: Operator): Token {
    const token = this.peek();
    if (!this.isOperator(token, operator)) {
      throw new CalculatorError(
        token.kind === 'end'
          ? `The expression ends early: "${operator}" is missing.`
          : `Expected "${operator}" at position ${token.at + 1} but found "${describe(token)}".`,
      );
    }
    this.position++;
    return token;
  }

  private isOperator(token: Token, operator: Operator): boolean {
    return token.kind === 'operator' && token.text === operator;
  }

  private unexpected(token: Token): CalculatorError {
    if (token.kind === 'end') return new CalculatorError('The expression ends early: a number or value is missing.');
    return new CalculatorError(`Unexpected "${describe(token)}" at position ${token.at + 1}.`);
  }
}

function describe(token: Token): string {
  return token.kind === 'end' ? 'end' : token.text;
}

function arityMessage(fn: FunctionName): string {
  switch (fn) {
    case 'round':
      return 'round takes a value and the number of decimal places, for example round(r3.amount[0], 2).';
    case 'abs':
      return 'abs takes one value, for example abs(r3.amount[0] - r4.amount[0]).';
    case 'count':
      return 'count takes one saved result or column, for example count(r3) or count(r3.amount).';
    default:
      return `${fn} needs at least one value, for example ${fn}(r3.amount).`;
  }
}
