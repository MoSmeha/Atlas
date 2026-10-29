import { z } from 'zod';

/** How a voice speaks: English, or one of the Arabic dialects Atlas offers. */
export const VoiceDialect = z.enum(['english', 'gulf', 'levantine', 'egyptian', 'maghrebi', 'msa']);
export type VoiceDialect = z.infer<typeof VoiceDialect>;

/** One voice the call picker offers. */
export const VoiceOption = z.object({
  id: z.string(),
  /** For example "Gulf Arabic". */
  label: z.string(),
  /** The dialect's own name, such as "خليجي"; null for English. */
  nativeLabel: z.string().nullable(),
  language: z.enum(['en', 'ar']),
  dialect: VoiceDialect,
  gender: z.enum(['female', 'male']),
});
export type VoiceOption = z.infer<typeof VoiceOption>;

export const VoicesResponse = z.object({
  /** False while OPENAI_API_KEY is unset or the account cannot use the voice model. */
  callsAvailable: z.boolean(),
  /** False while OPENAI_API_KEY is unset. */
  dictationAvailable: z.boolean(),
  voices: z.array(VoiceOption),
  defaultVoice: z.string(),
  /** US dollars per minute of a voice call, billed per second while the call is open. */
  callPricePerMinute: z.number(),
  /** A call with no speech and no running question for this long hangs up on its own. */
  idleSeconds: z.number().int(),
  /** The longest a call may last. */
  maxCallMinutes: z.number().int(),
  /** The longest one dictation may last. */
  maxDictationSeconds: z.number().int(),
});
export type VoicesResponse = z.infer<typeof VoicesResponse>;

export const StartCallRequest = z.object({
  sessionId: z.string().min(1).max(100),
  voiceId: z.string().min(1).max(60),
  /** The browser's WebRTC offer. */
  sdp: z.string().min(1).max(64_000),
});
export type StartCallRequest = z.infer<typeof StartCallRequest>;

export const StartCallResponse = z.object({
  callId: z.string(),
  /** The answer for the browser's peer connection. */
  sdp: z.string(),
  /** Sent once on the call's event channel after it starts, so Atlas speaks first. */
  greeting: z.string(),
});
export type StartCallResponse = z.infer<typeof StartCallResponse>;

export const EndCallRequest = z.object({
  sessionId: z.string().min(1).max(100),
  /** How long the call lasted, as the voice service last reported it. */
  seconds: z.number().nonnegative().max(86_400),
  /** True when the browser could not close the call itself, for example because the page is closing. */
  hangUp: z.boolean(),
});
export type EndCallRequest = z.infer<typeof EndCallRequest>;

/** A dictated question, ready to edit in the question box. */
export const TranscriptionResponse = z.object({
  text: z.string(),
  durationMs: z.number().int().nonnegative(),
  costUsd: z.number().nonnegative(),
});
export type TranscriptionResponse = z.infer<typeof TranscriptionResponse>;
