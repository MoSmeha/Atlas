import { z } from 'zod';

/** Every error the API can return. The client shows a specific message per code. */
export const ErrorCode = z.enum([
  'missing_api_key',
  'folder_not_found',
  'folder_empty',
  'not_indexed',
  'document_not_found',
  'result_not_found',
  'rate_limited',
  'model_refusal',
  'model_error',
  'stopped',
  'invalid_request',
  'internal',
]);
export type ErrorCode = z.infer<typeof ErrorCode>;

export const ErrorDetail = z.object({
  code: ErrorCode,
  message: z.string(),
  retryAfterSeconds: z.number().nullable().optional(),
});
export type ErrorDetail = z.infer<typeof ErrorDetail>;

export const ErrorBody = z.object({ error: ErrorDetail });
export type ErrorBody = z.infer<typeof ErrorBody>;
