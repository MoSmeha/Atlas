import type { FastifyReply } from 'fastify';

export interface SseChannel<T> {
  send(event: T): void;
  close(): void;
  /** Aborts when the browser disconnects, for example when the user presses Stop. */
  readonly signal: AbortSignal;
}

const HEARTBEAT_MS = 15_000;

/** Takes over the reply and streams JSON events as server-sent events, one per `data:` line. */
export function openSse<T>(reply: FastifyReply): SseChannel<T> {
  reply.hijack();
  const res = reply.raw;
  res.writeHead(200, {
    'content-type': 'text/event-stream; charset=utf-8',
    'cache-control': 'no-cache, no-transform',
    connection: 'keep-alive',
    'x-accel-buffering': 'no',
  });
  // Without this the browser sees nothing until the first event, which on a quiet stream is the heartbeat.
  res.flushHeaders();

  const controller = new AbortController();
  let open = true;
  const heartbeat = setInterval(() => open && res.write(': ping\n\n'), HEARTBEAT_MS);

  res.on('close', () => {
    open = false;
    clearInterval(heartbeat);
    if (!res.writableEnded) controller.abort();
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
    signal: controller.signal,
  };
}
