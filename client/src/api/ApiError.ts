import type { ErrorCode, ErrorDetail } from '@atlas/shared';

/** The API's error codes plus "unreachable": no answer came back from the Atlas server. */
export type ApiErrorCode = ErrorCode | 'unreachable';

/** Every failed request or stream ends up as one of these, with a message fit to show the user. */
export class ApiError extends Error {
  readonly code: ApiErrorCode;
  /** HTTP status, or null when no response arrived or the error came inside an event stream. */
  readonly status: number | null;
  readonly retryAfterSeconds: number | null;

  constructor(code: ApiErrorCode, message: string, status: number | null = null, retryAfterSeconds: number | null = null) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
    this.retryAfterSeconds = retryAfterSeconds;
  }

  static fromDetail(detail: ErrorDetail, status: number | null = null): ApiError {
    return new ApiError(detail.code, detail.message, status, detail.retryAfterSeconds ?? null);
  }
}

export const unreachableMessage = 'Atlas cannot reach its server. Check that it is running, then try again.';

/** True for the error fetch and stream reads throw after an AbortController fires. */
export function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError';
}

/** Turns anything thrown into an ApiError, so callers handle one shape. */
export function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;
  if (error instanceof TypeError) return new ApiError('unreachable', unreachableMessage);
  return new ApiError('internal', 'Something went wrong in Atlas. Try again, and reload the page if it keeps happening.');
}
