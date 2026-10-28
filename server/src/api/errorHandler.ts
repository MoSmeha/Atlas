import type { FastifyInstance } from 'fastify';
import { ZodError, z } from 'zod';
import type { ErrorBody, ErrorCode } from '@atlas/shared';
import { AppError } from '../application/errors';

const statusByCode: Record<ErrorCode, number> = {
  missing_api_key: 503,
  folder_not_found: 404,
  folder_empty: 422,
  not_indexed: 409,
  document_not_found: 404,
  result_not_found: 404,
  rate_limited: 429,
  model_refusal: 422,
  model_error: 502,
  stopped: 499,
  invalid_request: 400,
  internal: 500,
};

export function statusFor(code: ErrorCode): number {
  return statusByCode[code];
}

/** Turns any thrown value into the API error body. */
export function toErrorBody(error: unknown): ErrorBody {
  if (error instanceof AppError) {
    return { error: { code: error.code, message: error.message, retryAfterSeconds: error.retryAfterSeconds } };
  }
  if (error instanceof ZodError) {
    return { error: { code: 'invalid_request', message: z.prettifyError(error) } };
  }
  if (isFastifyValidationError(error)) {
    return { error: { code: 'invalid_request', message: error.message } };
  }
  return { error: { code: 'internal', message: 'Something went wrong on the server. Details are in the server log.' } };
}

export function registerErrorHandler(app: FastifyInstance): void {
  app.setErrorHandler((error, request, reply) => {
    const body = toErrorBody(error);
    if (body.error.code === 'internal') request.log.error(error);
    return reply.status(statusFor(body.error.code)).send(body);
  });
  app.setNotFoundHandler((request, reply) =>
    reply.status(404).send({ error: { code: 'invalid_request', message: `No route ${request.method} ${request.url}` } }),
  );
}

function isFastifyValidationError(error: unknown): error is Error & { validation: unknown } {
  return error instanceof Error && 'validation' in error;
}
