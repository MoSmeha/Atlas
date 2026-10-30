/** A message a call starts with, as text history: earlier turns of the chat and the greeting instruction. */
export interface CallMessage {
  role: 'developer' | 'user' | 'assistant';
  text: string;
}

/** How a call sounds: a voice the service has, or one designed from a description and a sample script. */
export type CallVoice =
  | { kind: 'builtIn'; name: string }
  | {
      kind: 'designed';
      /** The catalog voice id; the adapter keeps the designed voice under it and reuses it. */
      key: string;
      name: string;
      /** The voice description. */
      prompt: string;
      /** Sample speech in the language and dialect the voice should speak. */
      script: string;
    };

export interface CallRequest {
  /** The live voice model, such as gpt-live-1. */
  model: string;
  /** The browser's WebRTC offer. */
  offerSdp: string;
  /** How the voice talks and when it hands a question to Atlas. */
  instructions: string;
  voice: CallVoice;
  history: readonly CallMessage[];
  /** Event types the browser may send on the call's event channel. */
  browserEvents: readonly string[];
}

export interface StartedCall {
  callId: string;
  /** The answer for the browser's peer connection. */
  answerSdp: string;
}

/**
 * The live voice service. The voice listens and speaks; every question about the documents is handed back to the
 * browser, which asks Atlas and returns the checked answer. Adapters throw AppError with codes missing_api_key,
 * rate_limited or model_error, never SDK errors.
 */
export interface VoiceClient {
  startCall(request: CallRequest): Promise<StartedCall>;
  /** Ends a call from the server; a call that already ended is fine. */
  hangUp(callId: string): Promise<void>;
  /** True when a call can use the voice straight away: a built-in voice, or a designed one already made. */
  isReady(voice: CallVoice): boolean;
  /** Makes a designed voice that does not exist yet, so the first call with it does not wait; others need nothing. */
  prepare(voice: CallVoice): Promise<void>;
}
