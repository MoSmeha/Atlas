import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import type { Answer } from '@atlas/shared';
import type { AgentEvent } from '../../../src/application/agent/events';
import { runAgent } from '../../../src/application/agent/runAgent';
import { checkAnswer } from '../../../src/application/guards/checkAnswer';
import { ToolOutputLog } from '../../../src/application/guards/ToolOutputLog';
import { Session } from '../../../src/application/session/Session';
import { submitAnswer, type SubmittedAnswer } from '../../../src/application/tools/submitAnswer';
import { defineTool } from '../../../src/application/tools/Tool';
import type { ModelTurnResult } from '../../../src/application/ports/ModelClient';
import { callsTools, FakeModelClient } from '../../fakes/FakeModelClient';
import { FakeIndex } from '../../fakes/FakeIndex';
import { MemoryRunLogger } from '../../fakes/MemoryRunLogger';
import { boqTable, excelRecord } from '../../fakes/records';
import { makeToolContext } from '../../fakes/toolContext';
import { outputsOf } from '../agent/harness';

/** A stand-in for query_tables: saves the rows it "selected" and returns them with the result id. */
const sumBill = defineTool({
  name: 'sum_bill',
  description: 'Totals one bill.',
  parameters: z.object({ sheet: z.string() }),
  async run(args, context) {
    const saved = context.session.saveResult({
      title: `${args.sheet} total`,
      columns: ['currency', 'total'],
      rows: [['SAR', 1_250_000]],
      sources: [{ kind: 'excel', document: 'BOQ.xlsx', sheet: args.sheet, rowFrom: 5, rowTo: 40 }],
      tool: 'sum_bill',
      detail: null,
    });
    return { output: { resultId: saved.id, columns: saved.columns, rows: saved.rows }, summary: `Summed ${args.sheet}` };
  },
});

function submits(args: SubmittedAnswer, callId: string): Partial<ModelTurnResult> {
  return { functionCalls: [{ callId, name: submitAnswer.name, arguments: JSON.stringify(args) }] };
}

const base: SubmittedAnswer = { kind: 'answer', language: 'en', markdown: '', result_id: 'r1', sources: [] };

async function ask(script: Partial<ModelTurnResult>[]) {
  const index = new FakeIndex();
  index.save(excelRecord('BOQ.xlsx', [boqTable([['A1', 'Concrete', 10, 100, 1000]], 'Bill 1')]));
  const session = new Session('s1');
  const model = new FakeModelClient(script);
  const log = new ToolOutputLog();
  const events: AgentEvent[] = [];
  const question = 'What is the total of Bill 1?';
  const run = await runAgent<Answer>({
    questionId: 'q1',
    model: 'small-model',
    instructions: 'Answer from the documents.',
    input: [{ type: 'message', role: 'user', content: question }],
    tools: log.watch([sumBill]),
    submitTool: submitAnswer,
    context: makeToolContext({ model, index, session }),
    maxRounds: 6,
    reasoningEffort: null,
    logger: new MemoryRunLogger(),
    onEvent: (event) => events.push(event),
    onSubmit: checkAnswer({ question, index, session, toolOutputs: () => log.outputs, toolCalls: () => log.calls }),
  });
  return { run, model, events };
}

describe('the answer loop with checkAnswer', () => {
  it('sends a rejected answer back with feedback and accepts the corrected one', async () => {
    const { run, model, events } = await ask([
      callsTools({ name: 'sum_bill', args: { sheet: 'Bill 1' } }),
      submits({ ...base, markdown: 'Bill 1 totals SAR 1,300,000.' }, 'call_submit_1'),
      submits({ ...base, markdown: 'Bill 1 totals SAR 1,250,000.00.' }, 'call_submit_2'),
    ]);

    expect(run.rounds).toBe(3);
    expect(run.value).toEqual({
      kind: 'answer',
      language: 'en',
      markdown: 'Bill 1 totals SAR 1,250,000.00.',
      table: { resultId: 'r1', title: 'Bill 1 total', columns: ['currency', 'total'], rows: [['SAR', 1_250_000]], totalRows: 1 },
      sources: [{ kind: 'excel', document: 'BOQ.xlsx', sheet: 'Bill 1', rowFrom: 5, rowTo: 40 }],
      unreadableFiles: [],
      warnings: [],
    });

    const [feedback] = outputsOf(model.requests[2]) as { problems: string[] }[];
    expect(feedback?.problems[0]).toContain('"1,300,000"');
    expect(model.requests[2]?.input).toEqual([{ type: 'tool_output', callId: 'call_submit_1', output: expect.any(String) }]);

    const streamed = events.filter((event) => event.type === 'answer_delta' || event.type === 'answer_reset').map((event) => event.type);
    expect(streamed).toEqual(['answer_delta', 'answer_reset', 'answer_delta']);
  });

  it('accepts the third flawed answer with a warning', async () => {
    const flawed = submits({ ...base, markdown: 'Bill 1 totals SAR 1,300,000.' }, 'call_submit');
    const { run } = await ask([callsTools({ name: 'sum_bill', args: { sheet: 'Bill 1' } }), flawed, flawed, flawed]);
    expect(run.rounds).toBe(4);
    expect(run.value.warnings).toEqual(['These numbers could not be traced to a tool result or the documents: "1,300,000".']);
  });
});
