import type { z } from 'zod';
import { ErrorBody } from '@atlas/shared';
import { ApiError, isAbortError, unreachableMessage } from './ApiError';
import { parseJson } from './parseJson';

type Method = 'GET' | 'POST' | 'DELETE';

export interface RequestOptions {
  method?: Method;
  /** Sent as JSON, or as multipart when it is FormData. */
  body?: unknown;
  /** Added to the URL; undefined values are left out. */
  query?: Record<string, string | number | undefined>;
  accept?: string;
  signal?: AbortSignal;
}

/** Sends a request and returns the response when it is 2xx. Every other outcome throws an ApiError. */
export async function send(path: string, options: RequestOptions = {}): Promise<Response> {
  const { method = 'GET', body, query, accept = 'application/json', signal } = options;
  const headers: Record<string, string> = { accept };
  let payload: BodyInit | undefined;
  if (body instanceof FormData) payload = body;
  else if (body !== undefined) {
    headers['content-type'] = 'application/json';
    payload = JSON.stringify(body);
  }

  let response: Response;
  try {
    response = await fetch(withQuery(path, query), { method, headers, body: payload, signal });
  } catch (error) {
    if (isAbortError(error)) throw error;
    throw new ApiError('unreachable', unreachableMessage);
  }
  if (!response.ok) throw await errorFrom(response);
  return response;
}

/** Sends a request and parses the JSON reply with a shared schema, so callers get checked types. */
export async function requestJson<S extends z.ZodType>(
  path: string,
  schema: S,
  options: RequestOptions = {},
): Promise<z.output<S>> {
  const response = await send(path, options);
  const data: unknown = await response.json().catch(() => undefined);
  const parsed = schema.safeParse(data);
  if (!parsed.success) {
    console.error(`Unexpected reply from ${options.method ?? 'GET'} ${path}`, parsed.error);
    throw new ApiError('internal', 'The server sent a reply Atlas did not expect. Reload the page and try again.', response.status);
  }
  return parsed.data;
}

/** Reads an error reply; the API always sends `{ error: { code, message } }`, a broken proxy sends nothing. */
async function errorFrom(response: Response): Promise<ApiError> {
  const text = await response.text().catch(() => '');
  const parsed = ErrorBody.safeParse(parseJson(text));
  if (parsed.success) return ApiError.fromDetail(parsed.data.error, response.status);
  if (response.status >= 500 && text.trim() === '') return new ApiError('unreachable', unreachableMessage, response.status);
  return new ApiError('internal', `Something went wrong on the server (status ${response.status}).`, response.status);
}

function withQuery(path: string, query: RequestOptions['query']): string {
  if (!query) return path;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined) params.set(key, String(value));
  }
  const search = params.toString();
  return search === '' ? path : `${path}?${search}`;
}
