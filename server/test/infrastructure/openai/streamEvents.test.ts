import type { ResponseStreamEvent } from 'openai/resources/responses/responses';
import { describe, expect, it } from 'vitest';
import type { ModelStreamEvent } from '../../../src/application/ports/ModelClient';
import { initialStreamState, reduceStreamEvent, type StreamState } from '../../../src/infrastructure/openai/streamEvents';
import { fakeResponse, textEvents, toolCallEvents } from './recordedStreams';

function fold(events: ResponseStreamEvent[], start: StreamState = initialStreamState) {
  let state = start;
  const emitted: ModelStreamEvent[] = [];
  for (const event of events) {
    const step = reduceStreamEvent(state, event);
    state = step.state;
    emitted.push(...step.events);
  }
  return { state, emitted };
}

describe('reduceStreamEvent', () => {
  it('names each function call and tags its argument deltas with the call id', () => {
    const { emitted } = fold(toolCallEvents);
    expect(emitted).toEqual([
      { type: 'tool_call_started', callId: 'call_a', name: 'search' },
      { type: 'tool_arguments_delta', callId: 'call_a', name: 'search', delta: '{"query":' },
      { type: 'tool_arguments_delta', callId: 'call_a', name: 'search', delta: '"steel"}' },
      { type: 'tool_call_started', callId: 'call_b', name: 'list_documents' },
      { type: 'tool_arguments_delta', callId: 'call_b', name: 'list_documents', delta: '{}' },
    ]);
  });

  it('keeps the completed response', () => {
    const { state } = fold(toolCallEvents);
    expect(state.response?.id).toBe('resp_tools');
    expect(state.error).toBeNull();
  });

  it('streams text deltas', () => {
    const { state, emitted } = fold(textEvents);
    expect(emitted).toEqual([
      { type: 'text_delta', delta: 'The total ' },
      { type: 'text_delta', delta: 'is SAR 1,200.' },
    ]);
    expect(state.response?.id).toBe('resp_text');
  });

  it('does not change the previous state', () => {
    const before = initialStreamState;
    fold(toolCallEvents, before);
    expect(before).toEqual({ calls: {}, response: null, error: null });
  });

  it('ignores argument deltas for an unknown item', () => {
    const event = { type: 'response.function_call_arguments.delta', item_id: 'fc_x', output_index: 5, delta: '{}', sequence_number: 1 };
    expect(reduceStreamEvent(initialStreamState, event as ResponseStreamEvent).events).toEqual([]);
  });

  it('falls back to the output index when the call item has no id, and emits arguments already present', () => {
    const { emitted } = fold([
      {
        type: 'response.output_item.added',
        output_index: 3,
        sequence_number: 1,
        item: { type: 'function_call', call_id: 'call_c', name: 'calculate', arguments: '{"a"' },
      },
      { type: 'response.function_call_arguments.delta', item_id: 'unknown', output_index: 3, delta: ':1}', sequence_number: 2 },
    ] as ResponseStreamEvent[]);
    expect(emitted).toEqual([
      { type: 'tool_call_started', callId: 'call_c', name: 'calculate' },
      { type: 'tool_arguments_delta', callId: 'call_c', name: 'calculate', delta: '{"a"' },
      { type: 'tool_arguments_delta', callId: 'call_c', name: 'calculate', delta: ':1}' },
    ]);
  });

  it('keeps an incomplete or failed response for the caller to judge', () => {
    const incomplete = fakeResponse({ status: 'incomplete', incomplete_details: { reason: 'max_output_tokens' }, output: [] });
    const step = reduceStreamEvent(initialStreamState, {
      type: 'response.incomplete',
      response: incomplete,
      sequence_number: 9,
    });
    expect(step.state.response?.status).toBe('incomplete');
  });

  it('records an error event', () => {
    const step = reduceStreamEvent(initialStreamState, {
      type: 'error',
      code: 'server_error',
      message: 'The server had an error.',
      param: null,
      sequence_number: 4,
    });
    expect(step.state.error).toBe('The server had an error.');
    expect(step.events).toEqual([]);
  });
});
