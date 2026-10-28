import type { Response, ResponseStreamEvent } from 'openai/resources/responses/responses';
import type { ModelStreamEvent } from '../../application/ports/ModelClient';

interface CallRef {
  callId: string;
  name: string;
}

/** What a streamed turn has seen so far. */
export interface StreamState {
  /** Function calls by output item id; argument deltas only carry the item id. */
  readonly calls: Readonly<Record<string, CallRef>>;
  /** The final response, from response.completed, response.incomplete or response.failed. */
  readonly response: Response | null;
  /** Message of an `error` event, in case one arrives as an event instead of being thrown. */
  readonly error: string | null;
}

export const initialStreamState: StreamState = { calls: {}, response: null, error: null };

/** Folds one SDK stream event into the state and returns the port events to emit. Pure. */
export function reduceStreamEvent(
  state: StreamState,
  event: ResponseStreamEvent,
): { state: StreamState; events: ModelStreamEvent[] } {
  switch (event.type) {
    case 'response.output_item.added': {
      if (event.item.type !== 'function_call') return { state, events: [] };
      const call = { callId: event.item.call_id, name: event.item.name };
      const events: ModelStreamEvent[] = [{ type: 'tool_call_started', ...call }];
      if (event.item.arguments) events.push({ type: 'tool_arguments_delta', ...call, delta: event.item.arguments });
      const key = event.item.id ?? indexKey(event.output_index);
      return { state: { ...state, calls: { ...state.calls, [key]: call } }, events };
    }
    case 'response.function_call_arguments.delta': {
      const call = state.calls[event.item_id] ?? state.calls[indexKey(event.output_index)];
      return { state, events: call ? [{ type: 'tool_arguments_delta', ...call, delta: event.delta }] : [] };
    }
    case 'response.output_text.delta':
      return { state, events: [{ type: 'text_delta', delta: event.delta }] };
    case 'response.completed':
    case 'response.incomplete':
    case 'response.failed':
      return { state: { ...state, response: event.response }, events: [] };
    case 'error':
      return { state: { ...state, error: event.message }, events: [] };
    default:
      return { state, events: [] };
  }
}

function indexKey(outputIndex: number): string {
  return `#${outputIndex}`;
}
