import type { ChatCompletionChunk, ChatCompletionMessageParam } from 'openai/resources/chat/completions';
import type { CompletionUsage } from 'openai/resources/completions';
import type { FunctionCall, ModelStreamEvent } from '../../application/ports/ModelClient';

type ToolCallDelta = ChatCompletionChunk.Choice.Delta.ToolCall;

/** Fields of a streamed tool call that OpenAI defines; anything else a server adds is kept and sent back. */
const KNOWN_CALL_FIELDS = new Set(['index', 'id', 'type', 'function', 'custom']);

/** One tool call as its deltas arrive. */
export interface StreamedCall {
  callId: string;
  /** Empty until the delta that names the function arrives. */
  name: string;
  arguments: string;
  /** The index the server numbers this call's deltas with, when it gives one. */
  index: number | null;
  /** Fields beyond OpenAI's, such as Gemini's thought signature in `extra_content`; the next turn must repeat them. */
  extra: Readonly<Record<string, unknown>>;
}

/** What a streamed Chat Completions turn has seen so far. */
export interface ChatStreamState {
  readonly id: string;
  readonly text: string;
  readonly refusal: string;
  readonly calls: readonly StreamedCall[];
  readonly finishReason: string | null;
  /** From the last chunk, when the request asked for `stream_options.include_usage`. */
  readonly usage: CompletionUsage | null;
}

export const initialChatStreamState: ChatStreamState = { id: '', text: '', refusal: '', calls: [], finishReason: null, usage: null };

/** Folds one chunk into the state and returns the port events to emit. Pure. */
export function reduceChatChunk(state: ChatStreamState, chunk: ChatCompletionChunk): { state: ChatStreamState; events: ModelStreamEvent[] } {
  const events: ModelStreamEvent[] = [];
  let next: ChatStreamState = { ...state, id: state.id || chunk.id, usage: chunk.usage ?? state.usage };
  // Only the first choice is used: requests never ask for more.
  const choice = chunk.choices?.[0];
  if (!choice) return { state: next, events };
  const { delta } = choice;
  if (delta?.content) {
    next = { ...next, text: next.text + delta.content };
    events.push({ type: 'text_delta', delta: delta.content });
  }
  if (delta?.refusal) next = { ...next, refusal: next.refusal + delta.refusal };
  for (const callDelta of delta?.tool_calls ?? []) {
    const step = applyCallDelta(next.calls, callDelta, next.id);
    next = { ...next, calls: step.calls };
    events.push(...step.events);
  }
  if (choice.finish_reason) next = { ...next, finishReason: choice.finish_reason };
  return { state: next, events };
}

/** The finished calls, as the port reports them. A call with no arguments gets `{}`, which every tool schema reads. */
export function functionCalls(state: ChatStreamState): FunctionCall[] {
  return state.calls
    .filter((call) => call.name !== '')
    .map((call) => ({ callId: call.callId, name: call.name, arguments: call.arguments.trim() === '' ? '{}' : call.arguments }));
}

/** The assistant message to replay in the next turn: its text and its calls, with any extra fields the server sent. */
export function assistantMessage(state: ChatStreamState): ChatCompletionMessageParam {
  const calls = functionCalls(state);
  const extras = new Map(state.calls.map((call) => [call.callId, call.extra]));
  return {
    role: 'assistant',
    content: state.text === '' ? null : state.text,
    ...(calls.length === 0
      ? {}
      : {
          tool_calls: calls.map((call) => ({
            ...extras.get(call.callId),
            id: call.callId,
            type: 'function' as const,
            function: { name: call.name, arguments: call.arguments },
          })),
        }),
  };
}

function applyCallDelta(
  calls: readonly StreamedCall[],
  delta: ToolCallDelta,
  responseId: string,
): { calls: StreamedCall[]; events: ModelStreamEvent[] } {
  const events: ModelStreamEvent[] = [];
  const at = slotFor(calls, delta);
  const existing = at === -1 ? null : (calls[at] ?? null);
  const before: StreamedCall = existing ?? {
    callId: delta.id || `${responseId || 'call'}_${calls.length}`,
    name: '',
    arguments: '',
    index: delta.index ?? null,
    extra: {},
  };
  const name = before.name || (delta.function?.name ?? '');
  const call: StreamedCall = {
    ...before,
    name,
    arguments: before.arguments + (delta.function?.arguments ?? ''),
    extra: { ...before.extra, ...extraFields(delta) },
  };
  const ref = { callId: call.callId, name: call.name };
  if (before.name === '' && name !== '') events.push({ type: 'tool_call_started', ...ref });
  // Arguments that came before the name are part of call.arguments, so they go out with the first delta after it.
  const argumentsDelta = before.name === '' ? call.arguments : (delta.function?.arguments ?? '');
  if (name !== '' && argumentsDelta !== '') events.push({ type: 'tool_arguments_delta', ...ref, delta: argumentsDelta });
  const updated = [...calls];
  if (at === -1) updated.push(call);
  else updated[at] = call;
  return { calls: updated, events };
}

/**
 * Which call a delta belongs to, or -1 for a new one. Deltas usually carry the call's index; some servers send each
 * call whole with an id and no index, or reuse one index for calls with different ids.
 */
function slotFor(calls: readonly StreamedCall[], delta: ToolCallDelta): number {
  const index = delta.index ?? null;
  if (index !== null) {
    const at = calls.findLastIndex((call) => call.index === index);
    const other = at !== -1 && delta.id !== undefined && delta.id !== '' && calls[at]?.callId !== delta.id;
    if (at !== -1 && !other) return at;
  }
  if (delta.id) {
    const at = calls.findIndex((call) => call.callId === delta.id);
    if (at !== -1) return at;
  }
  if (index !== null || delta.id || delta.function?.name) return -1;
  return calls.length - 1;
}

function extraFields(delta: ToolCallDelta): Record<string, unknown> {
  return Object.fromEntries(Object.entries(delta).filter(([key]) => !KNOWN_CALL_FIELDS.has(key)));
}
