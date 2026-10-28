import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { agentMessages } from '../../../src/application/agent/agentMessages';
import { EXTRA_ANSWER_ROUNDS } from '../../../src/application/agent/runAgent';
import { defineTool } from '../../../src/application/tools/Tool';
import { callsTools, fakeUsage } from '../../fakes/FakeModelClient';
import { outputsOf, setup, stepEvents, submits, submitTool } from './harness';

describe('runAgent', () => {
  it('runs a tool call and sends its output back on the next turn with previousResponseId', async () => {
    const { model, run, lookup, options } = setup([
      callsTools({ name: 'lookup', args: { code: 'A1', sheet: null } }),
      submits('Item A1 is 2,000,000 SAR.'),
    ]);

    const result = await run();

    expect(result.value).toBe('Item A1 is 2,000,000 SAR.');
    expect(result.rounds).toBe(2);
    expect(lookup.runs).toEqual([{ code: 'A1', sheet: null }]);

    const [first, second] = model.requests;
    expect(first).toMatchObject({
      model: 'small-model',
      instructions: 'Answer from the documents.',
      input: options.input,
      toolChoice: 'required',
      previousResponseId: null,
      reasoningEffort: 'low',
      signal: options.context.signal,
    });
    expect(first?.tools.map((tool) => tool.name)).toEqual(['lookup', 'submit_answer']);
    expect(second).toMatchObject({ previousResponseId: 'resp_1', toolChoice: 'required', instructions: 'Answer from the documents.' });
    expect(second?.input).toEqual([
      { type: 'tool_output', callId: 'call_lookup_0', output: '{"code":"A1","amount":2000000}' },
    ]);
  });

  it('builds a tool description from the context when it is a function', async () => {
    const perQuestion = defineTool({
      name: 'query_tables',
      description: (context) => `Tables in ${context.folder}`,
      parameters: z.object({}),
      async run() {
        return { output: [], summary: '' };
      },
    });
    const { model, run } = setup([submits('ok')], { tools: [perQuestion] });
    await run();
    expect(model.requests[0]?.tools[0]).toMatchObject({ name: 'query_tables', description: 'Tables in /folder' });
  });

  it('forces the submit tool on the last round and tells the model to answer now', async () => {
    const { model, run } = setup(
      [
        callsTools({ name: 'lookup', args: { code: 'A1', sheet: null } }),
        callsTools({ name: 'lookup', args: { code: 'A2', sheet: null } }),
        submits('Done.'),
      ],
      { maxRounds: 3 },
    );

    const result = await run();

    expect(result.rounds).toBe(3);
    expect(model.requests.map((request) => request.toolChoice)).toEqual(['required', 'required', { name: 'submit_answer' }]);
    const notice = agentMessages.lastRound('submit_answer');
    expect(model.requests[1]?.input[0]).toMatchObject({ type: 'tool_output' });
    expect(JSON.stringify(model.requests[1]?.input)).not.toContain('You must answer now');
    expect(model.requests[2]?.input).toEqual([
      { type: 'tool_output', callId: 'call_lookup_0', output: `{"code":"A2","amount":2000000}\n\n${notice}` },
    ]);
  });

  it('sends rejected answer feedback back as the call output, resets the stream, then accepts', async () => {
    let attempts = 0;
    const { model, run, events, logger } = setup([submits('The total is 5.', 'call_a'), submits('The total is 2,000,000.', 'call_b')], {
      onSubmit: async (args) => {
        attempts += 1;
        const { markdown } = args as { markdown: string };
        return attempts === 1
          ? { accepted: false, feedback: 'The number 5 is not in any tool result.' }
          : { accepted: true, value: markdown };
      },
    });

    const result = await run();

    expect(result).toMatchObject({ value: 'The total is 2,000,000.', rounds: 2 });
    expect(model.requests[1]?.input).toEqual([
      { type: 'tool_output', callId: 'call_a', output: 'The number 5 is not in any tool result.' },
    ]);
    expect(events).toEqual([
      { type: 'answer_delta', delta: 'The total is 5.' },
      { type: 'answer_reset' },
      { type: 'answer_delta', delta: 'The total is 2,000,000.' },
    ]);
    expect(logger.tools.map((entry) => [entry.tool, entry.error])).toEqual([
      ['submit_answer', 'The number 5 is not in any tool result.'],
      ['submit_answer', null],
    ]);
  });

  it('sends invalid submit arguments back without asking onSubmit', async () => {
    let asked = 0;
    const { model, run, events } = setup(
      [{ functionCalls: [{ callId: 'call_s', name: 'submit_answer', arguments: '{"text":"hi"}' }] }, submits('Fixed.')],
      {
        onSubmit: async (args) => {
          asked += 1;
          return { accepted: true, value: (args as { markdown: string }).markdown };
        },
      },
    );

    expect((await run()).value).toBe('Fixed.');
    expect(asked).toBe(1);
    expect(outputsOf(model.requests[1])[0]).toMatchObject({
      error: expect.stringMatching(/^Invalid arguments: .*markdown/s),
      arguments: { text: 'hi' },
    });
    expect(events.filter((event) => event.type === 'answer_reset')).toHaveLength(1);
  });

  it('gives a rejected answer on the last round a few more forced tries, then fails plainly', async () => {
    const script = Array.from({ length: 1 + EXTRA_ANSWER_ROUNDS }, (_, i) => submits(`try ${i}`, `call_${i}`));
    const { model, run } = setup(script, {
      maxRounds: 1,
      onSubmit: async () => ({ accepted: false, feedback: 'Add a source.' }),
    });

    await expect(run()).rejects.toMatchObject({ code: 'model_error', message: expect.stringMatching(/no acceptable answer/) });
    expect(model.requests).toHaveLength(1 + EXTRA_ANSWER_ROUNDS);
    expect(model.requests.every((request) => typeof request.toolChoice === 'object')).toBe(true);
    expect(model.requests[1]?.input[0]).toMatchObject({ output: expect.stringContaining('You must answer now') });
  });

  it('nudges the model to submit when it writes text without calling a tool', async () => {
    const { model, run } = setup([{ text: 'Let me think about it.' }, submits('Answer.')]);

    expect((await run()).value).toBe('Answer.');
    expect(model.requests[1]).toMatchObject({
      previousResponseId: 'resp_1',
      input: [{ type: 'message', role: 'user', content: 'Call submit_answer with your final answer.' }],
    });
  });

  it('throws model_refusal when the model refuses', async () => {
    const { run } = setup([{ refusal: 'I cannot help with that.' }]);
    await expect(run()).rejects.toMatchObject({
      code: 'model_refusal',
      message: 'The model declined to answer: I cannot help with that.',
    });
  });

  it('throws stopped without calling the model when the question is already stopped', async () => {
    const { model, run, controller } = setup([submits('never')]);
    controller.abort();
    await expect(run()).rejects.toMatchObject({ code: 'stopped' });
    expect(model.requests).toHaveLength(0);
  });

  it.each(['throws', 'returns'])('throws stopped when the question is stopped while a tool runs and %s', async (ending) => {
    const harness = setup([callsTools({ name: 'slow_tool', args: {} }), submits('never')]);
    harness.options.tools = [
      defineTool({
        name: 'slow_tool',
        description: 'Takes a while.',
        parameters: z.object({}),
        async run() {
          harness.controller.abort();
          if (ending === 'throws') throw new Error('This operation was aborted');
          return { output: null, summary: '' };
        },
      }),
    ];

    await expect(harness.run()).rejects.toMatchObject({ code: 'stopped' });
    expect(harness.model.requests).toHaveLength(1);
  });

  it('throws stopped when the signal aborts during a model turn', async () => {
    const harness = setup([
      () => {
        harness.controller.abort();
        return callsTools({ name: 'lookup', args: { code: 'A1', sheet: null } });
      },
    ]);
    await expect(harness.run()).rejects.toMatchObject({ code: 'stopped' });
    expect(harness.lookup.runs).toEqual([]);
  });

  it('sums the usage of every turn', async () => {
    const { run } = setup([
      callsTools({ name: 'lookup', args: { code: 'A1', sheet: null } }),
      callsTools({ name: 'lookup', args: { code: 'A2', sheet: null } }),
      { ...submits('Done.'), usage: { inputTokens: 50, cachedInputTokens: 10, outputTokens: 7, reasoningTokens: 1 } },
    ]);

    const { usage } = await run();

    expect(usage).toEqual({
      inputTokens: fakeUsage.inputTokens * 2 + 50,
      cachedInputTokens: fakeUsage.cachedInputTokens * 2 + 10,
      outputTokens: fakeUsage.outputTokens * 2 + 7,
      reasoningTokens: fakeUsage.reasoningTokens * 2 + 1,
    });
  });

  it('accepts a submit made alongside tool calls without running them', async () => {
    const { run, lookup, events } = setup([
      {
        functionCalls: [
          { callId: 'call_l', name: 'lookup', arguments: '{"code":"A1","sheet":null}' },
          { callId: 'call_s', name: 'submit_answer', arguments: '{"markdown":"Early answer."}' },
        ],
      },
    ]);

    const result = await run();

    expect(result).toMatchObject({ value: 'Early answer.', rounds: 1, steps: [] });
    expect(lookup.runs).toEqual([]);
    expect(stepEvents(events)).toEqual([]);
  });

  it('returns the final state of every step', async () => {
    const { run } = setup([
      callsTools({ name: 'lookup', args: { code: 'A1', sheet: null } }, { name: 'lookup', args: { code: 'BAD', sheet: null } }),
      submits('Done.'),
    ]);

    const { steps } = await run();

    expect(steps.map((step) => [step.id, step.status, step.resultSummary, step.error])).toEqual([
      ['q1:1', 'ok', 'Found A1', null],
      ['q1:2', 'error', null, 'No item has the code BAD.'],
    ]);
  });

  it('streams only the first submit call of a turn', async () => {
    const { run, events } = setup([
      {
        functionCalls: [
          { callId: 'call_1', name: submitTool.name, arguments: '{"markdown":"First."}' },
          { callId: 'call_2', name: submitTool.name, arguments: '{"markdown":"Second."}' },
        ],
      },
    ]);
    expect((await run()).value).toBe('First.');
    expect(events).toEqual([{ type: 'answer_delta', delta: 'First.' }]);
  });
});
