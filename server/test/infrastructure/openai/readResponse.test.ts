import { describe, expect, it } from 'vitest';
import { AppError } from '../../../src/application/errors';
import { readResponse, toTokenUsage } from '../../../src/infrastructure/openai/readResponse';
import { fakeResponse } from './recordedStreams';

function thrown(run: () => unknown): AppError {
  try {
    run();
  } catch (error) {
    if (error instanceof AppError) return error;
    throw error;
  }
  throw new Error('expected an AppError');
}

describe('readResponse', () => {
  it('collects function calls with their raw arguments, in order', () => {
    const result = readResponse(
      fakeResponse({
        id: 'resp_9',
        output: [
          { type: 'reasoning', id: 'rs_1', summary: [] },
          { type: 'function_call', id: 'fc_1', call_id: 'call_a', name: 'search', arguments: '{"query":"steel"}' },
          { type: 'function_call', id: 'fc_2', call_id: 'call_b', name: 'list_documents', arguments: '{}' },
        ],
      }),
    );
    expect(result.responseId).toBe('resp_9');
    expect(result.functionCalls).toEqual([
      { callId: 'call_a', name: 'search', arguments: '{"query":"steel"}' },
      { callId: 'call_b', name: 'list_documents', arguments: '{}' },
    ]);
    expect(result.text).toBe('');
    expect(result.refusal).toBeNull();
  });

  it('joins the text of output messages', () => {
    const result = readResponse(
      fakeResponse({
        output: [
          { type: 'message', role: 'assistant', content: [{ type: 'output_text', text: 'Part one. ' }, { type: 'output_text', text: 'Part two.' }] },
          { type: 'message', role: 'assistant', content: [{ type: 'output_text', text: 'Next message.' }] },
        ],
      }),
    );
    expect(result.text).toBe('Part one. Part two.\n\nNext message.');
  });

  it('returns a refusal instead of throwing, so the loop can decide', () => {
    const result = readResponse(
      fakeResponse({ output: [{ type: 'message', role: 'assistant', content: [{ type: 'refusal', refusal: 'I cannot help with that.' }] }] }),
    );
    expect(result.refusal).toBe('I cannot help with that.');
    expect(result.text).toBe('');
  });

  it('maps usage, including cached and reasoning tokens', () => {
    expect(readResponse(fakeResponse({ output: [] })).usage).toEqual({
      inputTokens: 1200,
      cachedInputTokens: 1000,
      outputTokens: 80,
      reasoningTokens: 30,
    });
    expect(toTokenUsage(undefined)).toEqual({ inputTokens: 0, cachedInputTokens: 0, outputTokens: 0, reasoningTokens: 0 });
  });

  it('throws model_error with the reason when the response is incomplete', () => {
    const error = thrown(() =>
      readResponse(fakeResponse({ status: 'incomplete', incomplete_details: { reason: 'max_output_tokens' }, output: [] })),
    );
    expect(error.code).toBe('model_error');
    expect(error.message).toBe('The model call failed: the reply reached the output token limit before it finished.');
  });

  it('throws model_error with the API message when the response failed', () => {
    const error = thrown(() =>
      readResponse(fakeResponse({ status: 'failed', error: { code: 'server_error', message: 'The server had an error.' }, output: [] })),
    );
    expect(error.code).toBe('model_error');
    expect(error.message).toBe('The model call failed: The server had an error.');
  });

  it('throws stopped when the response was cancelled', () => {
    expect(thrown(() => readResponse(fakeResponse({ status: 'cancelled', output: [] }))).code).toBe('stopped');
  });
});
