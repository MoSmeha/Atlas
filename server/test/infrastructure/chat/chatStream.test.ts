import type { ChatCompletionChunk } from 'openai/resources/chat/completions';
import { describe, expect, it } from 'vitest';
import type { ModelStreamEvent } from '../../../src/application/ports/ModelClient';
import {
  assistantMessage,
  functionCalls,
  initialChatStreamState,
  reduceChatChunk,
  type ChatStreamState,
} from '../../../src/infrastructure/chat/chatStream';

type Delta = ChatCompletionChunk.Choice.Delta;

function chunk(delta: Delta, finishReason: ChatCompletionChunk.Choice['finish_reason'] = null): ChatCompletionChunk {
  return { id: 'chatcmpl-1', object: 'chat.completion.chunk', created: 0, model: 'm', choices: [{ index: 0, delta, finish_reason: finishReason }] };
}

function replay(chunks: ChatCompletionChunk[]): { state: ChatStreamState; events: ModelStreamEvent[] } {
  let state = initialChatStreamState;
  const events: ModelStreamEvent[] = [];
  for (const next of chunks) {
    const step = reduceChatChunk(state, next);
    state = step.state;
    events.push(...step.events);
  }
  return { state, events };
}

describe('reduceChatChunk', () => {
  it('streams text and keeps the finish reason and usage', () => {
    const usage = { prompt_tokens: 12, completion_tokens: 3, total_tokens: 15 };
    const { state, events } = replay([
      chunk({ role: 'assistant', content: 'The total ' }),
      chunk({ content: 'is 500.' }, 'stop'),
      { ...chunk({}), choices: [], usage },
    ]);
    expect(events).toEqual([
      { type: 'text_delta', delta: 'The total ' },
      { type: 'text_delta', delta: 'is 500.' },
    ]);
    expect(state).toMatchObject({ text: 'The total is 500.', finishReason: 'stop', usage });
  });

  it('builds tool calls from OpenAI-style deltas: id and name first, then arguments by index', () => {
    const { state, events } = replay([
      chunk({ tool_calls: [{ index: 0, id: 'call_a', type: 'function', function: { name: 'search', arguments: '' } }] }),
      chunk({ tool_calls: [{ index: 0, function: { arguments: '{"query":' } }] }),
      chunk({ tool_calls: [{ index: 1, id: 'call_b', function: { name: 'list_documents', arguments: '{}' } }] }),
      chunk({ tool_calls: [{ index: 0, function: { arguments: '"steel"}' } }] }, 'tool_calls'),
    ]);
    expect(functionCalls(state)).toEqual([
      { callId: 'call_a', name: 'search', arguments: '{"query":"steel"}' },
      { callId: 'call_b', name: 'list_documents', arguments: '{}' },
    ]);
    expect(events).toEqual([
      { type: 'tool_call_started', callId: 'call_a', name: 'search' },
      { type: 'tool_arguments_delta', callId: 'call_a', name: 'search', delta: '{"query":' },
      { type: 'tool_call_started', callId: 'call_b', name: 'list_documents' },
      { type: 'tool_arguments_delta', callId: 'call_b', name: 'list_documents', delta: '{}' },
      { type: 'tool_arguments_delta', callId: 'call_a', name: 'search', delta: '"steel"}' },
    ]);
  });

  it('takes whole calls that share one index but have different ids as separate calls', () => {
    const { state } = replay([
      chunk({
        tool_calls: [
          { index: 0, id: 'one', function: { name: 'search', arguments: '{"query":"a"}' } },
          { index: 0, id: 'two', function: { name: 'search', arguments: '{"query":"b"}' } },
        ],
      }),
    ]);
    expect(functionCalls(state).map((call) => call.callId)).toEqual(['one', 'two']);
  });

  it('gives a call without an id one made from the response id, and empty arguments become {}', () => {
    const missingIndex = { function: { name: 'list_documents' } } as unknown as ChatCompletionChunk.Choice.Delta.ToolCall;
    const { state } = replay([chunk({ tool_calls: [missingIndex] })]);
    expect(functionCalls(state)).toEqual([{ callId: 'chatcmpl-1_0', name: 'list_documents', arguments: '{}' }]);
  });

  it('keeps fields a server adds to a call, such as a Gemini thought signature, and replays them', () => {
    const signed = { index: 0, id: 'g1', function: { name: 'search', arguments: '{"query":"x"}' }, extra_content: { google: { thought_signature: 'sig' } } };
    const { state } = replay([chunk({ content: 'Looking.', tool_calls: [signed] })]);
    expect(assistantMessage(state)).toEqual({
      role: 'assistant',
      content: 'Looking.',
      tool_calls: [
        { extra_content: { google: { thought_signature: 'sig' } }, id: 'g1', type: 'function', function: { name: 'search', arguments: '{"query":"x"}' } },
      ],
    });
  });

  it('replays a reply without calls as plain text, and an empty one as null content', () => {
    expect(assistantMessage(replay([chunk({ content: 'Done.' })]).state)).toEqual({ role: 'assistant', content: 'Done.' });
    expect(assistantMessage(initialChatStreamState)).toEqual({ role: 'assistant', content: null });
  });

  it('collects a refusal apart from the text', () => {
    const { state, events } = replay([chunk({ refusal: 'I cannot help ' }), chunk({ refusal: 'with that.' }, 'stop')]);
    expect(state.refusal).toBe('I cannot help with that.');
    expect(events).toEqual([]);
  });
});
