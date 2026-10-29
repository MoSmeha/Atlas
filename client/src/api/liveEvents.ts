import { z } from 'zod';

const timed = { start_ms: z.number(), end_ms: z.number() };

/**
 * The GPT-Live events a call reacts to, as they arrive on the call's event channel. Times are milliseconds from the
 * start of the call. Every other event type is ignored.
 */
export const LiveEvent = z.discriminatedUnion('type', [
  z.object({ type: z.literal('session.started') }),
  /** A piece of what the user said. Pieces carry their own spaces; joined in order they make the transcript. */
  z.object({ type: z.literal('session.input_transcript.delta'), delta: z.string(), ...timed }),
  /** A piece of what Atlas said aloud. */
  z.object({ type: z.literal('session.output_transcript.delta'), delta: z.string(), ...timed }),
  /** The voice handed a request to Atlas. It carries no text: the request is what the user said before offset_ms. */
  z.object({
    type: z.literal('session.delegation.created'),
    offset_ms: z.number(),
    delegation: z.object({ id: z.string(), target: z.string() }),
  }),
  /** A result the browser sent reached the voice; speech about it starts around start_ms. */
  z.object({ type: z.literal('session.commentary.appended'), client_event_id: z.string().optional(), ...timed }),
  z.object({ type: z.literal('session.usage.updated'), usage: z.object({ seconds: z.number() }) }),
  z.object({ type: z.literal('session.closed'), reason: z.string(), usage: z.object({ seconds: z.number() }) }),
  z.object({
    type: z.literal('error'),
    error: z.object({ code: z.string().nullable().optional(), message: z.string(), client_event_id: z.string().optional() }),
  }),
]);
export type LiveEvent = z.infer<typeof LiveEvent>;

const KNOWN = new Set<string>(LiveEvent.options.map((option) => option.shape.type.value));

/** What the browser sends: results to say aloud, quiet context, muting, and closing. The server allows only these. */
export type LiveCommand =
  | { type: 'session.commentary.append'; event_id: string; delegation_id: string | null; content: string }
  | { type: 'session.thinking.append'; event_id: string; delegation_id: string | null; content: string }
  | { type: 'session.input_audio.mute' | 'session.input_audio.unmute'; event_id: string }
  | { type: 'session.close'; event_id: string };

/** One event channel message as a LiveEvent; null for an event type a call does not use, or one that does not match. */
export function parseLiveEvent(data: unknown): LiveEvent | null {
  if (typeof data !== 'string') return null;
  let json: unknown;
  try {
    json = JSON.parse(data);
  } catch {
    return null;
  }
  const type = typeof json === 'object' && json !== null && 'type' in json ? json.type : null;
  if (typeof type !== 'string' || !KNOWN.has(type)) return null;
  const parsed = LiveEvent.safeParse(json);
  if (parsed.success) return parsed.data;
  console.warn('Skipped a call event Atlas did not expect', json, parsed.error);
  return null;
}
