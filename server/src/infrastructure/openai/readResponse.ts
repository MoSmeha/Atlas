import type { Response, ResponseUsage } from 'openai/resources/responses/responses';
import { errors } from '../../application/errors';
import type { FunctionCall, ModelTurnResult } from '../../application/ports/ModelClient';
import type { TokenUsage } from '../../domain/pricing';

/**
 * Reads a finished response: its function calls, text, refusal and usage.
 * Throws model_error when the response failed or stopped early, and stopped when it was cancelled.
 */
export function readResponse(response: Response): ModelTurnResult {
  assertFinished(response);
  const functionCalls: FunctionCall[] = [];
  const texts: string[] = [];
  const refusals: string[] = [];
  for (const item of response.output) {
    if (item.type === 'function_call') {
      functionCalls.push({ callId: item.call_id, name: item.name, arguments: item.arguments });
    } else if (item.type === 'message') {
      const parts = item.content.map((part) => (part.type === 'output_text' ? part.text : '')).join('');
      if (parts !== '') texts.push(parts);
      for (const part of item.content) if (part.type === 'refusal') refusals.push(part.refusal);
    }
  }
  return {
    responseId: response.id,
    text: texts.join('\n\n'),
    functionCalls,
    refusal: refusals.length > 0 ? refusals.join(' ') : null,
    usage: toTokenUsage(response.usage),
  };
}

export function toTokenUsage(usage: ResponseUsage | undefined): TokenUsage {
  return {
    inputTokens: usage?.input_tokens ?? 0,
    cachedInputTokens: usage?.input_tokens_details?.cached_tokens ?? 0,
    outputTokens: usage?.output_tokens ?? 0,
    reasoningTokens: usage?.output_tokens_details?.reasoning_tokens ?? 0,
  };
}

function assertFinished(response: Response): void {
  switch (response.status) {
    case undefined:
    case 'completed':
      return;
    case 'incomplete':
      throw errors.modelError(incompleteReason(response.incomplete_details?.reason));
    case 'failed':
      throw errors.modelError(response.error?.message ?? 'OpenAI could not finish the reply.');
    case 'cancelled':
      throw errors.stopped();
    default:
      throw errors.modelError(`the reply ended while still ${response.status}.`);
  }
}

function incompleteReason(reason: string | undefined): string {
  if (reason === 'max_output_tokens') return 'the reply reached the output token limit before it finished.';
  if (reason === 'content_filter') return "OpenAI's content filter stopped the reply.";
  return `the reply stopped early (${reason ?? 'no reason given'}).`;
}
