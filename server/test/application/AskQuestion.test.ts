import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import type { ChatEvent } from '@atlas/shared';
import { AskQuestion, type AskQuestionDeps } from '../../src/application/AskQuestion';
import type { Lineup } from '../../src/application/models/pickLineup';
import type { ModelTurnResult } from '../../src/application/ports/ModelClient';
import { SessionStore } from '../../src/application/session/SessionStore';
import type { SubmittedAnswer } from '../../src/application/tools/submitAnswer';
import { defineTool } from '../../src/application/tools/Tool';
import { Workspace } from '../../src/application/workspace/Workspace';
import { FakeClock } from '../fakes/FakeClock';
import { FakeEmbeddingClient } from '../fakes/FakeEmbeddingClient';
import { FakeIndex } from '../fakes/FakeIndex';
import { callsTools, FakeModelClient } from '../fakes/FakeModelClient';
import { FakeExporter, FakePageRenderer } from '../fakes/FakeOutputs';
import { MemoryRunLogger } from '../fakes/MemoryRunLogger';
import { boqTable, excelRecord } from '../fakes/records';
import { outputsOf } from './agent/harness';

const lineup: Lineup = {
  frontier: { id: 'frontier-model', tier: 'frontier', label: 'Frontier', inputPrice: 10, cachedInputPrice: 1, outputPrice: 50 },
  balanced: { id: 'balanced-model', tier: 'balanced', label: 'Balanced', inputPrice: 2, cachedInputPrice: 0.1, outputPrice: 10 },
  small: { id: 'small-model', tier: 'small', label: 'Small', inputPrice: 0.1, cachedInputPrice: 0.01, outputPrice: 0.5 },
};

const itemsSql = 'SELECT item_code, amount, _row FROM boq_1 WHERE _is_total = 0 AND amount > 1000000';
const queryItems = callsTools({ name: 'query_tables', args: { sql: itemsSql, title: 'Items over 1,000,000' } });

function submits(args: Partial<SubmittedAnswer>, callId = 'call_submit'): Partial<ModelTurnResult> {
  const full: SubmittedAnswer = { kind: 'answer', language: 'en', markdown: '', result_id: null, sources: [], ...args };
  return { functionCalls: [{ callId, name: 'submit_answer', arguments: JSON.stringify(full) }] };
}

function setup(script: ConstructorParameters<typeof FakeModelClient>[0], overrides: Partial<AskQuestionDeps> = {}) {
  const index = new FakeIndex();
  index.save(excelRecord('BOQ.xlsx', [boqTable([['A1', 'Piles', 10, 200000, 2000000], ['A2', 'Concrete', 5, 100, 500]], 'Bill 1')]));
  index.onQuery = () => ({ columns: ['item_code', 'amount', '_row'], rows: [['A1', 2000000, 5]], truncated: false });
  const workspace = new Workspace();
  workspace.activate('/folder', index);
  const model = new FakeModelClient(script);
  const logger = new MemoryRunLogger();
  const clock = new FakeClock();
  const sessions = new SessionStore();
  const ask = new AskQuestion({
    workspace,
    sessions,
    modelClient: model,
    embeddings: new FakeEmbeddingClient(),
    renderer: new FakePageRenderer(),
    exporter: new FakeExporter(),
    clock,
    logger,
    lineup,
    answerTier: 'frontier',
    reasoningEffort: 'low',
    maxRounds: 6,
    exportsDir: '/exports',
    ...overrides,
  });
  const events: ChatEvent[] = [];
  const question = (text: string, requested: string | null = null, signal?: AbortSignal) =>
    ask.execute({ sessionId: 's1', question: text, model: requested, signal, onEvent: (event) => events.push(event) });
  return { ask, model, logger, clock, sessions, events, question, index };
}

describe('AskQuestion', () => {
  it('answers a question by calling a tool and submitting an answer', async () => {
    const { model, logger, sessions, events, question } = setup([
      queryItems,
      submits({ markdown: 'One item costs over 1,000,000: A1 at SAR 2,000,000.', result_id: 'r1' }),
    ]);

    const outcome = await question('Which items cost over 1,000,000?');

    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.answer).toMatchObject({
      kind: 'answer',
      language: 'en',
      markdown: 'One item costs over 1,000,000: A1 at SAR 2,000,000.',
      table: { resultId: 'r1', title: 'Items over 1,000,000', columns: ['item_code', 'amount'], rows: [['A1', 2000000]], totalRows: 1 },
      sources: [{ kind: 'excel', document: 'BOQ.xlsx', sheet: 'Bill 1', rowFrom: 5, rowTo: 5 }],
      warnings: [],
    });

    expect(events.map((event) => event.type)).toEqual(['started', 'step', 'step', 'answer_delta', 'answer']);
    expect(events[0]).toEqual({ type: 'started', questionId: expect.any(String), model: 'frontier-model' });
    expect(events.at(-1)).toEqual({ type: 'answer', answer: outcome.answer, usage: outcome.usage });

    const [first] = model.requests;
    expect(first?.model).toBe('frontier-model');
    expect(first?.reasoningEffort).toBe('low');
    expect(first?.input).toEqual([{ type: 'message', role: 'user', content: 'Which items cost over 1,000,000?' }]);
    expect(first?.instructions).toContain("- BOQ.xlsx: Excel, sheet 'Bill 1'; 1 table; currency SAR; English.");
    expect(first?.tools.map((tool) => tool.name)).toContain('query_tables');
    expect(first?.tools.at(-1)?.name).toBe('submit_answer');

    const session = sessions.get('s1');
    expect(session.turns).toEqual([{ question: 'Which items cost over 1,000,000?', answer: outcome.answer, resultIds: ['r1'] }]);
    expect(session.evidence.has(1000000)).toBe(true);
    expect(logger.questions).toEqual([
      expect.objectContaining({ sessionId: 's1', model: 'frontier-model', rounds: 2, answerKind: 'answer', error: null }),
    ]);
  });

  it('reads a spoken question with transcription mistakes in mind and sends what to say before the answer', async () => {
    const { ask, model, events } = setup([
      queryItems,
      submits({ markdown: 'One item costs over 1,000,000: A1 at SAR 2,000,000.', result_id: 'r1' }),
    ]);

    const outcome = await ask.execute({
      sessionId: 's1',
      question: 'which items cost over one million',
      spoken: true,
      onEvent: (event) => events.push(event),
    });

    expect(outcome.ok).toBe(true);
    expect(model.requests[0]?.instructions).toContain('This question was spoken in a voice call and transcribed automatically.');
    expect(events.map((event) => event.type)).toEqual(['started', 'step', 'step', 'answer_delta', 'speech', 'answer']);
    expect(events.at(-2)).toEqual({
      type: 'speech',
      text: [
        'One item costs over 1,000,000: A1 at SAR 2,000,000.',
        'The table on the screen, "Items over 1,000,000", has 1 row.',
        'Columns: Item code, Amount.',
        'It reads: A1, 2,000,000.',
        'Source: BOQ.xlsx, sheet Bill 1, row 5.',
      ].join('\n'),
    });
  });

  it('leaves the voice note out of a typed question and sends no speech', async () => {
    const { model, events, question } = setup([submits({ kind: 'not_found', markdown: 'Not in the documents.' })]);
    await question('What is the fee?');
    expect(model.requests[0]?.instructions).not.toContain('voice call');
    expect(events.some((event) => event.type === 'speech')).toBe(false);
  });

  it('gives the second question the first turn, and lets it attach the saved result', async () => {
    const { model, question } = setup([
      queryItems,
      submits({ markdown: 'A1 costs SAR 2,000,000.', result_id: 'r1' }),
      submits({ markdown: 'A1 is on row 5 of sheet Bill 1 in BOQ.xlsx, at SAR 2,000,000.', result_id: 'r1' }),
    ]);
    await question('Which items cost over 1,000,000?');

    const second = await question('Which row was that on?');

    const request = model.requests[2];
    expect(request?.previousResponseId).toBeNull();
    expect(request?.input).toEqual([
      { type: 'message', role: 'user', content: 'Which items cost over 1,000,000?' },
      {
        type: 'message',
        role: 'assistant',
        content: [
          'A1 costs SAR 2,000,000.',
          '',
          'Result r1 "Items over 1,000,000" (1 row):',
          'item_code | amount | _row',
          'A1 | 2000000 | 5',
          '',
          'Sources: BOQ.xlsx, sheet Bill 1, row 5.',
        ].join('\n'),
      },
      { type: 'message', role: 'user', content: 'Which row was that on?' },
    ]);
    expect(second.ok && second.answer.table?.resultId).toBe('r1');
    expect(second.ok && second.answer.warnings).toEqual([]);
  });

  it('tells the next question about results the answer did not attach', async () => {
    const { model, question } = setup([
      queryItems,
      submits({ markdown: 'A1 is on row 5.', sources: [{ document: 'BOQ.xlsx', page: null, sheet: 'Bill 1', row_from: 5, row_to: 5, quote: null }] }),
      submits({ markdown: 'Exported.', result_id: 'r1' }),
    ]);
    await question('Which items cost over 1,000,000?');
    await question('Show that as a table.');

    const replayed = model.requests[2]?.input[1];
    expect(replayed).toMatchObject({ role: 'assistant', content: expect.stringContaining('Result r1 "Items over 1,000,000" (1 row, not shown to the user):') });
  });

  it('exports a result saved by an earlier question', async () => {
    const exporter = new FakeExporter();
    const { model, question } = setup(
      [
        queryItems,
        submits({ markdown: 'A1 costs SAR 2,000,000.', result_id: 'r1' }),
        callsTools({ name: 'export_table', args: { result_id: 'r1', format: 'xlsx' } }),
        submits({ markdown: 'Saved the table as an Excel file.', result_id: 'r1' }),
      ],
      { exporter },
    );
    await question('Which items cost over 1,000,000?');
    const outcome = await question('Export that to Excel.');

    expect(outcome.ok).toBe(true);
    expect(exporter.exported).toHaveLength(1);
    expect(exporter.exported[0]?.table.columns).toEqual(['item_code', 'amount']);
    expect(exporter.exported[0]?.table.rows).toEqual([['A1', 2000000]]);
    expect(outputsOf(model.requests[3])[0]).toMatchObject({ file: expect.stringMatching(/\.xlsx$/) });
  });

  it('uses a requested model of the lineup and falls back to the default for any other', async () => {
    const chosen = setup([submits({ kind: 'out_of_scope', markdown: 'I only answer about the loaded documents.' })]);
    await chosen.question('Hello', 'small-model');
    expect(chosen.model.requests[0]?.model).toBe('small-model');
    expect(chosen.events[0]).toMatchObject({ type: 'started', model: 'small-model' });

    const unknown = setup([submits({ kind: 'out_of_scope', markdown: 'I only answer about the loaded documents.' })]);
    const outcome = await unknown.question('Hello', 'gpt-unknown');
    expect(unknown.model.requests[0]?.model).toBe('frontier-model');
    expect(outcome.ok && outcome.usage.model).toBe('frontier-model');
  });

  it('sends a not_indexed error when no folder is loaded', async () => {
    const { model, logger, sessions, events, question } = setup([], { workspace: new Workspace() });

    const outcome = await question('What is the total?');

    expect(outcome).toEqual({ ok: false, error: expect.objectContaining({ code: 'not_indexed' }) });
    expect(events).toEqual([{ type: 'error', error: { code: 'not_indexed', message: 'Load a folder before asking a question.', retryAfterSeconds: null } }]);
    expect(model.requests).toHaveLength(0);
    expect(sessions.get('s1').turns).toHaveLength(0);
    expect(logger.questions[0]).toMatchObject({ question: 'What is the total?', answerKind: null, error: expect.stringContaining('not_indexed') });
  });

  it('sends a missing_api_key error without a model client', async () => {
    const { events, question } = setup([], { modelClient: null });
    await question('What is the total?');
    expect(events).toEqual([{ type: 'error', error: expect.objectContaining({ code: 'missing_api_key' }) }]);
  });

  it('sends a plain internal error for an unexpected failure and logs the details', async () => {
    const { events, logger, question } = setup([]);
    const outcome = await question('What is the total?');
    expect(outcome.ok).toBe(false);
    expect(events.at(-1)).toEqual({
      type: 'error',
      error: { code: 'internal', message: 'Something went wrong while answering. Details are in the server log.' },
    });
    expect(logger.questions[0]?.error).toContain('no scripted turn');
  });

  it('sends a stopped error when the question is stopped', async () => {
    const controller = new AbortController();
    controller.abort();
    const { events, question } = setup([queryItems]);
    await question('Which items cost over 1,000,000?', null, controller.signal);
    expect(events.at(-1)).toMatchObject({ type: 'error', error: { code: 'stopped' } });
  });

  it('prices every model call, the tools own included, and times the question', async () => {
    let clock: FakeClock | null = null;
    const askSmall = defineTool({
      name: 'ask_small',
      description: 'Asks the small model.',
      parameters: z.object({}),
      async run(_args, context) {
        clock?.advance(1500);
        const { value } = await context.model.generateObject({
          model: context.models.small,
          instructions: 'Check.',
          input: 'x',
          schema: z.object({ ok: z.boolean() }),
          schemaName: 'check',
        });
        return { output: value, summary: 'Asked' };
      },
    });
    const test = setup([callsTools({ name: 'ask_small', args: {} }), submits({ kind: 'not_found', markdown: 'Not in the documents.' })], {
      tools: [askSmall],
    });
    clock = test.clock;
    test.model.objects = [{ ok: true }];

    const outcome = await test.question('Is the fee stated?');

    const frontier = (200 * 10 + 40 * 50) / 1_000_000;
    const small = (100 * 0.1 + 20 * 0.5) / 1_000_000;
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.usage).toEqual({
      model: 'frontier-model',
      inputTokens: 300,
      cachedInputTokens: 0,
      outputTokens: 60,
      reasoningTokens: 15,
      costUsd: expect.closeTo(frontier + small, 12),
      durationMs: 1500,
    });
    expect(test.sessions.get('s1').totalCostUsd).toBeCloseTo(frontier + small, 12);
    expect(test.logger.questions[0]).toMatchObject({ costUsd: outcome.usage.costUsd, durationMs: 1500, usage: { inputTokens: 300 } });
  });

  it('asks again once when an Arabic question gets an English answer', async () => {
    const { model, question } = setup([
      submits({ kind: 'not_found', language: 'en', markdown: 'Not found.' }, 'call_submit_1'),
      submits({ kind: 'not_found', language: 'ar', markdown: 'لم أجد ذلك في المستندات.' }, 'call_submit_2'),
    ]);

    const outcome = await question('ما هي قيمة العقد؟');

    expect(outcome.ok && outcome.answer).toMatchObject({ kind: 'not_found', language: 'ar', markdown: 'لم أجد ذلك في المستندات.' });
    const [feedback] = outputsOf(model.requests[1]) as { problems: string[] }[];
    expect(feedback?.problems[0]).toContain('written in Arabic');
  });
});
