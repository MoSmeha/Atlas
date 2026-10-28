import { z } from 'zod';
import {
  CalculatorError,
  evaluate,
  literalNumbers,
  parseExpression,
  resultIds,
  type ParsedExpression,
} from '../../domain/calculator';
import { errors } from '../errors';
import type { Session } from '../session/Session';
import { defineTool, ToolError } from './Tool';

/** Numbers the model may type without a source: units, months and simple factors. */
const CONSTANTS = new Set([0, 1, 2, 3, 4, 10, 12, 100, 1000, 1_000_000, 1_000_000_000]);

const display = new Intl.NumberFormat('en-US', { maximumSignificantDigits: 15 });

export interface CalculateOutput {
  expression: string;
  value: number;
  label: string | null;
}

const description = [
  'Does arithmetic in code, so every number in the answer is computed, never typed.',
  'Write one expression with plain numbers (1250000.5, no thousands commas), + - * / ^, parentheses, and 15% for 15 percent.',
  'Functions: sum, avg, min, max, count, round(x, digits), abs.',
  'Refer to saved results by id: sum(r3.amount), avg(r2.rate), max(r3.quantity), count(r3) for its number of rows,',
  'and r3.amount[0] for one cell (row 0 is the first row).',
  'A typed number must come from the question or an earlier tool output in this chat, so prefer result references;',
  'small constants such as 1, 12, 100 and 1000 are always allowed.',
  'Totals and filters over whole tables belong in query_tables; use calculate on numbers you already have.',
  'Never add amounts in different currencies: calculate each currency on its own.',
].join(' ');

/** Safe arithmetic over saved results and numbers the chat has seen; no eval. */
export const calculate = defineTool({
  name: 'calculate',
  description,
  parameters: z.object({
    expression: z.string().describe('The arithmetic, for example sum(r3.amount) * 15% or r2.rate[0] - r5.rate[0].'),
    label: z
      .string()
      .nullable()
      .describe('What the value is, in the language of the question, for example "Bill 3 total (SAR)". null if obvious.'),
  }),
  async run(args, context) {
    const text = args.expression.trim();
    const value = explained(() => {
      const expression = parseExpression(text);
      checkResults(expression, context.session);
      checkInputs(expression, context.session);
      return evaluate(expression, (id) => context.session.result(id));
    });
    context.session.evidence.noteNumber(value);
    const output: CalculateOutput = { expression: text, value, label: args.label };
    return { output, summary: `${text} = ${display.format(value)}` };
  },
});

/** Turns calculator errors into tool errors, which go back to the model to fix. */
function explained<T>(step: () => T): T {
  try {
    return step();
  } catch (error) {
    if (error instanceof CalculatorError) throw new ToolError(error.message);
    throw error;
  }
}

function checkResults(expression: ParsedExpression, session: Session): void {
  const missing = resultIds(expression.root).find((id) => session.result(id) === null);
  if (missing !== undefined) {
    throw new ToolError(`${errors.resultNotFound(missing).message} Use an id that a tool returned with its rows, such as r1.`);
  }
}

/** Every typed number must have been seen in this chat, apart from small constants and percentages. */
function checkInputs(expression: ParsedExpression, session: Session): void {
  const unseen = literalNumbers(expression.root)
    .filter((literal) => !literal.percent && !CONSTANTS.has(literal.value) && !session.evidence.has(literal.value))
    .map((literal) => literal.text);
  if (unseen.length === 0) return;
  const list = [...new Set(unseen)].join(', ');
  throw new ToolError(
    `${list} did not come from the question, a tool output or a saved result in this chat. ` +
      'Get numbers from the documents with a tool first, then refer to saved results such as r3.amount[0] ' +
      'or copy the number exactly as the tool returned it. Percentages such as 10% and constants such as 1 or 100 ' +
      'are always allowed, so write a 10% deduction as x * (1 - 10%).',
  );
}
