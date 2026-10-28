import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { Session } from '../../../src/application/session/Session';
import { calculate } from '../../../src/application/tools/calculate';
import { tools } from '../../../src/application/tools/registry';
import { ToolError } from '../../../src/application/tools/Tool';
import { makeToolContext } from '../../fakes/toolContext';

function setup() {
  const session = new Session('s1');
  const save = (columns: string[], rows: (string | number | null)[][]) =>
    session.saveResult({ title: null, columns, rows, sources: [], tool: 'query_tables', detail: null });
  save(['item_code', 'rate'], [['A1', 100]]);
  save(['item_code', 'rate'], [['A1', 112.5]]);
  save(
    ['item_code', 'amount'],
    [
      ['C-01', 48000000],
      ['C-02', 250000],
    ],
  );
  save(
    ['amount', 'currency'],
    [
      [1000, 'SAR'],
      [400, 'USD'],
    ],
  );
  return { session, context: makeToolContext({ session }) };
}

async function rejection(promise: Promise<unknown>): Promise<string> {
  const error = await promise.then(
    () => null,
    (reason: unknown) => reason,
  );
  expect(error).toBeInstanceOf(ToolError);
  return (error as ToolError).message;
}

describe('calculate', () => {
  it('sums a saved result column', async () => {
    const { context } = setup();
    const result = await calculate.run({ expression: 'sum(r3.amount)', label: 'Total of Bill 3 (SAR)' }, context);
    expect(result.output).toEqual({ expression: 'sum(r3.amount)', value: 48250000, label: 'Total of Bill 3 (SAR)' });
    expect(result.summary).toBe('sum(r3.amount) = 48,250,000');
  });

  it('trims the expression and shows decimals in the summary', async () => {
    const { context } = setup();
    const result = await calculate.run({ expression: '  (r2.rate[0] - r1.rate[0]) / r1.rate[0] * 100 ', label: null }, context);
    expect(result.output).toEqual({ expression: '(r2.rate[0] - r1.rate[0]) / r1.rate[0] * 100', value: 12.5, label: null });
    expect(result.summary).toBe('(r2.rate[0] - r1.rate[0]) / r1.rate[0] * 100 = 12.5');
  });

  it('rejects numbers the chat has not seen', async () => {
    const { context } = setup();
    const message = await rejection(calculate.run({ expression: 'r3.amount[0] + 7350000 - 12.75', label: null }, context));
    expect(message).toMatch(/^7350000, 12.75 did not come from the question, a tool output or a saved result/);
  });

  it('accepts numbers seen in saved results or noted tool outputs, in any format', async () => {
    const { session, context } = setup();
    session.evidence.noteText('Clause 14.2: the advance payment is SAR 7,350,000.00.');
    const result = await calculate.run({ expression: '48000000 - 7350000', label: null }, context);
    expect(result.output).toMatchObject({ value: 40650000 });
  });

  it('allows small constants, percentages and round digits without a source', async () => {
    const { context } = setup();
    const result = await calculate.run(
      { expression: 'round(sum(r3.amount) * 15% / 1000000 * 12, 3)', label: null },
      context,
    );
    expect(result.output).toMatchObject({ value: 86.85 });
  });

  it('lets a later calculation use an earlier value', async () => {
    const { context } = setup();
    await calculate.run({ expression: 'sum(r3.amount) * 15%', label: 'VAT' }, context);
    const result = await calculate.run({ expression: 'sum(r3.amount) + 7237500', label: 'Total with VAT' }, context);
    expect(result.output).toMatchObject({ value: 55487500 });
  });

  it('tells the model when a result id is unknown', async () => {
    const { context } = setup();
    const message = await rejection(calculate.run({ expression: 'sum(r9.amount) + r1.rate[0]', label: null }, context));
    expect(message).toBe('No saved result with id r9 in this chat. Use an id that a tool returned with its rows, such as r1.');
  });

  it('sends calculator errors back as tool errors', async () => {
    const { context } = setup();
    expect(await rejection(calculate.run({ expression: 'r1.rate[0] / 0', label: null }, context))).toBe(
      'Division by zero: 0 is 0.',
    );
    expect(await rejection(calculate.run({ expression: 'process.exit()', label: null }, context))).toMatch(
      /^Unknown name "process"/,
    );
    expect(await rejection(calculate.run({ expression: 'sum(r3.amt)', label: null }, context))).toMatch(
      /r3 has no column "amt"/,
    );
    expect(await rejection(calculate.run({ expression: '   ', label: null }, context))).toBe('The expression is empty.');
  });

  it('refuses to add amounts in different currencies', async () => {
    const { context } = setup();
    const message = await rejection(calculate.run({ expression: 'sum(r4.amount)', label: null }, context));
    expect(message).toMatch(/mixes amounts in SAR and USD/);
  });

  it('requires an expression and a nullable label', () => {
    expect(calculate.parameters.safeParse({ expression: '1 + 1', label: null }).success).toBe(true);
    expect(calculate.parameters.safeParse({ expression: '1 + 1' }).success).toBe(false);
    expect(z.toJSONSchema(calculate.parameters)).toMatchObject({ required: ['expression', 'label'] });
  });

  it('is registered for the model', () => {
    expect(tools.filter((tool) => tool.name === 'calculate')).toHaveLength(1);
  });
});
