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
  /** False until a designed voice has been made once for this account; the first call with it waits for that. */
  ready: z.boolean(),
});
export type VoiceOption = z.infer<typeof VoiceOption>;

export const VoicesResponse = z.object({
  /** False while OPENAI_API_KEY is unset or the account cannot use the voice model. */
  callsAvailable: z.boolean(),
  /** False while OPENAI_API_KEY is unset. */
  dictationAvailable: z.boolean(),
  voices: z.array(VoiceOption),
  /** The server is making the voices that are not ready yet, one after another. */
  preparingVoices: z.boolean(),
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

/**
 * What the browser measured about a call's audio, kept in the call log so a call where Atlas could not hear the user
 * can be explained afterwards: was the microphone silent, did its audio leave the browser, what did the service send.
 */
export const CallDiagnosis = z.object({
  /** The microphone as the browser names it. */
  micLabel: z.string().max(200),
  /** The microphone track at the end: muted means the device gave no sound; none means there was no track. */
  micState: z.enum(['live', 'muted', 'ended', 'none']),
  /** The loudest the microphone got, from 0 to 1. */
  micPeak: z.number().min(0).max(1),
  /** The sound energy the browser sent from the microphone; 0 is digital silence. Null before the first reading. */
  micEnergy: z.number().nonnegative().nullable(),
  /** Audio packets the browser sent to the service. Null before the first reading. */
  packetsSent: z.number().int().nonnegative().nullable(),
  /** How the browser and the service agreed to carry the audio: sendrecv when both ways. Null if they never agreed. */
  direction: z.string().max(20).nullable(),
  /**
   * The service's answer asked the browser to stop sending audio in silence (Opus DTX), which the call turns off. Null
   * before the answer arrived.
   */
  answerDtx: z.boolean().nullable(),
  /** Each event type the service sent, with how many of it. */
  events: z.record(z.string().max(80), z.number().int().nonnegative()),
  /** The errors and notices the service sent, oldest first. */
  notes: z.array(z.string().max(300)).max(10),
});
export type CallDiagnosis = z.infer<typeof CallDiagnosis>;

export const EndCallRequest = z.object({
  sessionId: z.string().min(1).max(100),
  /** How long the call lasted, as the voice service last reported it. */
  seconds: z.number().nonnegative().max(86_400),
  /** True when the browser could not close the call itself, for example because the page is closing. */
  hangUp: z.boolean(),
  /** Null when the call never connected. */
  diagnosis: CallDiagnosis.nullable(),
});
export type EndCallRequest = z.infer<typeof EndCallRequest>;

/** A dictated question, ready to edit in the question box. */
export const TranscriptionResponse = z.object({
  text: z.string(),
  durationMs: z.number().int().nonnegative(),
  costUsd: z.number().nonnegative(),
});
export type TranscriptionResponse = z.infer<typeof TranscriptionResponse>;
