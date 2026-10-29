import type { Transcriber, Transcript, TranscriptionRequest } from '../../src/application/ports/Transcriber';

/** A Transcriber that returns a fixed transcript and records each request. No network. */
export class FakeTranscriber implements Transcriber {
  readonly requests: TranscriptionRequest[] = [];
  transcript: Transcript = { text: ' Which items cost over one million? ', seconds: 6 };

  async transcribe(request: TranscriptionRequest): Promise<Transcript> {
    this.requests.push(request);
    return this.transcript;
  }
}
