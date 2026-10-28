import type { z } from 'zod';
import { ApiError } from './ApiError';
import { parseJson } from './parseJson';

/**
 * Incremental parser for server-sent events. Feed it text as it arrives, in chunks of any size;
 * it returns the data of every event a blank line completed. Comments (": ping") and fields
 * other than `data` are skipped, and CRLF, LF and CR line ends are all accepted.
 */
export class SseParser {
  private buffer = '';
  private data: string[] | null = null;
  /** The last chunk ended in CR, so a LF at the start of the next one belongs to the same line end. */
  private pendingCr = false;

  push(chunk: string): string[] {
    let text = chunk;
    if (this.pendingCr && text.startsWith('\n')) text = text.slice(1);
    this.pendingCr = false;
    this.buffer += text;

    const events: string[] = [];
    let start = 0;
    for (let i = 0; i < this.buffer.length; i++) {
      const char = this.buffer[i];
      if (char !== '\n' && char !== '\r') continue;
      this.line(this.buffer.slice(start, i), events);
      if (char === '\r') {
        if (i + 1 === this.buffer.length) this.pendingCr = true;
        else if (this.buffer[i + 1] === '\n') i++;
      }
      start = i + 1;
    }
    this.buffer = this.buffer.slice(start);
    return events;
  }

  private line(line: string, events: string[]): void {
    if (line === '') {
      if (this.data !== null) events.push(this.data.join('\n'));
      this.data = null;
      return;
    }
    if (line.startsWith(':')) return;
    const colon = line.indexOf(':');
    const field = colon === -1 ? line : line.slice(0, colon);
    if (field !== 'data') return;
    const value = colon === -1 ? '' : line.slice(colon + 1);
    (this.data ??= []).push(value.startsWith(' ') ? value.slice(1) : value);
  }
}

/**
 * Atlas streams send ": ping" every 15 seconds, so this much silence means the connection is dead,
 * for example a dev proxy left open after the server restarted.
 */
export const STREAM_IDLE_MS = 45_000;

const lostMessage = 'Atlas stopped responding. Check that the server is running, then try again.';

/**
 * Yields the data of each event in a streamed response body. Works for GET and POST alike.
 * Throws an "unreachable" ApiError when nothing at all arrives for `idleMs`.
 */
export async function* readSse(body: ReadableStream<Uint8Array>, idleMs = STREAM_IDLE_MS): AsyncGenerator<string> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  const parser = new SseParser();
  try {
    for (;;) {
      const { done, value } = await readWithin(reader, idleMs);
      if (done) break;
      yield* parser.push(decoder.decode(value, { stream: true }));
    }
    yield* parser.push(decoder.decode());
  } finally {
    reader.cancel().catch(() => undefined);
  }
}

function readWithin(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  idleMs: number,
): Promise<ReadableStreamReadResult<Uint8Array>> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const idle = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new ApiError('unreachable', lostMessage)), idleMs);
  });
  return Promise.race([reader.read(), idle]).finally(() => clearTimeout(timer));
}

/**
 * Yields each event of a streamed response as JSON checked against a shared schema.
 * An event that is not valid JSON or does not match is logged and skipped.
 */
export async function* streamEvents<S extends z.ZodType>(response: Response, schema: S): AsyncGenerator<z.output<S>> {
  if (!response.body) return;
  for await (const data of readSse(response.body)) {
    if (data.trim() === '') continue;
    const parsed = schema.safeParse(parseJson(data));
    if (parsed.success) yield parsed.data;
    else console.warn('Skipped an event Atlas did not expect', data, parsed.error);
  }
}
