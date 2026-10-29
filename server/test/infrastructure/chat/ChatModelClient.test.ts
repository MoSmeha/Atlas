import type OpenAI from 'openai';
import { APIConnectionError, APIError } from 'openai';
import type { ChatCompletionChunk } from 'openai/resources/chat/completions';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { AppError } from '../../../src/application/errors';
import type { ModelStreamEvent, ModelTurnRequest } from '../../../src/application/ports/ModelClient';
import { ChatModelClient, type ChatModelClientOptions } from '../../../src/infrastructure/chat/ChatModelClient';

interface Call {
  body: Record<string, any>;
  options: { signal?: AbortSignal };
}

const GEMINI: ChatModelClientOptions = { vendor: { name: 'Gemini', keyVariable: 'GEMINI_API_KEY' }, sendsReasoning: true };
const OLLAMA: ChatModelClientOptions = { vendor: { name: 'Ollama', keyVariable: null }, sendsReasoning: false };

/** A stand-in for the SDK client: records request bodies and answers with the given handler. No network. */
function stubChat(answer: (body: Record<string, any>) => unknown, options = GEMINI, modelIds: string[] = []) {
  const calls: Call[] = [];
  const client = {
    chat: {
      completions: {
        create: async (body: Record<string, any>, requestOptions: Call['options']) => {
          calls.push({ body: structuredClone(body), options: requestOptions });
          return answer(body);
        },
      },
    },
    models: {
      list: () =>
        (async function* () {
          for (const id of modelIds) yield { id };
        })(),
    },
  };
  return { client: new ChatModelClient(client as unknown as OpenAI, options), calls };
}

function chunk(delta: ChatCompletionChunk.Choice.Delta, finishReason: ChatCompletionChunk.Choice['finish_reason'] = null): ChatCompletionChunk {
  return { id: 'chatcmpl-1', object: 'chat.completion.chunk', created: 0, model: 'm', choices: [{ index: 0, delta, finish_reason: finishReason }] };
}

const usageChunk: ChatCompletionChunk = {
  ...chunk({}),
  choices: [],
  usage: { prompt_tokens: 900, completion_tokens: 40, total_tokens: 940, completion_tokens_details: { reasoning_tokens: 12 } },
};

const toolCallChunks = [
  chunk({ tool_calls: [{ index: 0, id: 'call_a', type: 'function', function: { name: 'search', arguments: '{"query":' } }] }),
  chunk({ tool_calls: [{ index: 0, function: { arguments: '"steel"}' } }] }, 'tool_calls'),
  usageChunk,
];

const textChunks = [chunk({ content: 'The total is ' }), chunk({ content: 'SAR 1,200.' }, 'stop'), usageChunk];

async function* replay(chunks: ChatCompletionChunk[], failWith?: unknown) {
  for (const next of chunks) yield next;
  if (failWith !== undefined) throw failWith;
}

function turnRequest(overrides: Partial<ModelTurnRequest> = {}): ModelTurnRequest {
  return {
    model: 'gemini-3.8-flash',
    instructions: 'Answer from the documents.',
    input: [{ type: 'message', role: 'user', content: 'Which items use steel?' }],
    tools: [{ name: 'search', description: 'Searches the documents.', parameters: z.object({ query: z.string() }) }],
    toolChoice: 'required',
    previousResponseId: null,
    reasoningEffort: 'medium',
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

describe('ChatModelClient.turn', () => {
  it('sends a streamed request with the instructions first, the tools, the tool choice and the reasoning effort', async () => {
    const { client, calls } = stubChat(() => replay(toolCallChunks));
    const signal = new AbortController().signal;
    await client.turn(turnRequest({ signal }));

    const { body, options } = calls[0]!;
    expect(body).toMatchObject({
      model: 'gemini-3.8-flash',
      messages: [
        { role: 'system', content: 'Answer from the documents.' },
        { role: 'user', content: 'Which items use steel?' },
      ],
      tool_choice: 'required',
      reasoning_effort: 'medium',
      stream: true,
      stream_options: { include_usage: true },
    });
    expect(body.tools).toEqual([
      {
        type: 'function',
        function: { name: 'search', description: 'Searches the documents.', parameters: expect.objectContaining({ type: 'object', additionalProperties: false }) },
      },
    ]);
    expect(options.signal).toBe(signal);
  });

  it('returns the calls and usage, and emits the stream events', async () => {
    const { client } = stubChat(() => replay(toolCallChunks));
    const events: ModelStreamEvent[] = [];
    const result = await client.turn(turnRequest({ onEvent: (event) => events.push(event) }));

    expect(result).toEqual({
      responseId: expect.stringMatching(/^chat_/),
      text: '',
      functionCalls: [{ callId: 'call_a', name: 'search', arguments: '{"query":"steel"}' }],
      refusal: null,
      usage: { inputTokens: 900, cachedInputTokens: 0, outputTokens: 40, reasoningTokens: 12 },
    });
    expect(events.map((event) => event.type)).toEqual(['tool_call_started', 'tool_arguments_delta', 'tool_arguments_delta']);
  });

  it('continues a conversation by sending it again: the earlier messages, the calls and the new tool outputs', async () => {
    const { client, calls } = stubChat((body) => replay(body.messages.length > 2 ? textChunks : toolCallChunks));
    const first = await client.turn(turnRequest());
    await client.turn(
      turnRequest({
        previousResponseId: first.responseId,
        toolChoice: { name: 'submit_answer' },
        input: [{ type: 'tool_output', callId: 'call_a', output: '{"hits":2}' }],
      }),
    );

    expect(calls[1]!.body.messages).toEqual([
      { role: 'system', content: 'Answer from the documents.' },
      { role: 'user', content: 'Which items use steel?' },
      {
        role: 'assistant',
        content: null,
        tool_calls: [{ id: 'call_a', type: 'function', function: { name: 'search', arguments: '{"query":"steel"}' } }],
      },
      { role: 'tool', tool_call_id: 'call_a', content: '{"hits":2}' },
    ]);
    expect(calls[1]!.body.tool_choice).toEqual({ type: 'function', function: { name: 'submit_answer' } });
  });

  it('keeps a conversation for one continuation only', async () => {
    const { client } = stubChat(() => replay(textChunks));
    const first = await client.turn(turnRequest());
    await client.turn(turnRequest({ previousResponseId: first.responseId, input: [] }));
    const error = await rejection(client.turn(turnRequest({ previousResponseId: first.responseId, input: [] })));
    expect(error.message).toBe('The model call failed: the conversation it continues is no longer kept.');
  });

  it('leaves out tools when there are none, and reasoning for a server that refuses it', async () => {
    const { client, calls } = stubChat(() => replay(textChunks), OLLAMA);
    const result = await client.turn(turnRequest({ tools: [] }));
    for (const key of ['tools', 'tool_choice', 'reasoning_effort']) expect(calls[0]!.body).not.toHaveProperty(key);
    expect(result.text).toBe('The total is SAR 1,200.');
  });

  it('asks for the most reasoning Chat Completions has when more is requested', async () => {
    const { client, calls } = stubChat(() => replay(textChunks));
    await client.turn(turnRequest({ reasoningEffort: 'max' }));
    expect(calls[0]!.body.reasoning_effort).toBe('high');
  });

  it('fails when the reply hit the output limit', async () => {
    const { client } = stubChat(() => replay([chunk({ content: 'The total' }, 'length')]));
    expect((await rejection(client.turn(turnRequest()))).message).toContain('output token limit');
  });

  it('names the provider when it cannot be reached, and tells a local one apart', async () => {
    const unreachable = () => {
      throw new APIConnectionError({ message: 'fetch failed' });
    };
    expect((await rejection(stubChat(unreachable).client.turn(turnRequest()))).message).toBe(
      'Could not reach Gemini. Check the internet connection.',
    );
    expect((await rejection(stubChat(unreachable, OLLAMA).client.turn(turnRequest()))).message).toBe(
      'Could not reach Ollama. Check that it is running.',
    );
  });

  it('maps an error thrown mid-stream', async () => {
    const midStream = new APIError(500, { message: 'Internal error.' }, undefined, new Headers());
    const { client } = stubChat(() => replay(toolCallChunks.slice(0, 1), midStream));
    expect((await rejection(client.turn(turnRequest()))).message).toBe('The model call failed: Internal error.');
  });

  it('reports stopped when the request is aborted and the stream ends quietly', async () => {
    const controller = new AbortController();
    const { client } = stubChat(() =>
      (async function* () {
        yield toolCallChunks[0]!;
        controller.abort();
      })(),
    );
    expect((await rejection(client.turn(turnRequest({ signal: controller.signal })))).code).toBe('stopped');
  });
});

describe('ChatModelClient.generateObject', () => {
  const schema = z.object({ type: z.string(), confidence: z.number() });
  const completion = (content: string | null, extra: Record<string, unknown> = {}) => ({
    id: 'c',
    choices: [{ index: 0, finish_reason: 'stop', message: { role: 'assistant', content, refusal: null, ...extra } }],
    usage: { prompt_tokens: 50, completion_tokens: 10, total_tokens: 60 },
  });

  it('asks for the schema as a JSON response format and parses the reply', async () => {
    const { client, calls } = stubChat(() => completion('{"type":"contract","confidence":0.9}'));
    const result = await client.generateObject({ model: 'gemini-3.5-flash-lite', instructions: 'Classify.', input: 'Main Contract.pdf', schema, schemaName: 'classification' });

    expect(result).toEqual({ value: { type: 'contract', confidence: 0.9 }, usage: { inputTokens: 50, cachedInputTokens: 0, outputTokens: 10, reasoningTokens: 0 } });
    expect(calls[0]!.body).toMatchObject({
      model: 'gemini-3.5-flash-lite',
      messages: [
        { role: 'system', content: 'Classify.' },
        { role: 'user', content: 'Main Contract.pdf' },
      ],
      response_format: { type: 'json_schema', json_schema: expect.objectContaining({ name: 'classification', strict: true }) },
    });
  });

  it('fails on a refusal or a reply that does not match', async () => {
    const refused = stubChat(() => completion(null, { refusal: 'No.' })).client;
    expect((await rejection(refused.generateObject({ model: 'm', instructions: 'i', input: 'x', schema, schemaName: 's' }))).code).toBe('model_refusal');
    const wrong = stubChat(() => completion('{"type":3}')).client;
    expect((await rejection(wrong.generateObject({ model: 'm', instructions: 'i', input: 'x', schema, schemaName: 's' }))).message).toContain('did not match');
  });
});

describe('ChatModelClient.listModels', () => {
  it('drops the models/ prefix Gemini puts on its ids', async () => {
    const { client } = stubChat(() => null, GEMINI, ['models/gemini-3.8-flash', 'qwen3:14b']);
    expect(await client.listModels()).toEqual(['gemini-3.8-flash', 'qwen3:14b']);
  });
});
