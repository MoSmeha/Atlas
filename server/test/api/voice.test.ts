import { StartCallResponse, TranscriptionResponse, VoicesResponse } from '@atlas/shared';
import { afterEach, describe, expect, it } from 'vitest';
import { type AtlasApp, buildApp } from '../../src/api/app';
import { MAX_DICTATION_BYTES } from '../../src/api/routes/voice';
import { SessionStore } from '../../src/application/session/SessionStore';
import { Workspace } from '../../src/application/workspace/Workspace';
import { makeApiDeps, makeTranscribeSpeech, makeVoiceCalls } from '../fakes/apiDeps';
import { FakeIndex } from '../fakes/FakeIndex';
import { FakeTranscriber } from '../fakes/FakeTranscriber';
import { FakeVoiceClient } from '../fakes/FakeVoiceClient';
import { pdfRecord } from '../fakes/records';
import { testVoiceCatalog } from '../fakes/voiceCatalog';

const BOUNDARY = 'atlas-voice-boundary';

let apps: AtlasApp[] = [];
afterEach(async () => {
  await Promise.all(apps.map((app) => app.close()));
  apps = [];
});

function setup(options: { indexed?: boolean } = {}) {
  const index = new FakeIndex();
  index.save(pdfRecord('Contract.pdf', ['The contract value is SAR 12,500,000.']));
  const workspace = new Workspace();
  if (options.indexed !== false) workspace.activate('/jobs/tower', index);
  const sessions = new SessionStore();
  const voiceClient = new FakeVoiceClient();
  const transcriber = new FakeTranscriber();
  const app = buildApp(
    makeApiDeps({
      usage: { sessions },
      voice: {
        catalog: testVoiceCatalog,
        calls: makeVoiceCalls({ voiceClient, workspace, sessions }),
        transcribe: makeTranscribeSpeech({ transcriber, workspace, sessions }),
        callsAvailable: true,
        dictationAvailable: true,
      },
    }),
  );
  apps.push(app);
  return { app, voiceClient, transcriber, sessions };
}

function recording(bytes: Buffer, type = 'audio/webm;codecs=opus'): string {
  return [
    `--${BOUNDARY}\r\nContent-Disposition: form-data; name="audio"; filename="dictation.webm"\r\nContent-Type: ${type}\r\n\r\n`,
    bytes.toString('latin1'),
    `\r\n--${BOUNDARY}--\r\n`,
  ].join('');
}

const startCall = (app: AtlasApp, payload: object) => app.inject({ method: 'POST', url: '/api/voice/calls', payload });

describe('GET /api/voice/voices', () => {
  it('lists the voices with their dialects, the default, and what a call costs', async () => {
    const { app } = setup();
    const body = VoicesResponse.parse((await app.inject({ method: 'GET', url: '/api/voice/voices' })).json());
    expect(body).toEqual({
      callsAvailable: true,
      dictationAvailable: true,
      voices: [
        { id: 'english-female', label: 'English', nativeLabel: null, language: 'en', dialect: 'english', gender: 'female' },
        { id: 'gulf-male', label: 'Gulf Arabic', nativeLabel: 'خليجي', language: 'ar', dialect: 'gulf', gender: 'male' },
      ],
      defaultVoice: 'english-female',
      callPricePerMinute: 0.05,
      idleSeconds: 120,
      maxCallMinutes: 30,
      maxDictationSeconds: 120,
    });
  });
});

describe('POST /api/voice/calls', () => {
  it("exchanges the browser's offer for the call's answer", async () => {
    const { app, voiceClient } = setup();
    const response = await startCall(app, { sessionId: 's1', voiceId: 'gulf-male', sdp: 'v=0 offer' });
    expect(response.statusCode).toBe(201);
    expect(StartCallResponse.parse(response.json())).toEqual({
      callId: 'live_1',
      sdp: 'answer for v=0 offer',
      greeting: expect.stringContaining('Gulf Arabic'),
    });
    expect(voiceClient.started[0]?.voice).toMatchObject({ kind: 'designed', key: 'gulf-male' });
  });

  it('answers with a coded error for an unknown voice, a missing offer, and no folder', async () => {
    const { app } = setup();
    expect((await startCall(app, { sessionId: 's1', voiceId: 'nobody', sdp: 'v=0' })).json().error.code).toBe('invalid_request');
    expect((await startCall(app, { sessionId: 's1', voiceId: 'gulf-male', sdp: '' })).statusCode).toBe(400);
    const unloaded = setup({ indexed: false });
    const response = await startCall(unloaded.app, { sessionId: 's1', voiceId: 'gulf-male', sdp: 'v=0' });
    expect(response.statusCode).toBe(409);
    expect(response.json().error.code).toBe('not_indexed');
  });
});

describe('POST /api/voice/calls/:callId/end', () => {
  it("adds the call to the chat's usage, hangs up when asked, and answers 204 even when repeated", async () => {
    const { app, voiceClient } = setup();
    await startCall(app, { sessionId: 's1', voiceId: 'english-female', sdp: 'v=0' });

    const end = (seconds: number) =>
      app.inject({ method: 'POST', url: '/api/voice/calls/live_1/end', payload: { sessionId: 's1', seconds, hangUp: true } });
    expect((await end(60)).statusCode).toBe(204);
    expect((await end(90)).statusCode).toBe(204);

    expect(voiceClient.hungUp).toEqual(['live_1']);
    const usage = (await app.inject({ method: 'GET', url: '/api/usage?sessionId=s1' })).json();
    expect(usage.session).toEqual({ questions: 0, costUsd: expect.closeTo(0.05, 12), voiceSeconds: 60 });
  });

  it('refuses a body without the call length', async () => {
    const { app } = setup();
    const response = await app.inject({ method: 'POST', url: '/api/voice/calls/live_1/end', payload: { sessionId: 's1', hangUp: true } });
    expect(response.statusCode).toBe(400);
  });
});

describe('POST /api/voice/transcriptions', () => {
  const post = (app: AtlasApp, payload: string, query = '?sessionId=s1&recordedMs=4000') =>
    app.inject({
      method: 'POST',
      url: `/api/voice/transcriptions${query}`,
      headers: { 'content-type': `multipart/form-data; boundary=${BOUNDARY}` },
      payload,
    });

  it('transcribes an uploaded recording into the question text', async () => {
    const { app, transcriber } = setup();
    const response = await post(app, recording(Buffer.from([1, 2, 3, 4])));
    expect(response.statusCode).toBe(200);
    expect(TranscriptionResponse.parse(response.json())).toEqual({
      text: 'Which items cost over one million?',
      durationMs: 6000,
      costUsd: expect.closeTo(0.0006, 12),
    });
    expect(transcriber.requests[0]).toMatchObject({ mimeType: 'audio/webm', fileName: 'speech.webm', keywords: ['Contract'] });
    expect(Buffer.from(transcriber.requests[0]?.audio ?? [])).toEqual(Buffer.from([1, 2, 3, 4]));
  });

  it('asks for multipart, a session id and a recording', async () => {
    const { app } = setup();
    expect((await app.inject({ method: 'POST', url: '/api/voice/transcriptions?sessionId=s1', payload: { audio: 'x' } })).statusCode).toBe(400);
    expect((await post(app, recording(Buffer.from([1])), '')).statusCode).toBe(400);
    const empty = await post(app, `--${BOUNDARY}\r\nContent-Disposition: form-data; name="note"\r\n\r\nhi\r\n--${BOUNDARY}--\r\n`);
    expect(empty.statusCode).toBe(400);
    expect(empty.json().error.message).toBe('The request has no recording.');
  });

  it('refuses a recording above the size limit in plain words', async () => {
    const { app, transcriber } = setup();
    const response = await post(app, recording(Buffer.alloc(MAX_DICTATION_BYTES + 1, 7)));
    expect(response.statusCode).toBe(400);
    expect(response.json().error.message).toContain('Dictate at most 120 seconds');
    expect(transcriber.requests).toEqual([]);
  });
});
