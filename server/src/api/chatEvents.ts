import { ChatEvent, type ErrorDetail } from '@atlas/shared';
import type { SseChannel } from './sse';

const INTERNAL: ErrorDetail = {
  code: 'internal',
  message: 'Something went wrong while answering. Details are in the server log.',
};

export interface ChatEventSink {
  /** Aborts when the browser goes away (Stop) or the stream failed; the question listens to it. */
  readonly signal: AbortSignal;
  send(event: ChatEvent): void;
  /** Logs an unexpected failure, tells the browser in plain words and stops the question. */
  fail(error: unknown): void;
}

/**
 * Forwards a question's events to the browser, each checked against the shared schema first.
 * Once the question is stopped nothing more is sent. An event that fails the check ends the stream as `fail` does.
 */
export function chatEventSink(channel: SseChannel<ChatEvent>, log: (error: unknown) => void): ChatEventSink {
  const failed = new AbortController();
  const signal = AbortSignal.any([channel.signal, failed.signal]);

  const fail = (error: unknown) => {
    if (signal.aborted) return;
    log(error);
    channel.send({ type: 'error', error: INTERNAL });
    failed.abort();
  };

  return {
    signal,
    send(event) {
      if (signal.aborted) return;
      const parsed = ChatEvent.safeParse(event);
      if (parsed.success) channel.send(parsed.data);
      else fail(parsed.error);
    },
    fail,
  };
}
