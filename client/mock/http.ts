import type { IncomingMessage, ServerResponse } from 'node:http';
import type { ErrorBody, ErrorCode } from '@atlas/shared';

/** The same status per code as the real server's error hook. */
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

export function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
}

export function sendError(res: ServerResponse, code: ErrorCode, message: string, retryAfterSeconds: number | null = null): void {
  const body: ErrorBody = { error: { code, message, retryAfterSeconds } };
  sendJson(res, statusByCode[code], body);
}

export async function readBody(req: IncomingMessage): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks);
}

/** Parses a JSON body; undefined when it is missing or not JSON, so the route's schema rejects it. */
export async function readJson(req: IncomingMessage): Promise<unknown> {
  try {
    return JSON.parse((await readBody(req)).toString('utf8'));
  } catch {
    return undefined;
  }
}

export interface SseChannel<T> {
  send(event: T): void;
  close(): void;
  readonly closed: boolean;
}

/** Streams JSON events as `data:` lines with a ": ping" comment every 15 seconds, like the real server. */
export function openSse<T>(res: ServerResponse): SseChannel<T> {
  res.writeHead(200, {
    'content-type': 'text/event-stream; charset=utf-8',
    'cache-control': 'no-cache, no-transform',
    connection: 'keep-alive',
    'x-accel-buffering': 'no',
  });
  let open = true;
  const heartbeat = setInterval(() => open && res.write(': ping\n\n'), 15_000);
  res.on('close', () => {
    open = false;
    clearInterval(heartbeat);
  });
  return {
    send(event) {
      if (open) res.write(`data: ${JSON.stringify(event)}\n\n`);
    },
    close() {
      if (!open) return;
      open = false;
      clearInterval(heartbeat);
      res.end();
    },
    get closed() {
      return !open;
    },
  };
}

export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
