import { CalculatorError } from './CalculatorError';
import { parseExpression, type BinaryOperator, type Expr, type ParsedExpression } from './expression/parse';
import type { CleanValue } from './table';

export { CalculatorError } from './CalculatorError';
export { parseExpression, type Expr, type ParsedExpression } from './expression/parse';

/** Rows of a saved result that an expression can refer to, such as r3. */
export interface ResultData {
  columns: string[];
  rows: CleanValue[][];
}

/** Finds a saved result by its lower-case id, or null when the chat has none with that id. */
export type ResultLookup = (id: string) => ResultData | null;

/** A typed number in the expression. `percent` marks the 15 in 15%. */
export interface LiteralNumber {
  value: number;
  text: string;
  percent: boolean;
}

/** Parses and evaluates an expression such as `sum(r3.amount) * 15%`. */
export function calculate(text: string, lookup: ResultLookup): number {
  return evaluate(parseExpression(text), lookup);
}

/**
 * Evaluates a parsed expression with plain floating point; it never rounds unless round() is used.
 * The result is trimmed to 15 significant digits, which drops binary noise such as 0.30000000000000004.
 * Amounts in different currencies (from a result's currency column) are never added or compared.
 */
export function evaluate(expression: ParsedExpression, lookup: ResultLookup): number {
  const { value } = new Evaluator(expression.text, lookup).amount(expression.root);
  if (Number.isNaN(value)) {
    throw new CalculatorError('The result is not a real number, for example a negative number to a fractional power.');
  }
  if (!Number.isFinite(value)) throw new CalculatorError('The result is too large to compute.');
  return value === 0 ? 0 : Number(value.toPrecision(15));
}

/** Result ids the expression refers to, in order of first use. */
export function resultIds(expr: Expr): string[] {
  const ids = new Set<string>();
  walk(expr, (node) => {
    if (node.type === 'result' || node.type === 'column' || node.type === 'cell') ids.add(node.id);
  });
  return [...ids];
}

/** Numbers typed in the expression, except the decimal places given to round(). */
export function literalNumbers(expr: Expr): LiteralNumber[] {
  const numbers: LiteralNumber[] = [];
  const visit = (node: Expr, percent: boolean): void => {
    if (node.type === 'number') numbers.push({ value: node.value, text: node.text, percent });
    else if (node.type === 'percent') visit(node.operand, true);
    else if (node.type === 'call' && node.name === 'round') visit(node.args[0]!, false);
    else children(node).forEach((child) => visit(child, false));
  };
  visit(expr, false);
  return numbers;
}

function walk(expr: Expr, visit: (node: Expr) => void): void {
  visit(expr);
  for (const child of children(expr)) walk(child, visit);
}

function children(expr: Expr): Expr[] {
  switch (expr.type) {
    case 'negate':
    case 'percent':
      return [expr.operand];
    case 'binary':
      return [expr.left, expr.right];
    case 'call':
      return expr.args;
    default:
      return [];
  }
}

/** A value with the currency it is in, when the rows say. */
interface Amount {
  value: number;
  currency: string | null;
}

type ColumnRef = Extract<Expr, { type: 'column' }>;
type CallExpr = Extract<Expr, { type: 'call' }>;

/** Columns whose values are counts or quantities, which may be summed across currencies. */
const NOT_MONEY = /quantity|qty|count/i;
const PLAIN_NUMBER = /^-?\d+(?:\.\d+)?$/;

class Evaluator {
  constructor(
    private readonly text: string,
    private readonly lookup: ResultLookup,
  ) {}

  amount(expr: Expr): Amount {
    switch (expr.type) {
      case 'number':
        return { value: expr.value, currency: null };
      case 'negate': {
        const operand = this.amount(expr.operand);
        return { value: -operand.value, currency: operand.currency };
      }
      case 'percent': {
        const operand = this.amount(expr.operand);
        return { value: operand.value / 100, currency: operand.currency };
      }
      case 'binary':
        return this.binary(expr.op, this.amount(expr.left), this.amount(expr.right), expr.right);
      case 'call':
        return this.call(expr);
      case 'cell':
        return this.cell(expr.id, expr.column, expr.index);
      case 'column':
        return this.onlyCell(expr);
      case 'result':
        throw new CalculatorError(
          `${expr.id} is a whole result. Use count(${expr.id}) for its number of rows, or a column such as ${expr.id}.amount.`,
        );
    }
  }

  private binary(op: BinaryOperator, left: Amount, right: Amount, divisor: Expr): Amount {
    switch (op) {
      case '+':
        return { value: left.value + right.value, currency: sameCurrency(left, right, 'add') };
      case '-':
        return { value: left.value - right.value, currency: sameCurrency(left, right, 'subtract') };
      case '*': {
        const currency = left.currency !== null && right.currency !== null ? null : (left.currency ?? right.currency);
        return { value: left.value * right.value, currency };
      }
      case '/':
        if (right.value === 0) throw new CalculatorError(`Division by zero: ${this.quote(divisor)} is 0.`);
        return { value: left.value / right.value, currency: right.currency === null ? left.currency : null };
      default:
        if (left.value === 0 && right.value < 0) {
          throw new CalculatorError('Division by zero: 0 raised to a negative power.');
        }
        return { value: left.value ** right.value, currency: null };
    }
  }

  private call(expr: CallExpr): Amount {
    const [first] = expr.args;
    switch (expr.name) {
      case 'count':
        return { value: this.count(first!), currency: null };
      case 'abs': {
        const operand = this.amount(first!);
        return { value: Math.abs(operand.value), currency: operand.currency };
      }
      case 'round': {
        const operand = this.amount(first!);
        const second = expr.args[1];
        const digits = second === undefined ? 0 : this.amount(second).value;
        if (!Number.isInteger(digits) || Math.abs(digits) > 15) {
          throw new CalculatorError('round needs a whole number of decimal places from -15 to 15, for example round(x, 2).');
        }
        return { value: roundTo(operand.value, digits), currency: operand.currency };
      }
      default:
        return this.aggregate(expr);
    }
  }

  /** sum, avg, min and max over columns and single values together. */
  private aggregate(expr: CallExpr): Amount {
    const amounts = expr.args.flatMap((arg) => (arg.type === 'column' ? this.columnAmounts(arg) : [this.amount(arg)]));
    const currencies = [...new Set(amounts.map((amount) => amount.currency).filter((c): c is string => c !== null))];
    if (currencies.length > 1) {
      throw new CalculatorError(
        `${this.quote(expr)} mixes amounts in ${currencies.join(' and ')}. Never add or compare different currencies: ` +
          'query each currency on its own (for example GROUP BY currency) and calculate each one separately.',
      );
    }
    const currency = currencies[0] ?? null;
    const values = amounts.map((amount) => amount.value);
    if (expr.name === 'sum') return { value: sum(values), currency };
    if (values.length === 0) throw new CalculatorError(`${this.quote(expr)} has no numbers to work with.`);
    if (expr.name === 'avg') return { value: sum(values) / values.length, currency };
    const pick = expr.name === 'min' ? Math.min : Math.max;
    return { value: values.reduce((best, value) => pick(best, value)), currency };
  }

  private count(arg: Expr): number {
    if (arg.type === 'result') return this.table(arg.id).rows.length;
    if (arg.type === 'column') {
      const { data, index } = this.column(arg.id, arg.column);
      return data.rows.filter((row) => !isEmpty(row[index] ?? null)).length;
    }
    throw new CalculatorError('count takes one saved result or column, for example count(r3) or count(r3.amount).');
  }

  /** Every number in a column; empty cells are skipped. */
  private columnAmounts(ref: ColumnRef): Amount[] {
    const { data, index, name, currencyIndex } = this.column(ref.id, ref.column);
    const amounts: Amount[] = [];
    data.rows.forEach((row, i) => {
      const value = cellNumber(row[index] ?? null, `${ref.id}.${name}[${i}]`);
      if (value !== null) amounts.push({ value, currency: currencyAt(row, currencyIndex) });
    });
    return amounts;
  }

  private cell(id: string, column: string, index: number): Amount {
    const { data, index: columnIndex, name, currencyIndex } = this.column(id, column);
    const row = data.rows[index];
    const where = `${id}.${name}[${index}]`;
    if (row === undefined) {
      const last = data.rows.length - 1;
      throw new CalculatorError(
        last === -1
          ? `${id} has no rows.`
          : `${id} has ${last + 1} rows, so ${where} does not exist. Row indexes go from 0 (the first row) to ${last}.`,
      );
    }
    const value = cellNumber(row[columnIndex] ?? null, where);
    if (value === null) throw new CalculatorError(`${where} is empty.`);
    return { value, currency: currencyAt(row, currencyIndex) };
  }

  /** A bare column stands for its value only when the result has exactly one row. */
  private onlyCell(ref: ColumnRef): Amount {
    const { data, name } = this.column(ref.id, ref.column);
    if (data.rows.length === 1) return this.cell(ref.id, ref.column, 0);
    if (data.rows.length === 0) throw new CalculatorError(`${ref.id} has no rows.`);
    const column = `${ref.id}.${name}`;
    throw new CalculatorError(
      `${column} has ${data.rows.length} values. Use sum(${column}), avg, min, max or count, or one cell such as ${column}[0].`,
    );
  }

  private column(id: string, column: string) {
    const data = this.table(id);
    let index = data.columns.indexOf(column);
    if (index === -1) index = data.columns.findIndex((name) => name.toLowerCase() === column.toLowerCase());
    if (index === -1) {
      throw new CalculatorError(`${id} has no column "${column}". Its columns are: ${data.columns.join(', ')}.`);
    }
    const name = data.columns[index]!;
    const currencyIndex = NOT_MONEY.test(name) ? -1 : data.columns.findIndex((other) => other.toLowerCase() === 'currency');
    return { data, index, name, currencyIndex: currencyIndex === index ? -1 : currencyIndex };
  }

  private table(id: string): ResultData {
    const data = this.lookup(id);
    if (data === null) {
      throw new CalculatorError(`No saved result with id ${id}. Use an id that a tool returned with its rows, such as r1.`);
    }
    return data;
  }

  private quote(expr: Expr): string {
    return this.text.slice(expr.from, expr.to);
  }
}

function sameCurrency(left: Amount, right: Amount, verb: string): string | null {
  if (left.currency !== null && right.currency !== null && left.currency !== right.currency) {
    throw new CalculatorError(
      `Cannot ${verb} ${left.currency} and ${right.currency} amounts. Never mix currencies: keep each currency separate.`,
    );
  }
  return left.currency ?? right.currency;
}

function isEmpty(value: CleanValue): boolean {
  return value === null || (typeof value === 'string' && value.trim() === '');
}

function cellNumber(value: CleanValue, where: string): number | null {
  if (value === null || isEmpty(value)) return null;
  if (typeof value === 'number') return value;
  const text = value.trim();
  if (PLAIN_NUMBER.test(text)) return Number(text);
  const shown = text.length > 40 ? `${text.slice(0, 40)}...` : text;
  throw new CalculatorError(`${where} is text ("${shown}"), not a number. Leave text out in the query or pick a number.`);
}

function currencyAt(row: CleanValue[], index: number): string | null {
  const value = index === -1 ? null : row[index];
  return typeof value === 'string' && value.trim() !== '' ? value.trim().toUpperCase() : null;
}

/** Neumaier summation, so long columns add up without drift. */
function sum(values: number[]): number {
  let total = 0;
  let compensation = 0;
  for (const value of values) {
    const next = total + value;
    compensation += Math.abs(total) >= Math.abs(value) ? total - next + value : value - next + total;
    total = next;
  }
  return total + compensation;
}

/** Rounds half away from zero on the decimal digits, so round(1.005, 2) is 1.01. */
function roundTo(value: number, digits: number): number {
  const abs = Math.abs(value);
  const shifted = Math.round(Number(`${abs}e${digits}`));
  const rounded =
    String(abs).includes('e') || String(shifted).includes('e')
      ? Math.round(abs * 10 ** digits) / 10 ** digits
      : Number(`${shifted}e${-digits}`);
  return value < 0 ? -rounded : rounded;
}
