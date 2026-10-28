import type { z } from 'zod';
import { isAbortError } from './ApiError';
import { send } from './http';
import { streamEvents } from './sse';

const FIRST_RETRY_MS = 1_000;
const MAX_RETRY_MS = 10_000;

export interface StreamHandlers<T> {
  onEvent(event: T): void;
  /** True once the stream opens, false when it drops and a retry is waiting. */
  onConnected(connected: boolean): void;
}

/**
 * Follows a GET event stream until the signal aborts, reconnecting with backoff when the server
 * restarts or the connection drops. Events are checked against the schema before delivery.
 */
export async function followStream<S extends z.ZodType>(
  path: string,
  schema: S,
  signal: AbortSignal,
  handlers: StreamHandlers<z.output<S>>,
): Promise<void> {
  let retryMs = FIRST_RETRY_MS;
  while (!signal.aborted) {
    try {
      const response = await send(path, { accept: 'text/event-stream', signal });
      handlers.onConnected(true);
      retryMs = FIRST_RETRY_MS;
      for await (const event of streamEvents(response, schema)) handlers.onEvent(event);
    } catch (error) {
      if (!signal.aborted && !isAbortError(error)) console.warn(`Event stream ${path} dropped`, error);
    }
    if (signal.aborted) return;
    handlers.onConnected(false);
    await sleep(retryMs, signal);
    retryMs = Math.min(retryMs * 2, MAX_RETRY_MS);
  }
}

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ms);
    signal.addEventListener(
      'abort',
      () => {
        clearTimeout(timer);
        resolve();
      },
      { once: true },
    );
  });
}
