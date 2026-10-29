import type { CallRequest, CallVoice, StartedCall, VoiceClient } from '../../src/application/ports/VoiceClient';

/** A VoiceClient that records every call it is asked to start or hang up, and every voice it prepares. No network. */
export class FakeVoiceClient implements VoiceClient {
  readonly started: CallRequest[] = [];
  readonly hungUp: string[] = [];
  /** Keys of the designed voices made so far, in order. */
  readonly prepared: string[] = [];
  /** Thrown by the next startCall, once. */
  failNext: Error | null = null;
  /** Thrown by every hangUp. */
  hangUpError: Error | null = null;
  /** Thrown by prepare for these voice keys. */
  failPrepare = new Map<string, Error>();
  /** Runs while a voice is being made, for example to move a fake clock on. */
  whilePreparing: (key: string) => void = () => undefined;

  async startCall(request: CallRequest): Promise<StartedCall> {
    if (this.failNext !== null) {
      const error = this.failNext;
      this.failNext = null;
      throw error;
    }
    this.started.push(request);
    return { callId: `live_${this.started.length}`, answerSdp: `answer for ${request.offerSdp}` };
  }

  async hangUp(callId: string): Promise<void> {
    this.hungUp.push(callId);
    if (this.hangUpError !== null) throw this.hangUpError;
  }

  isReady(voice: CallVoice): boolean {
    return voice.kind === 'builtIn' || this.prepared.includes(voice.key);
  }

  async prepare(voice: CallVoice): Promise<void> {
    if (voice.kind === 'builtIn') return;
    this.whilePreparing(voice.key);
    const failure = this.failPrepare.get(voice.key);
    if (failure !== undefined) throw failure;
    this.prepared.push(voice.key);
  }
}
