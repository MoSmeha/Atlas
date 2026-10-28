import {
  APIConnectionError,
  APIConnectionTimeoutError,
  APIError,
  APIUserAbortError,
  AuthenticationError,
  BadRequestError,
  RateLimitError,
} from 'openai';
import { describe, expect, it } from 'vitest';
import { AppError, errors } from '../../../src/application/errors';
import { mapOpenAiError } from '../../../src/infrastructure/openai/mapOpenAiError';

function rateLimit(headers: Record<string, string>, body: Record<string, string> = { code: 'rate_limit_exceeded' }) {
  return new RateLimitError(429, { message: 'Rate limit reached', ...body }, undefined, new Headers(headers));
}

describe('mapOpenAiError', () => {
  it('passes an AppError through unchanged', () => {
    const original = errors.notIndexed();
    expect(mapOpenAiError(original)).toBe(original);
  });

  it('reads the wait time from retry-after-ms first', () => {
    const mapped = mapOpenAiError(rateLimit({ 'retry-after-ms': '1500', 'retry-after': '30' }));
    expect(mapped.code).toBe('rate_limited');
    expect(mapped.retryAfterSeconds).toBe(2);
  });

  it('reads the wait time from retry-after in seconds', () => {
    expect(mapOpenAiError(rateLimit({ 'retry-after': '20' })).retryAfterSeconds).toBe(20);
  });

  it('falls back to the longest x-ratelimit-reset duration', () => {
    const mapped = mapOpenAiError(rateLimit({ 'x-ratelimit-reset-requests': '1s', 'x-ratelimit-reset-tokens': '6m0s' }));
    expect(mapped.retryAfterSeconds).toBe(360);
    expect(mapped.message).toContain('360 seconds');
  });

  it('rounds sub-second resets up to one second', () => {
    expect(mapOpenAiError(rateLimit({ 'x-ratelimit-reset-tokens': '250ms' })).retryAfterSeconds).toBe(1);
  });

  it('leaves the wait time empty when no header says it', () => {
    const mapped = mapOpenAiError(rateLimit({}));
    expect(mapped.code).toBe('rate_limited');
    expect(mapped.retryAfterSeconds).toBeNull();
  });

  it.each(['insufficient_quota', 'credit_balance_exhausted', 'organization_spend_limit_exceeded', 'project_spend_limit_exceeded'])(
    'reports the %s quota code as a billing problem, not a rate limit',
    (code) => {
      const mapped = mapOpenAiError(rateLimit({ 'retry-after': '5' }, { code }));
      expect(mapped.code).toBe('model_error');
      expect(mapped.message).toBe('Your OpenAI account has no remaining quota. Check billing.');
      expect(mapped.retryAfterSeconds).toBeNull();
    },
  );

  it('spots a quota problem from the error type when the code differs', () => {
    const mapped = mapOpenAiError(rateLimit({}, { code: 'something_else', type: 'insufficient_quota' }));
    expect(mapped.message).toBe('Your OpenAI account has no remaining quota. Check billing.');
  });

  it('explains a rejected key', () => {
    const error = new AuthenticationError(401, { message: 'Incorrect API key provided' }, undefined, new Headers());
    const mapped = mapOpenAiError(error);
    expect(mapped.code).toBe('missing_api_key');
    expect(mapped.message).toBe('The OpenAI API key was rejected. Check OPENAI_API_KEY in .env.');
  });

  it('maps a user abort to stopped', () => {
    expect(mapOpenAiError(new APIUserAbortError()).code).toBe('stopped');
    expect(mapOpenAiError(new DOMException('aborted', 'AbortError')).code).toBe('stopped');
  });

  it('explains a connection failure and a timeout', () => {
    const connection = mapOpenAiError(new APIConnectionError({ message: 'fetch failed' }));
    expect(connection.code).toBe('model_error');
    expect(connection.message).toBe('Could not reach OpenAI. Check the internet connection.');
    const timeout = mapOpenAiError(new APIConnectionTimeoutError());
    expect(timeout.code).toBe('model_error');
    expect(timeout.message).toBe('OpenAI did not answer in time. Try again.');
  });

  it('keeps the short API message for other errors', () => {
    const error = new BadRequestError(400, { message: "Invalid value: 'foo'." }, undefined, new Headers());
    const mapped = mapOpenAiError(error);
    expect(mapped).toBeInstanceOf(AppError);
    expect(mapped.code).toBe('model_error');
    expect(mapped.message).toBe("The model call failed: Invalid value: 'foo'.");
  });

  it('maps an error thrown mid-stream, which has no status', () => {
    const midStream = new APIError(undefined, { code: 'server_error', message: 'The server had an error.' }, undefined, new Headers());
    expect(mapOpenAiError(midStream).message).toBe('The model call failed: The server had an error.');
    const limited = new APIError(undefined, { code: 'rate_limit_exceeded', message: 'Slow down.' }, undefined, new Headers());
    expect(mapOpenAiError(limited).code).toBe('rate_limited');
  });

  it('maps an unknown error to model_error and shortens long messages', () => {
    const mapped = mapOpenAiError(new SyntaxError('x'.repeat(1000)));
    expect(mapped.code).toBe('model_error');
    expect(mapped.message.length).toBeLessThan(350);
  });
});
