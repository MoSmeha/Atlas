import { existsSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type OpenAI from 'openai';
import { NotFoundError, RateLimitError } from 'openai';
import { describe, expect, it } from 'vitest';
import { AppError } from '../../../src/application/errors';
import type { CallRequest, CallVoice } from '../../../src/application/ports/VoiceClient';
import { OpenAiVoiceClient } from '../../../src/infrastructure/openai/OpenAiVoiceClient';

interface Recorded {
  calls: { body: Record<string, unknown>; options: unknown }[];
  designs: Record<string, unknown>[];
  deleted: string[];
  hungUp: string[];
}

/** A stand-in for the SDK client: records live sessions, voice designs, deletions and hang-ups. No network. */
function stubOpenAi(behaviour: { failCalls?: Error[]; hangUpError?: Error } = {}) {
  const recorded: Recorded = { calls: [], designs: [], deleted: [], hungUp: [] };
  const failures = [...(behaviour.failCalls ?? [])];
  let voices = 0;
  const client = {
    live: {
      create: async (body: Record<string, unknown>, options: unknown) => {
        recorded.calls.push({ body, options });
        const failure = failures.shift();
        if (failure !== undefined) throw failure;
        return { session: { id: `live_${recorded.calls.length}` }, transport: { type: 'webrtc', sdp: 'answer-sdp' } };
      },
      sessions: {
        hangup: async (id: string) => {
          recorded.hungUp.push(id);
          if (behaviour.hangUpError) throw behaviour.hangUpError;
        },
      },
    },
    audio: {
      voices: {
        create: async (body: Record<string, unknown>) => {
          recorded.designs.push(body);
          voices += 1;
          return { object: 'audio.voice', id: `voice_${voices}`, name: body.name, created_at: 0, type: 'prompt' };
        },
        delete: async (id: string) => {
          recorded.deleted.push(id);
          return { id, deleted: true, object: 'audio.voice.deleted' };
        },
      },
    },
  };
  return { client: client as unknown as OpenAI, recorded };
}

const designed: CallVoice = { kind: 'designed', key: 'gulf-female', name: 'Atlas Gulf Arabic female', prompt: 'A warm voice.', script: 'هلا والله' };

function request(voice: CallVoice): CallRequest {
  return {
    model: 'gpt-live-1',
    offerSdp: 'offer-sdp',
    instructions: 'Be Atlas.',
    voice,
    history: [
      { role: 'user', text: 'What is the fee?' },
      { role: 'assistant', text: 'SAR 1,000.' },
      { role: 'developer', text: 'Greet the user now.' },
    ],
    browserEvents: ['session.commentary.append', 'session.close'],
  };
}

function voicesFile(): string {
  return join(mkdtempSync(join(tmpdir(), 'atlas-voice-ids-')), 'data', 'voices.json');
}

const missingVoice = () =>
  new NotFoundError(404, { message: 'Voice voice_1 not found.', param: 'session.audio.output.voice' }, undefined, new Headers());

async function rejection(promise: Promise<unknown>): Promise<AppError> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof AppError) return error;
    throw error;
  }
  throw new Error('expected the promise to reject');
}

describe('OpenAiVoiceClient.startCall', () => {
  it('starts a client-delegated WebRTC session in a built-in voice, never retrying the billed request', async () => {
    const { client, recorded } = stubOpenAi();
    const voice = new OpenAiVoiceClient(client, voicesFile());

    const started = await voice.startCall(request({ kind: 'builtIn', name: 'marin' }));

    expect(started).toEqual({ callId: 'live_1', answerSdp: 'answer-sdp' });
    expect(recorded.designs).toEqual([]);
    expect(recorded.calls[0]?.body).toEqual({
      session: {
        model: 'gpt-live-1',
        instructions: 'Be Atlas.',
        audio: { output: { voice: 'marin' } },
        delegation: { type: 'client' },
        input: [
          { type: 'message', role: 'user', content: [{ type: 'input_text', text: 'What is the fee?' }] },
          { type: 'message', role: 'assistant', content: [{ type: 'output_text', text: 'SAR 1,000.' }] },
          { type: 'message', role: 'developer', content: [{ type: 'input_text', text: 'Greet the user now.' }] },
        ],
        client: { data_channel: { allowed_client_events: ['session.commentary.append', 'session.close'] } },
      },
      transport: { type: 'webrtc', sdp: 'offer-sdp' },
    });
    expect(recorded.calls[0]?.options).toMatchObject({ maxRetries: 0 });
  });

  it('designs a voice the first time, saves it, and reuses it from the file later', async () => {
    const file = voicesFile();
    const first = stubOpenAi();
    await new OpenAiVoiceClient(first.client, file).startCall(request(designed));

    expect(first.recorded.designs).toEqual([{ type: 'prompt', name: 'Atlas Gulf Arabic female', prompt: 'A warm voice.', script_hint: 'هلا والله' }]);
    expect(first.recorded.calls[0]?.body).toMatchObject({ session: { audio: { output: { voice: { id: 'voice_1' } } } } });
    expect(existsSync(file)).toBe(true);
    expect(JSON.parse(readFileSync(file, 'utf8'))).toEqual({ 'gulf-female': { id: 'voice_1', fingerprint: expect.any(String) } });

    const later = stubOpenAi();
    await new OpenAiVoiceClient(later.client, file).startCall(request(designed));
    expect(later.recorded.designs).toEqual([]);
    expect(later.recorded.calls[0]?.body).toMatchObject({ session: { audio: { output: { voice: { id: 'voice_1' } } } } });
  });

  it('makes a new voice when its description changes and deletes the old one', async () => {
    const { client, recorded } = stubOpenAi();
    const voice = new OpenAiVoiceClient(client, voicesFile());
    await voice.startCall(request(designed));

    await voice.startCall(request({ ...designed, prompt: 'A brighter voice.' }));

    expect(recorded.designs).toHaveLength(2);
    expect(recorded.deleted).toEqual(['voice_1']);
    expect(recorded.calls[1]?.body).toMatchObject({ session: { audio: { output: { voice: { id: 'voice_2' } } } } });
  });

  it('designs a voice once when two calls need it at the same time', async () => {
    const { client, recorded } = stubOpenAi();
    const voice = new OpenAiVoiceClient(client, voicesFile());

    await Promise.all([voice.startCall(request(designed)), voice.startCall(request(designed))]);

    expect(recorded.designs).toHaveLength(1);
    expect(recorded.calls).toHaveLength(2);
  });

  it('designs the voice again once when the saved one no longer exists for this key', async () => {
    const { client, recorded } = stubOpenAi({ failCalls: [missingVoice()] });
    const voice = new OpenAiVoiceClient(client, voicesFile());

    const started = await voice.startCall(request(designed));

    expect(started.callId).toBe('live_2');
    expect(recorded.designs).toHaveLength(2);
    expect(recorded.calls[1]?.body).toMatchObject({ session: { audio: { output: { voice: { id: 'voice_2' } } } } });
  });

  it('turns SDK errors into AppErrors without designing anything again', async () => {
    const limited = new RateLimitError(429, { message: 'Rate limit reached' }, undefined, new Headers());
    const { client, recorded } = stubOpenAi({ failCalls: [limited] });

    const error = await rejection(new OpenAiVoiceClient(client, voicesFile()).startCall(request(designed)));

    expect(error.code).toBe('rate_limited');
    expect(recorded.designs).toHaveLength(1);
    expect(recorded.calls).toHaveLength(1);
  });

  it('does not loop when the voice is missing again after a new design', async () => {
    const { client, recorded } = stubOpenAi({ failCalls: [missingVoice(), missingVoice()] });

    const error = await rejection(new OpenAiVoiceClient(client, voicesFile()).startCall(request(designed)));

    expect(error.code).toBe('model_error');
    expect(recorded.calls).toHaveLength(2);
  });
});

describe('OpenAiVoiceClient.hangUp', () => {
  it('hangs up the session, and treats one that already ended as done', async () => {
    const live = stubOpenAi();
    await new OpenAiVoiceClient(live.client, voicesFile()).hangUp('live_7');
    expect(live.recorded.hungUp).toEqual(['live_7']);

    const ended = stubOpenAi({ hangUpError: new NotFoundError(404, { message: 'Session not found.' }, undefined, new Headers()) });
    await expect(new OpenAiVoiceClient(ended.client, voicesFile()).hangUp('live_7')).resolves.toBeUndefined();
  });

  it('reports any other failure as an AppError', async () => {
    const { client } = stubOpenAi({ hangUpError: new RateLimitError(429, { message: 'Slow down.' }, undefined, new Headers()) });
    expect((await rejection(new OpenAiVoiceClient(client, voicesFile()).hangUp('live_7'))).code).toBe('rate_limited');
  });
});
