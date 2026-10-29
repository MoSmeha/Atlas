import type OpenAI from 'openai';
import { AuthenticationError } from 'openai';
import { describe, expect, it } from 'vitest';
import { AppError } from '../../../src/application/errors';
import type { TranscriptionRequest } from '../../../src/application/ports/Transcriber';
import { OpenAiTranscriber } from '../../../src/infrastructure/openai/OpenAiTranscriber';

interface Call {
  body: { file: File; model: string; keywords?: string[]; languages: string[]; prompt: string; response_format: string };
  options: { signal?: AbortSignal; maxRetries?: number };
}

/** A stand-in for the SDK client that records each transcription request. No network. */
function stubOpenAi(answer: () => unknown) {
  const calls: Call[] = [];
  const client = {
    audio: {
      transcriptions: {
        create: async (body: Call['body'], options: Call['options']) => {
          calls.push({ body, options });
          const result = answer();
          if (result instanceof Error) throw result;
          return result;
        },
      },
    },
  };
  return { client: client as unknown as OpenAI, calls };
}

const request: TranscriptionRequest = {
  audio: new Uint8Array([1, 2, 3, 4]),
  fileName: 'speech.webm',
  mimeType: 'audio/webm',
  keywords: ['BOQ-Phase1', 'Bill 1'],
  languages: ['ar', 'en'],
  prompt: 'A question about project documents.',
};

describe('OpenAiTranscriber', () => {
  it('sends the recording as a named file with keyword and language hints, and reads the billed seconds', async () => {
    const { client, calls } = stubOpenAi(() => ({ text: 'What is the fee?', usage: { type: 'duration', seconds: 4.2 } }));
    const signal = new AbortController().signal;

    const transcript = await new OpenAiTranscriber(client, 'gpt-transcribe').transcribe({ ...request, signal });

    expect(transcript).toEqual({ text: 'What is the fee?', seconds: 4.2 });
    const body = calls[0]?.body;
    expect(body).toMatchObject({
      model: 'gpt-transcribe',
      keywords: ['BOQ-Phase1', 'Bill 1'],
      languages: ['ar', 'en'],
      prompt: 'A question about project documents.',
      response_format: 'json',
    });
    expect(body?.file.name).toBe('speech.webm');
    expect(body?.file.type).toBe('audio/webm');
    expect(new Uint8Array(await body!.file.arrayBuffer())).toEqual(request.audio);
    expect(calls[0]?.options.signal).toBe(signal);
  });

  it('sends no keywords when there are none, and no seconds when usage is in tokens', async () => {
    const { client, calls } = stubOpenAi(() => ({ text: 'مرحبا', usage: { type: 'tokens', input_tokens: 5, output_tokens: 2, total_tokens: 7 } }));

    const transcript = await new OpenAiTranscriber(client, 'gpt-transcribe').transcribe({ ...request, keywords: [] });

    expect(transcript).toEqual({ text: 'مرحبا', seconds: null });
    expect(calls[0]?.body).not.toHaveProperty('keywords');
  });

  it('turns SDK errors into AppErrors, and an aborted request into stopped', async () => {
    const rejected = stubOpenAi(() => new AuthenticationError(401, { message: 'Incorrect API key provided' }, undefined, new Headers()));
    await expect(new OpenAiTranscriber(rejected.client, 'gpt-transcribe').transcribe(request)).rejects.toMatchObject({
      code: 'missing_api_key',
    });

    const controller = new AbortController();
    controller.abort();
    const aborted = stubOpenAi(() => new Error('aborted'));
    const error = await new OpenAiTranscriber(aborted.client, 'gpt-transcribe')
      .transcribe({ ...request, signal: controller.signal })
      .catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(AppError);
    expect((error as AppError).code).toBe('stopped');
  });
});
