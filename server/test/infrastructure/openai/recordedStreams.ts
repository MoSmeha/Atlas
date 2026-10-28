import type { Response, ResponseStreamEvent } from 'openai/resources/responses/responses';

/** A Response with only the fields Atlas reads; the rest of the SDK type is irrelevant here. */
export function fakeResponse(fields: Partial<Omit<Response, 'output'>> & { output: unknown[] }): Response {
  return {
    id: 'resp_1',
    object: 'response',
    status: 'completed',
    error: null,
    incomplete_details: null,
    usage: {
      input_tokens: 1200,
      input_tokens_details: { cached_tokens: 1000, cache_write_tokens: 0 },
      output_tokens: 80,
      output_tokens_details: { reasoning_tokens: 30 },
      total_tokens: 1280,
    },
    ...fields,
  } as unknown as Response;
}

function events(list: unknown[]): ResponseStreamEvent[] {
  return list.map((event, sequence_number) => ({ sequence_number, ...(event as object) })) as ResponseStreamEvent[];
}

const reasoningItem = { type: 'reasoning', id: 'rs_1', summary: [] };

/** A recorded turn: reasoning, then two parallel function calls. */
export const toolCallEvents = events([
  { type: 'response.created', response: fakeResponse({ status: 'in_progress', output: [], usage: undefined }) },
  { type: 'response.in_progress', response: fakeResponse({ status: 'in_progress', output: [], usage: undefined }) },
  { type: 'response.output_item.added', output_index: 0, item: reasoningItem },
  { type: 'response.output_item.done', output_index: 0, item: reasoningItem },
  {
    type: 'response.output_item.added',
    output_index: 1,
    item: { type: 'function_call', id: 'fc_1', call_id: 'call_a', name: 'search', arguments: '', status: 'in_progress' },
  },
  { type: 'response.function_call_arguments.delta', item_id: 'fc_1', output_index: 1, delta: '{"query":' },
  { type: 'response.function_call_arguments.delta', item_id: 'fc_1', output_index: 1, delta: '"steel"}' },
  { type: 'response.function_call_arguments.done', item_id: 'fc_1', output_index: 1, arguments: '{"query":"steel"}' },
  {
    type: 'response.output_item.added',
    output_index: 2,
    item: { type: 'function_call', id: 'fc_2', call_id: 'call_b', name: 'list_documents', arguments: '', status: 'in_progress' },
  },
  { type: 'response.function_call_arguments.delta', item_id: 'fc_2', output_index: 2, delta: '{}' },
  {
    type: 'response.completed',
    response: fakeResponse({
      id: 'resp_tools',
      output: [
        reasoningItem,
        { type: 'function_call', id: 'fc_1', call_id: 'call_a', name: 'search', arguments: '{"query":"steel"}', status: 'completed' },
        { type: 'function_call', id: 'fc_2', call_id: 'call_b', name: 'list_documents', arguments: '{}', status: 'completed' },
      ],
    }),
  },
]);

const messageItem = (text: string) => ({
  type: 'message',
  id: 'msg_1',
  role: 'assistant',
  status: 'completed',
  content: [{ type: 'output_text', text, annotations: [] }],
});

/** A recorded turn that streams a text reply. */
export const textEvents = events([
  { type: 'response.created', response: fakeResponse({ status: 'in_progress', output: [], usage: undefined }) },
  { type: 'response.output_item.added', output_index: 0, item: { ...messageItem(''), status: 'in_progress', content: [] } },
  { type: 'response.content_part.added', item_id: 'msg_1', output_index: 0, content_index: 0, part: { type: 'output_text', text: '' } },
  { type: 'response.output_text.delta', item_id: 'msg_1', output_index: 0, content_index: 0, delta: 'The total ', logprobs: [] },
  { type: 'response.output_text.delta', item_id: 'msg_1', output_index: 0, content_index: 0, delta: 'is SAR 1,200.', logprobs: [] },
  { type: 'response.output_text.done', item_id: 'msg_1', output_index: 0, content_index: 0, text: 'The total is SAR 1,200.' },
  { type: 'response.completed', response: fakeResponse({ id: 'resp_text', output: [messageItem('The total is SAR 1,200.')] }) },
]);
