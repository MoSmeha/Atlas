import type { CallRequest, StartedCall, VoiceClient } from '../../src/application/ports/VoiceClient';

/** A VoiceClient that records every call it is asked to start or hang up. No network. */
export class FakeVoiceClient implements VoiceClient {
  readonly started: CallRequest[] = [];
  readonly hungUp: string[] = [];
  /** Thrown by the next startCall, once. */
  failNext: Error | null = null;
  /** Thrown by every hangUp. */
  hangUpError: Error | null = null;

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
}
