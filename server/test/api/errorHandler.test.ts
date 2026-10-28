import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { statusFor, toErrorBody } from '../../src/api/errorHandler';
import { errors } from '../../src/application/errors';

describe('error mapping', () => {
  it('keeps the code and retry time of an application error', () => {
    const body = toErrorBody(errors.rateLimited(12));
    expect(body.error).toMatchObject({ code: 'rate_limited', retryAfterSeconds: 12 });
    expect(statusFor('rate_limited')).toBe(429);
  });

  it('maps a Zod error to invalid_request', () => {
    const result = z.object({ path: z.string() }).safeParse({});
    expect(result.success).toBe(false);
    if (!result.success) expect(toErrorBody(result.error).error.code).toBe('invalid_request');
  });

  it('hides the details of an unexpected error', () => {
    expect(toErrorBody(new Error('secret stack')).error).toMatchObject({ code: 'internal' });
    expect(toErrorBody(new Error('secret stack')).error.message).not.toContain('secret');
  });
});
