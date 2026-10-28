import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { MAX_OUTPUT_CHARS } from '../../../src/application/agent/toolOutput';
import { errors } from '../../../src/application/errors';
import { defineTool } from '../../../src/application/tools/Tool';
import { callsTools } from '../../fakes/FakeModelClient';
import { outputsOf, rawCall, setup, stepEvents, submits } from './harness';

function failingTool(error: unknown) {
  return defineTool({
    name: 'flaky',
    description: 'Fails.',
    parameters: z.object({}),
    async run() {
      throw error;
    },
  });
}

describe('runAgent tool calls', () => {
  it('reports a step when a call starts and when it ends, and logs it', async () => {
    const { run, events, logger } = setup([
      callsTools({ name: 'lookup', args: { code: 'A1', sheet: null } }),
      submits('Done.'),
    ]);

    await run();

    const [running, done] = stepEvents(events);
    expect(running).toEqual({
      id: 'q1:1',
      name: 'lookup',
      inputSummary: '{"code":"A1"}',
      status: 'running',
      durationMs: null,
      resultSummary: null,
      error: null,
    });
    expect(done).toMatchObject({ id: 'q1:1', status: 'ok', resultSummary: 'Found A1', error: null });
    expect(Number.isInteger(done?.durationMs)).toBe(true);
    expect(logger.tools[0]).toEqual({
      questionId: 'q1',
      tool: 'lookup',
      inputSummary: '{"code":"A1"}',
      durationMs: done?.durationMs,
      resultBytes: '{"code":"A1","amount":2000000}'.length,
      error: null,
    });
  });

  it('sends JSON that does not parse back to the model with the error', async () => {
    const { model, run, lookup, events } = setup([rawCall('lookup', '{"code":"A1"'), submits('Done.')]);

    await run();

    expect(lookup.runs).toEqual([]);
    expect(outputsOf(model.requests[1])).toEqual([
      { error: expect.stringMatching(/^The arguments were not valid JSON: /), arguments: '{"code":"A1"' },
    ]);
    expect(stepEvents(events).at(-1)).toMatchObject({ status: 'error', durationMs: 0, inputSummary: '{"code":"A1"' });
  });

  it('sends arguments that fail the schema back with what to fix', async () => {
    const { model, run, lookup, logger } = setup([rawCall('lookup', '{"code":7,"sheet":null}'), submits('Done.')]);

    await run();

    expect(lookup.runs).toEqual([]);
    const [output] = outputsOf(model.requests[1]) as { error: string; arguments: unknown }[];
    expect(output?.error).toMatch(/^Invalid arguments: .*code.*; fix them and call again\.$/s);
    expect(output?.arguments).toEqual({ code: 7, sheet: null });
    expect(logger.tools[0]?.error).toBe(output?.error);
  });

  it('refuses a call identical to an earlier one, whatever the key order', async () => {
    const { model, run, lookup, events } = setup([
      rawCall('lookup', '{"code":"A1","sheet":"Bill 1"}', 'first'),
      rawCall('lookup', '{"sheet":"Bill 1","code":"A1"}', 'second'),
      submits('Done.'),
    ]);

    await run();

    expect(lookup.runs).toHaveLength(1);
    expect(outputsOf(model.requests[2])).toEqual([
      { error: 'You already called lookup with these arguments; reuse the earlier result.' },
    ]);
    expect(stepEvents(events).at(-1)).toMatchObject({
      status: 'refused',
      error: 'Skipped: the same request as an earlier step.',
    });
  });

  it('refuses a repeat inside the same round too', async () => {
    const { model, run, lookup } = setup([
      callsTools({ name: 'lookup', args: { code: 'A1', sheet: null } }, { name: 'lookup', args: { code: 'A1', sheet: null } }),
      submits('Done.'),
    ]);

    await run();

    expect(lookup.runs).toHaveLength(1);
    expect(outputsOf(model.requests[1])).toEqual([
      { code: 'A1', amount: 2_000_000 },
      { error: 'You already called lookup with these arguments; reuse the earlier result.' },
    ]);
  });

  it('runs several calls of one round and returns their outputs in call order', async () => {
    const { model, run, lookup } = setup([
      callsTools(
        { name: 'lookup', args: { code: 'A1', sheet: null } },
        { name: 'lookup', args: { code: 'BAD', sheet: null } },
        { name: 'lookup', args: { code: 'A2', sheet: null } },
      ),
      submits('Done.'),
    ]);

    await run();

    expect(lookup.runs.map((args) => args.code)).toEqual(['A1', 'BAD', 'A2']);
    expect(model.requests[1]?.input.map((item) => (item.type === 'tool_output' ? item.callId : null))).toEqual([
      'call_lookup_0',
      'call_lookup_1',
      'call_lookup_2',
    ]);
    expect(outputsOf(model.requests[1])[1]).toEqual({ error: 'No item has the code BAD.' });
  });

  it.each([
    ['an AppError', errors.documentNotFound('Spec.pdf'), 'No loaded document matches "Spec.pdf".'],
    ['an unexpected error', new TypeError('x is undefined'), 'The tool failed: x is undefined'],
    ['a thrown string', 'disk full', 'The tool failed: disk full'],
  ])('sends %s back as the tool output', async (_label, error, message) => {
    const { model, run, logger, events } = setup([callsTools({ name: 'flaky', args: {} }), submits('Done.')], {
      tools: [failingTool(error)],
    });

    await run();

    expect(outputsOf(model.requests[1])).toEqual([{ error: message }]);
    expect(logger.tools[0]).toMatchObject({ tool: 'flaky', error: message, resultBytes: 0 });
    expect(stepEvents(events).at(-1)).toMatchObject({ status: 'error', error: message, resultSummary: null });
  });

  it('tells the model when it calls a tool that does not exist', async () => {
    const { model, run } = setup([rawCall('read_minds', '{}'), submits('Done.')]);

    await run();

    expect(outputsOf(model.requests[1])).toEqual([
      { error: 'There is no tool named read_minds. Use one of: lookup, submit_answer.' },
    ]);
  });

  it('caps a long output and says how to narrow the request', async () => {
    const big = defineTool({
      name: 'read_pages',
      description: 'Reads pages.',
      parameters: z.object({}),
      async run() {
        return { output: { text: 'word '.repeat(10_000) }, summary: 'Read 40 pages' };
      },
    });
    const { model, run, logger } = setup([callsTools({ name: 'read_pages', args: {} }), submits('Done.')], { tools: [big] });

    await run();

    const item = model.requests[1]?.input[0];
    const output = item?.type === 'tool_output' ? item.output : '';
    expect(output.length).toBeLessThan(MAX_OUTPUT_CHARS + 300);
    expect(output).toMatch(/Output truncated: this is the first 20000 of \d+ characters\. Narrow the request/);
    expect(logger.tools[0]?.resultBytes).toBeGreaterThan(MAX_OUTPUT_CHARS);
  });

  it('reports a result that cannot be written as JSON as a tool failure', async () => {
    const odd = defineTool({
      name: 'odd',
      description: 'Returns a BigInt.',
      parameters: z.object({}),
      async run() {
        return { output: { value: 10n }, summary: 'odd' };
      },
    });
    const { model, run } = setup([callsTools({ name: 'odd', args: {} }), submits('Done.')], { tools: [odd] });

    await run();

    expect(outputsOf(model.requests[1])).toEqual([{ error: expect.stringMatching(/^The tool failed: /) }]);
  });
});
