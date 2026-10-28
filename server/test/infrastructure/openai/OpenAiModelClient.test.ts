import type OpenAI from 'openai';
import { APIConnectionError, APIError } from 'openai';
import type { ResponseStreamEvent } from 'openai/resources/responses/responses';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { AppError } from '../../../src/application/errors';
import type { ModelStreamEvent, ModelTurnRequest } from '../../../src/application/ports/ModelClient';
import { OpenAiModelClient } from '../../../src/infrastructure/openai/OpenAiModelClient';
import { fakeResponse, textEvents, toolCallEvents } from './recordedStreams';

interface Call {
  body: Record<string, any>;
  options: { signal?: AbortSignal };
}

/** A stand-in for the SDK client: records request bodies and answers with the given handler. */
function stubOpenAi(answer: (body: Record<string, any>) => unknown, modelIds: string[] | Error = []) {
  const calls: Call[] = [];
  const client = {
    responses: {
      create: async (body: Record<string, any>, options: Call['options']) => {
        calls.push({ body, options });
        return answer(body);
      },
    },
    models: {
      list: () =>
        (async function* () {
          if (modelIds instanceof Error) throw modelIds;
          for (const id of modelIds) yield { id };
        })(),
    },
  };
  return { client: new OpenAiModelClient(client as unknown as OpenAI), calls };
}

async function* replay(events: ResponseStreamEvent[], failWith?: unknown) {
  for (const event of events) yield event;
  if (failWith !== undefined) throw failWith;
}

function turnRequest(overrides: Partial<ModelTurnRequest> = {}): ModelTurnRequest {
  return {
    model: 'gpt-6-luna',
    instructions: 'Answer from the documents.',
    input: [{ type: 'message', role: 'user', content: 'Which items use steel?' }],
    tools: [{ name: 'search', description: 'Searches the documents.', parameters: z.object({ query: z.string() }) }],
    toolChoice: 'auto',
    previousResponseId: null,
    reasoningEffort: null,
    ...overrides,
  };
}

async function rejection(promise: Promise<unknown>): Promise<AppError> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof AppError) return error;
    throw error;
  }
  throw new Error('expected an AppError');
}

describe('OpenAiModelClient.turn', () => {
  it('sends a streamed, stored request with strict tools and parallel calls', async () => {
    const { client, calls } = stubOpenAi(() => replay(toolCallEvents));
    const signal = new AbortController().signal;
    await client.turn(turnRequest({ toolChoice: 'required', reasoningEffort: 'low', signal }));

    const { body, options } = calls[0]!;
    expect(body).toMatchObject({
      model: 'gpt-6-luna',
      instructions: 'Answer from the documents.',
      input: [{ type: 'message', role: 'user', content: 'Which items use steel?' }],
      tool_choice: 'required',
      parallel_tool_calls: true,
      reasoning: { effort: 'low' },
      store: true,
      stream: true,
    });
    expect(body.tools).toEqual([expect.objectContaining({ type: 'function', name: 'search', strict: true })]);
    expect(body).not.toHaveProperty('previous_response_id');
    expect(options.signal).toBe(signal);
  });

  it('chains with previous_response_id, forces a named tool and still sends the instructions', async () => {
    const { client, calls } = stubOpenAi(() => replay(textEvents));
    await client.turn(
      turnRequest({
        previousResponseId: 'resp_tools',
        toolChoice: { name: 'search' },
        input: [{ type: 'tool_output', callId: 'call_a', output: '{"hits":2}' }],
      }),
    );
    expect(calls[0]!.body).toMatchObject({
      previous_response_id: 'resp_tools',
      instructions: 'Answer from the documents.',
      tool_choice: { type: 'function', name: 'search' },
      input: [{ type: 'function_call_output', call_id: 'call_a', output: '{"hits":2}' }],
    });
  });

  it('leaves out tools and reasoning when there are none', async () => {
    const { client, calls } = stubOpenAi(() => replay(textEvents));
    await client.turn(turnRequest({ tools: [] }));
    for (const key of ['tools', 'tool_choice', 'parallel_tool_calls', 'reasoning']) {
      expect(calls[0]!.body).not.toHaveProperty(key);
    }
  });

  it('emits stream events and returns the calls, usage and response id', async () => {
    const { client } = stubOpenAi(() => replay(toolCallEvents));
    const events: ModelStreamEvent[] = [];
    const result = await client.turn(turnRequest({ onEvent: (event) => events.push(event) }));

    expect(events[0]).toEqual({ type: 'tool_call_started', callId: 'call_a', name: 'search' });
    expect(events.filter((event) => event.type === 'tool_arguments_delta')).toHaveLength(3);
    expect(result).toEqual({
      responseId: 'resp_tools',
      text: '',
      functionCalls: [
        { callId: 'call_a', name: 'search', arguments: '{"query":"steel"}' },
        { callId: 'call_b', name: 'list_documents', arguments: '{}' },
      ],
      refusal: null,
      usage: { inputTokens: 1200, cachedInputTokens: 1000, outputTokens: 80, reasoningTokens: 30 },
    });
  });

  it('returns streamed text', async () => {
    const { client } = stubOpenAi(() => replay(textEvents));
    const deltas: string[] = [];
    const result = await client.turn(
      turnRequest({ onEvent: (event) => event.type === 'text_delta' && deltas.push(event.delta) }),
    );
    expect(deltas.join('')).toBe('The total is SAR 1,200.');
    expect(result.text).toBe('The total is SAR 1,200.');
  });

  it('maps an error thrown mid-stream', async () => {
    const midStream = new APIError(undefined, { code: 'server_error', message: 'The server had an error.' }, undefined, new Headers());
    const { client } = stubOpenAi(() => replay(toolCallEvents.slice(0, 6), midStream));
    const error = await rejection(client.turn(turnRequest()));
    expect(error.code).toBe('model_error');
    expect(error.message).toBe('The model call failed: The server had an error.');
  });

  it('maps an error thrown before the stream starts', async () => {
    const { client } = stubOpenAi(() => {
      throw new APIConnectionError({ message: 'fetch failed' });
    });
    expect((await rejection(client.turn(turnRequest()))).message).toBe('Could not reach OpenAI. Check the internet connection.');
  });

  it('reports stopped when the request is aborted and the stream ends quietly', async () => {
    const controller = new AbortController();
    const { client } = stubOpenAi(() =>
      (async function* () {
        yield toolCallEvents[0]!;
        controller.abort();
      })(),
    );
    expect((await rejection(client.turn(turnRequest({ signal: controller.signal })))).code).toBe('stopped');
  });

  it('fails when the stream ends without a final response', async () => {
    const { client } = stubOpenAi(() => replay(toolCallEvents.slice(0, 5)));
    const error = await rejection(client.turn(turnRequest()));
    expect(error.code).toBe('model_error');
    expect(error.message).toBe('The model call failed: the reply ended before it finished.');
  });

  it('fails with the reason when the response is incomplete', async () => {
    const incomplete = fakeResponse({ status: 'incomplete', incomplete_details: { reason: 'max_output_tokens' }, output: [] });
    const { client } = stubOpenAi(() => replay([{ type: 'response.incomplete', response: incomplete, sequence_number: 0 }]));
    expect((await rejection(client.turn(turnRequest()))).message).toContain('output token limit');
  });
});

describe('OpenAiModelClient.generateObject', () => {
  const Schema = z.object({ category: z.enum(['boq', 'spec', 'other']), confidence: z.number() });

  function replying(text: string) {
    return stubOpenAi(() =>
      fakeResponse({ output: [{ type: 'message', role: 'assistant', content: [{ type: 'output_text', text }] }] }),
    );
  }

  it('asks for the schema as a strict text format and returns the parsed value with usage', async () => {
    const { client, calls } = replying('{"category":"boq","confidence":0.9}');
    const result = await client.generateObject({
      model: 'gpt-6-luna',
      instructions: 'Classify the document.',
      input: 'Bill of quantities, page 1',
      schema: Schema,
      schemaName: 'classification',
    });
    expect(result.value).toEqual({ category: 'boq', confidence: 0.9 });
    expect(result.usage.inputTokens).toBe(1200);
    expect(calls[0]!.body).toMatchObject({
      model: 'gpt-6-luna',
      input: 'Bill of quantities, page 1',
      store: false,
      text: { format: { type: 'json_schema', name: 'classification', strict: true } },
    });
    expect(calls[0]!.body).not.toHaveProperty('stream');
  });

  it('throws model_refusal when the model refuses', async () => {
    const { client } = stubOpenAi(() =>
      fakeResponse({ output: [{ type: 'message', role: 'assistant', content: [{ type: 'refusal', refusal: 'No.' }] }] }),
    );
    const error = await rejection(
      client.generateObject({ model: 'm', instructions: 'i', input: 'x', schema: Schema, schemaName: 'c' }),
    );
    expect(error.code).toBe('model_refusal');
    expect(error.message).toBe('The model declined to answer: No.');
  });

  it('throws model_error when the reply does not match the schema', async () => {
    const { client } = replying('{"category":"invoice"}');
    const error = await rejection(
      client.generateObject({ model: 'm', instructions: 'i', input: 'x', schema: Schema, schemaName: 'c' }),
    );
    expect(error.message).toBe('The model call failed: the reply did not match the expected format.');
  });
});

describe('OpenAiModelClient.listModels', () => {
  it('returns the model ids', async () => {
    const { client } = stubOpenAi(() => null, ['gpt-6-luna', 'gpt-6-astra']);
    expect(await client.listModels()).toEqual(['gpt-6-luna', 'gpt-6-astra']);
  });

  it('maps a listing failure', async () => {
    const { client } = stubOpenAi(() => null, new APIConnectionError({ message: 'offline' }));
    expect((await rejection(client.listModels())).code).toBe('model_error');
  });
});
