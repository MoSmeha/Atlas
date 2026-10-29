import type OpenAI from 'openai';
import { toFile } from 'openai';
import { errors } from '../../application/errors';
import type { Transcriber, Transcript, TranscriptionRequest } from '../../application/ports/Transcriber';
import { mapOpenAiError } from './mapOpenAiError';

const OPTIONS = { maxRetries: 1, timeout: 60_000 } as const;

/** Transcriber on the OpenAI transcription endpoint, with keyword and language hints. */
export class OpenAiTranscriber implements Transcriber {
  private readonly client: OpenAI;
  private readonly model: string;

  constructor(client: OpenAI, model: string) {
    this.client = client;
    this.model = model;
  }

  async transcribe(request: TranscriptionRequest): Promise<Transcript> {
    try {
      const file = await toFile(request.audio, request.fileName, { type: request.mimeType });
      const result = await this.client.audio.transcriptions.create(
        {
          file,
          model: this.model,
          ...(request.keywords.length > 0 ? { keywords: [...request.keywords] } : {}),
          languages: [...request.languages],
          prompt: request.prompt,
          response_format: 'json',
        },
        { ...OPTIONS, signal: request.signal },
      );
      return { text: result.text, seconds: result.usage?.type === 'duration' ? result.usage.seconds : null };
    } catch (error) {
      throw request.signal?.aborted ? errors.stopped() : mapOpenAiError(error);
    }
  }
}
