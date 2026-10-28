import { describe, expect, it } from 'vitest';
import {
  calculate,
  CalculatorError,
  literalNumbers,
  parseExpression,
  resultIds,
  type ResultData,
} from '../../src/domain/calculator';

const results: Record<string, ResultData> = {
  r2: { columns: ['item_code', 'rate'], rows: [['A1', 100], ['A2', 250.5], ['A3', null]] },
  r3: {
    columns: ['item_code', 'amount', 'quantity'],
    rows: [
      ['C-01', 48000000, 10],
      ['C-02', 250000, 4],
      ['C-03', null, 2],
    ],
  },
  r4: { columns: ['total'], rows: [[1500000]] },
  r5: { columns: ['note', 'amount'], rows: [['Included', 'Included'], ['Firm', '1200']] },
  r6: {
    columns: ['item_code', 'amount', 'currency', 'quantity'],
    rows: [
      ['P-1', 1000, 'SAR', 3],
      ['P-2', 400, 'USD', 5],
    ],
  },
  r7: { columns: ['amount', 'currency'], rows: [[900, 'SAR']] },
  r8: { columns: ['amount', 'currency'], rows: [[300, 'usd']] },
  r9: { columns: ['amount'], rows: [] },
};

const lookup = (id: string): ResultData | null => results[id] ?? null;
const calc = (text: string): number => calculate(text, lookup);

function failure(text: string): string {
  try {
    calc(text);
  } catch (error) {
    expect(error).toBeInstanceOf(CalculatorError);
    return (error as Error).message;
  }
  throw new Error(`Expected "${text}" to fail`);
}

describe('calculate: arithmetic', () => {
  it('follows operator precedence and parentheses', () => {
    expect(calc('2 + 3 * 4')).toBe(14);
    expect(calc('(2 + 3) * 4')).toBe(20);
    expect(calc('10 - 4 - 3')).toBe(3);
    expect(calc('100 / 10 / 5')).toBe(2);
    expect(calc('2 * 3 ^ 2')).toBe(18);
  });

  it('makes ^ right-associative and binds unary minus looser than ^', () => {
    expect(calc('2 ^ 3 ^ 2')).toBe(512);
    expect(calc('-2 ^ 2')).toBe(-4);
    expect(calc('(-2) ^ 2')).toBe(4);
    expect(calc('2 ^ -1')).toBe(0.5);
    expect(calc('2 ** 3')).toBe(8);
  });

  it('handles unary minus and plus', () => {
    expect(calc('-5 + 3')).toBe(-2);
    expect(calc('3 - -2')).toBe(5);
    expect(calc('--4')).toBe(4);
    expect(calc('+7')).toBe(7);
    expect(calc('-(2 + 3) * 2')).toBe(-10);
  });

  it('reads % as percent', () => {
    expect(calc('15%')).toBe(0.15);
    expect(calc('48250000 * 15%')).toBe(7237500);
    expect(calc('200 * (1 + 15%)')).toBe(230);
  });

  it('reads decimals and keeps results exact without rounding', () => {
    expect(calc('.5 + 0.25')).toBe(0.75);
    expect(calc('10 / 3')).toBe(3.33333333333333);
    expect(calc('1234567.891 * 3')).toBe(3703703.673);
  });

  it('drops binary floating-point noise', () => {
    expect(calc('0.1 + 0.2')).toBe(0.3);
    expect(calc('1.1 * 1.1')).toBe(1.21);
  });

  it('ignores whitespace and newlines', () => {
    expect(calc(' 1 +\n2\t* 3 ')).toBe(7);
  });
});

describe('calculate: functions', () => {
  it('sums, averages and finds min and max of values', () => {
    expect(calc('sum(1, 2, 3.5)')).toBe(6.5);
    expect(calc('avg(2, 4, 9)')).toBe(5);
    expect(calc('min(4, -2, 7)')).toBe(-2);
    expect(calc('max(4, -2, 7)')).toBe(7);
  });

  it('rounds half away from zero, only when asked', () => {
    expect(calc('round(2.5)')).toBe(3);
    expect(calc('round(-2.5)')).toBe(-3);
    expect(calc('round(1.005, 2)')).toBe(1.01);
    expect(calc('round(1234.5678, 1)')).toBe(1234.6);
    expect(calc('round(48251234, -3)')).toBe(48251000);
    expect(calc('round(10 / 3, 4)')).toBe(3.3333);
  });

  it('takes absolute values', () => {
    expect(calc('abs(250 - 1000)')).toBe(750);
  });

  it('accepts upper-case function names', () => {
    expect(calc('SUM(1, 2) + Max(3, 4)')).toBe(7);
  });

  it('checks the number of arguments', () => {
    expect(failure('round(1, 2, 3)')).toMatch(/round takes a value and the number of decimal places/);
    expect(failure('abs()')).toMatch(/abs takes one value/);
    expect(failure('sum()')).toMatch(/sum needs at least one value/);
    expect(failure('round(1.5, 0.5)')).toMatch(/whole number of decimal places/);
  });
});

describe('calculate: saved results', () => {
  it('aggregates a column and skips empty cells', () => {
    expect(calc('sum(r3.amount)')).toBe(48250000);
    expect(calc('avg(r2.rate)')).toBe(175.25);
    expect(calc('max(r3.quantity)')).toBe(10);
    expect(calc('min(r3.quantity)')).toBe(2);
  });

  it('counts rows and filled cells', () => {
    expect(calc('count(r3)')).toBe(3);
    expect(calc('count(r3.amount)')).toBe(2);
    expect(calc('count(r3.item_code)')).toBe(3);
    expect(calc('count(r9)')).toBe(0);
  });

  it('reads one cell by its 0-based row index', () => {
    expect(calc('r3.amount[0]')).toBe(48000000);
    expect(calc('r3.amount[1] * 2')).toBe(500000);
    expect(calc('r2.rate[1] - r2.rate[0]')).toBe(150.5);
  });

  it('lets a one-row result stand for its value', () => {
    expect(calc('r4.total * 15%')).toBe(225000);
  });

  it('mixes columns and values inside one function', () => {
    expect(calc('sum(r3.amount, r4.total, 1000)')).toBe(49751000);
  });

  it('matches column names and result ids without regard to case', () => {
    expect(calc('sum(R3.Amount)')).toBe(48250000);
    expect(calc('sum(r3."amount")')).toBe(48250000);
  });

  it('reads plain numbers stored as text', () => {
    expect(calc('r5.amount[1] + 1')).toBe(1201);
  });

  it('sums an empty column to 0 but refuses avg, min and max of nothing', () => {
    expect(calc('sum(r9.amount)')).toBe(0);
    expect(failure('avg(r9.amount)')).toMatch(/has no numbers/);
  });
});

describe('calculate: currencies', () => {
  it('refuses to sum a column that mixes currencies', () => {
    expect(failure('sum(r6.amount)')).toMatch(/mixes amounts in SAR and USD/);
    expect(failure('max(r6.amount)')).toMatch(/Never add or compare different currencies/);
  });

  it('refuses to add or subtract amounts in different currencies', () => {
    expect(failure('r7.amount + r8.amount')).toMatch(/Cannot add SAR and USD amounts/);
    expect(failure('r6.amount[0] - r6.amount[1]')).toMatch(/Cannot subtract SAR and USD amounts/);
    expect(failure('sum(r7.amount, r8.amount)')).toMatch(/mixes amounts in SAR and USD/);
  });

  it('allows one currency, scaling by plain numbers, and quantities across currencies', () => {
    expect(calc('r6.amount[0] + r7.amount')).toBe(1900);
    expect(calc('r8.amount * 3.75')).toBe(1125);
    expect(calc('sum(r6.quantity)')).toBe(8);
    expect(calc('r7.amount / r8.amount')).toBe(3);
  });
});

describe('calculate: errors', () => {
  it('refuses division by zero and names the divisor', () => {
    expect(failure('5 / 0')).toBe('Division by zero: 0 is 0.');
    expect(failure('100 / (r2.rate[0] - 100)')).toBe('Division by zero: (r2.rate[0] - 100) is 0.');
    expect(failure('0 ^ -1')).toMatch(/Division by zero/);
  });

  it('refuses results that are not real or finite numbers', () => {
    expect(failure('(-8) ^ 0.5')).toMatch(/not a real number/);
    expect(failure('10 ^ 400')).toMatch(/too large/);
  });

  it('names unknown identifiers and functions', () => {
    expect(failure('x + 1')).toMatch(/^Unknown name "x"\./);
    expect(failure('pi * 2')).toMatch(/Unknown name "pi"/);
    expect(failure('sqrt(4)')).toMatch(/^Unknown function "sqrt"/);
  });

  it('explains unknown results, columns and rows', () => {
    expect(failure('sum(r42.amount)')).toMatch(/No saved result with id r42/);
    expect(failure('sum(r3.amt)')).toBe('r3 has no column "amt". Its columns are: item_code, amount, quantity.');
    expect(failure('r3.amount[3]')).toMatch(/r3 has 3 rows, so r3.amount\[3\] does not exist/);
    expect(failure('r9.amount[0]')).toBe('r9 has no rows.');
    expect(failure('r3.amount[2]')).toBe('r3.amount[2] is empty.');
  });

  it('asks for an aggregate or a cell when a column has many rows', () => {
    expect(failure('r3.amount + 1')).toMatch(/r3.amount has 3 values. Use sum\(r3.amount\)/);
    expect(failure('r3 + 1')).toMatch(/r3 is a whole result/);
    expect(failure('count(5)')).toMatch(/count takes one saved result or column/);
  });

  it('refuses text cells instead of skipping them', () => {
    expect(failure('sum(r5.amount)')).toMatch(/r5.amount\[0\] is text \("Included"\), not a number/);
  });

  it('requires plain numbers', () => {
    expect(failure('1,250,000 + 1')).toMatch(/thousands comma/);
    expect(failure('sum(100,200)')).toMatch(/thousands comma/);
    expect(failure('1e6')).toMatch(/not a plain number/);
    expect(failure('1.2.3')).toMatch(/not a plain number/);
    expect(failure('1 250')).toMatch(/Unexpected "250"/);
    expect(calc('sum(100, 200)')).toBe(300);
    expect(calc('round(5.126,2)')).toBe(5.13);
  });

  it('reports syntax errors in plain words', () => {
    expect(failure('')).toBe('The expression is empty.');
    expect(failure('2 +')).toMatch(/ends early/);
    expect(failure('(2 + 3')).toMatch(/"\)" is missing/);
    expect(failure('2 3')).toMatch(/Unexpected "3" at position 3/);
    expect(failure('r3.')).toMatch(/Write a column name after "r3\."/);
    expect(failure('r3.amount[-1]')).toMatch(/row index must be a whole number/);
    expect(failure('r3.amount[0.5]')).toMatch(/row index must be a whole number/);
    expect(failure('sum(r3."amount)')).toMatch(/is not closed/);
  });

  it('refuses very long or deeply nested expressions', () => {
    expect(failure('1+'.repeat(1500) + '1')).toMatch(/too long/);
    expect(failure('('.repeat(60) + '1' + ')'.repeat(60))).toMatch(/nested too deeply/);
    expect(failure('-'.repeat(60) + '1')).toMatch(/nested too deeply/);
  });
});

describe('calculate: injection attempts', () => {
  it.each([
    'process.exit()',
    'process.exit(1)',
    'require("fs")',
    'constructor.constructor("return process")()',
    'globalThis',
    'this',
    '__proto__',
    'eval("1+1")',
    'Function("return 1")()',
    '1; process.exit()',
    '`1`',
    '[].map',
    '{}',
    'a = 1',
    '1 + 1 // comment',
    'r3.amount[0] && 1',
  ])('rejects %s', (text) => {
    expect(() => calc(text)).toThrow(CalculatorError);
  });

  it('does not reach object internals through column names', () => {
    expect(failure('r3.constructor[0]')).toMatch(/r3 has no column "constructor"/);
    expect(failure('sum(r3.__proto__)')).toMatch(/r3 has no column "__proto__"/);
    expect(failure('count(r3."toString")')).toMatch(/r3 has no column "toString"/);
  });
});

describe('resultIds and literalNumbers', () => {
  it('lists the results an expression uses, once each', () => {
    const { root } = parseExpression('sum(r3.amount) + r3.amount[0] - count(r2) + R4.total');
    expect(resultIds(root)).toEqual(['r3', 'r2', 'r4']);
  });

  it('lists typed numbers, marking percentages and skipping round digits', () => {
    const { root } = parseExpression('round(48250000 * 15% + 2.5, 2) - r3.amount[1]');
    expect(literalNumbers(root)).toEqual([
      { value: 48250000, text: '48250000', percent: false },
      { value: 15, text: '15', percent: true },
      { value: 2.5, text: '2.5', percent: false },
    ]);
  });
});
