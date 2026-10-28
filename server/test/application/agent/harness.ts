import { z } from 'zod';
import type { AgentEvent } from '../../../src/application/agent/events';
import { runAgent, type RunAgentOptions } from '../../../src/application/agent/runAgent';
import type { ModelTurnRequest, ModelTurnResult, ToolSpec } from '../../../src/application/ports/ModelClient';
import { defineTool, ToolError } from '../../../src/application/tools/Tool';
import { FakeModelClient } from '../../fakes/FakeModelClient';
import { MemoryRunLogger } from '../../fakes/MemoryRunLogger';
import { makeToolContext } from '../../fakes/toolContext';

export type ScriptStep = Partial<ModelTurnResult> | ((request: ModelTurnRequest) => Partial<ModelTurnResult>);

export const submitTool: ToolSpec = {
  name: 'submit_answer',
  description: 'Give the final answer.',
  parameters: z.object({ markdown: z.string() }),
};

/** A tiny tool for the tests: looks up an item code, fails with a ToolError for BAD. */
export function makeLookup() {
  const runs: { code: string; sheet: string | null }[] = [];
  const tool = defineTool({
    name: 'lookup',
    description: 'Looks up an item by code.',
    parameters: z.object({ code: z.string(), sheet: z.string().nullable() }),
    async run(args) {
      runs.push(args);
      if (args.code === 'BAD') throw new ToolError('No item has the code BAD.');
      return { output: { code: args.code, amount: 2_000_000 }, summary: `Found ${args.code}` };
    },
  });
  return { tool, runs };
}

/** Builds runAgent options around a scripted model; the onSubmit default accepts the markdown. */
export function setup(script: ScriptStep[], overrides: Partial<RunAgentOptions<string>> = {}) {
  const model = new FakeModelClient(script);
  const logger = new MemoryRunLogger();
  const events: AgentEvent[] = [];
  const controller = new AbortController();
  const lookup = makeLookup();
  const options: RunAgentOptions<string> = {
    questionId: 'q1',
    model: 'small-model',
    instructions: 'Answer from the documents.',
    input: [{ type: 'message', role: 'user', content: 'What is item A1?' }],
    tools: [lookup.tool],
    submitTool,
    context: makeToolContext({ model, signal: controller.signal }),
    maxRounds: 6,
    reasoningEffort: 'low',
    logger,
    onEvent: (event) => events.push(event),
    onSubmit: async (args) => ({ accepted: true, value: (args as { markdown: string }).markdown }),
    ...overrides,
  };
  return { model, logger, events, controller, lookup, options, run: () => runAgent(options) };
}

export function submits(markdown: string, callId = 'call_submit'): Partial<ModelTurnResult> {
  return { functionCalls: [{ callId, name: submitTool.name, arguments: JSON.stringify({ markdown }) }] };
}

export function rawCall(name: string, args: string, callId = `raw_${name}`): Partial<ModelTurnResult> {
  return { functionCalls: [{ callId, name, arguments: args }] };
}

/** The tool outputs a request sent, parsed as JSON where they are JSON. */
export function outputsOf(request: ModelTurnRequest | undefined): unknown[] {
  return (request?.input ?? []).flatMap((item) => {
    if (item.type !== 'tool_output') return [];
    try {
      return [JSON.parse(item.output)];
    } catch {
      return [item.output];
    }
  });
}

export function stepEvents(events: AgentEvent[]) {
  return events.flatMap((event) => (event.type === 'step' ? [event.step] : []));
}
