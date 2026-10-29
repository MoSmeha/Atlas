import {
  APIConnectionError,
  APIConnectionTimeoutError,
  APIError,
  APIUserAbortError,
  AuthenticationError,
  RateLimitError,
} from 'openai';
import { AppError, errors } from '../../application/errors';

const MAX_MESSAGE_LENGTH = 300;
const RESET_HEADERS = ['x-ratelimit-reset-requests', 'x-ratelimit-reset-tokens', 'x-ratelimit-reset-project-tokens'];

/** Who is behind an OpenAI SDK client, for error messages: OpenAI itself, or another server that speaks its API. */
export interface Vendor {
  /** As messages name it, such as "OpenAI". */
  name: string;
  /** The .env variable holding its key; null for a local server, which needs none. */
  keyVariable: string | null;
}

export const OPENAI: Vendor = { name: 'OpenAI', keyVariable: 'OPENAI_API_KEY' };

/** Turns anything the OpenAI SDK throws into an AppError the API and CLI can explain. AppError passes through. */
export function mapOpenAiError(error: unknown, vendor: Vendor = OPENAI): AppError {
  const { name, keyVariable } = vendor;
  if (error instanceof AppError) return error;
  if (error instanceof APIUserAbortError || isAbortError(error)) return errors.stopped();
  if (error instanceof APIConnectionTimeoutError) {
    return new AppError('model_error', `${name} did not answer in time. Try again.`);
  }
  if (error instanceof APIConnectionError) {
    const hint = keyVariable === null ? 'Check that it is running.' : 'Check the internet connection.';
    return new AppError('model_error', `Could not reach ${name}. ${hint}`);
  }
  if (keyVariable !== null && isRejectedKey(error)) {
    return new AppError('missing_api_key', `The ${name} API key was rejected. Check ${keyVariable} in .env.`);
  }
  if (error instanceof APIError) {
    if (isQuotaError(error)) {
      return new AppError('model_error', `Your ${name} account has no remaining quota. Check billing.`);
    }
    if (error instanceof RateLimitError || error.code === 'rate_limit_exceeded') {
      const wait = (error.headers ? retryAfterSeconds(error.headers) : null) ?? retryFromMessage(shortMessage(error));
      return errors.rateLimited(wait, name);
    }
    return errors.modelError(shortMessage(error));
  }
  return errors.modelError(error instanceof Error ? truncate(error.message) : String(error));
}

/** A 401, or the 400 or 403 Gemini sends for a key it does not accept. */
function isRejectedKey(error: unknown): boolean {
  if (error instanceof AuthenticationError) return true;
  return error instanceof APIError && (error.status === 400 || error.status === 403) && /\bAPI[ _]?key\b/i.test(shortMessage(error));
}

/** Gemini says how long to wait in the message: "Please retry in 27.5s." */
function retryFromMessage(message: string): number | null {
  const match = /retry in (\d+(?:\.\d+)?)\s*s\b/i.exec(message);
  return match ? wholeSeconds(Number(match[1])) : null;
}

/** Billing problems also arrive as 429s; retrying them never helps. */
function isQuotaError(error: APIError): boolean {
  return [error.code, error.type].some(
    (value) =>
      value === 'insufficient_quota' ||
      value === 'credit_balance_exhausted' ||
      (typeof value === 'string' && value.endsWith('_spend_limit_exceeded')),
  );
}

/** Seconds to wait, from retry-after-ms, retry-after, then the x-ratelimit-reset-* durations; null when none parse. */
function retryAfterSeconds(headers: Headers): number | null {
  const ms = Number(headers.get('retry-after-ms') ?? Number.NaN);
  if (Number.isFinite(ms) && ms >= 0) return wholeSeconds(ms / 1000);

  const retryAfter = headers.get('retry-after');
  if (retryAfter !== null) {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds) && seconds >= 0) return wholeSeconds(seconds);
    const date = Date.parse(retryAfter);
    if (Number.isFinite(date)) return wholeSeconds((date - Date.now()) / 1000);
  }

  const resets = RESET_HEADERS.map((name) => parseDuration(headers.get(name))).filter((value) => value !== null);
  return resets.length > 0 ? wholeSeconds(Math.max(...resets)) : null;
}

/** Parses OpenAI reset durations such as "1s", "250ms" or "6m0s" into seconds. */
function parseDuration(value: string | null): number | null {
  if (value === null || !/^(\d+(\.\d+)?(ms|h|m|s))+$/.test(value.trim())) return null;
  const unit: Record<string, number> = { h: 3600, m: 60, s: 1, ms: 0.001 };
  let seconds = 0;
  for (const match of value.trim().matchAll(/(\d+(?:\.\d+)?)(ms|h|m|s)/g)) {
    seconds += Number(match[1]) * (unit[match[2] ?? 's'] ?? 1);
  }
  return seconds;
}

function wholeSeconds(seconds: number): number {
  return Math.max(1, Math.ceil(seconds));
}

function shortMessage(error: APIError): string {
  const body = error.error as { message?: unknown } | undefined;
  return truncate(typeof body?.message === 'string' && body.message !== '' ? body.message : error.message);
}

function truncate(message: string): string {
  const trimmed = message.trim();
  return trimmed.length > MAX_MESSAGE_LENGTH ? `${trimmed.slice(0, MAX_MESSAGE_LENGTH - 1)}…` : trimmed;
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError';
}
