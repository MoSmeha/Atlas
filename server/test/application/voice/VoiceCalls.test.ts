import type { Answer, Usage } from '@atlas/shared';
import { describe, expect, it } from 'vitest';
import { AppError } from '../../../src/application/errors';
import { SessionStore } from '../../../src/application/session/SessionStore';
import { BROWSER_EVENTS, VoiceCalls } from '../../../src/application/voice/VoiceCalls';
import { Workspace } from '../../../src/application/workspace/Workspace';
import { FakeIndex } from '../../fakes/FakeIndex';
import { FakeVoiceClient } from '../../fakes/FakeVoiceClient';
import { MemoryRunLogger } from '../../fakes/MemoryRunLogger';
import { boqTable, excelRecord, pdfRecord } from '../../fakes/records';
import { testVoiceCatalog } from '../../fakes/voiceCatalog';

const usage: Usage = { model: 'm', inputTokens: 1, cachedInputTokens: 0, outputTokens: 1, reasoningTokens: 0, costUsd: 0.01, durationMs: 1 };
const answer: Answer = {
  kind: 'answer',
  language: 'en',
  markdown: 'The contract value is **SAR 12,500,000**.',
  table: null,
  sources: [],
  unreadableFiles: [],
  warnings: [],
};

function setup(options: { indexed?: boolean; available?: boolean; client?: FakeVoiceClient | null } = {}) {
  const index = new FakeIndex();
  index.save(excelRecord('BOQ.xlsx', [boqTable([['A1', 'Piles', 10, 200000, 2000000]])]));
  index.save(pdfRecord('Contract.pdf', ['The contract value is SAR 12,500,000.']));
  const workspace = new Workspace();
  if (options.indexed !== false) workspace.activate('C:\\Projects\\riyadh-tower', index);
  const sessions = new SessionStore();
  const client = options.client === undefined ? new FakeVoiceClient() : options.client;
  const logger = new MemoryRunLogger();
  const calls = new VoiceCalls({
    voiceClient: client,
    available: options.available ?? true,
    catalog: testVoiceCatalog,
    workspace,
    sessions,
    logger,
  });
  return { calls, client, sessions, logger };
}

async function rejection(promise: Promise<unknown>): Promise<AppError> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof AppError) return error;
    throw error;
  }
  throw new Error('expected the promise to reject');
}

describe('VoiceCalls.start', () => {
  it('starts a call in a built-in voice that knows the folder and hands questions back', async () => {
    const { calls, client, logger } = setup();

    const started = await calls.start({ sessionId: 's1', voiceId: 'english-female', sdp: 'offer' });

    expect(started).toEqual({
      callId: 'live_1',
      sdp: 'answer for offer',
      greeting: 'Greet the user now in English, in one short sentence like this: "Hi, I\'m Atlas." Then pause and listen.',
    });
    const request = client?.started[0];
    expect(request).toMatchObject({ model: 'live-model', offerSdp: 'offer', voice: { kind: 'builtIn', name: 'marin' } });
    expect(request?.browserEvents).toEqual(BROWSER_EVENTS);
    expect(request?.history).toEqual([{ role: 'developer', text: started.greeting }]);
    expect(request?.instructions).toContain('Language and dialect:\nSpeak clear English.');
    expect(request?.instructions).toContain('Generate <|SpawnThinking|> when:');
    expect(request?.instructions).toContain('The loaded folder, "riyadh-tower", holds 2 files.');
    expect(request?.instructions).toContain('- BOQ.xlsx\n- Contract.pdf');
    expect(request?.instructions).not.toContain('Your voice:');
    expect(logger.voices).toEqual([
      { event: 'call_start', sessionId: 's1', callId: 'live_1', voice: 'english-female', seconds: 0, costUsd: 0, error: null },
    ]);
  });

  it('designs an Arabic voice from its description and its dialect sample, and greets in the dialect', async () => {
    const { calls, client } = setup();

    const started = await calls.start({ sessionId: 's1', voiceId: 'gulf-male', sdp: 'offer' });

    expect(client?.started[0]?.voice).toEqual({
      kind: 'designed',
      key: 'gulf-male',
      name: 'Atlas Gulf Arabic male',
      prompt: 'A calm man from Riyadh speaking Gulf Arabic.',
      script: 'هلا والله، أنا أطلس. وش تبي تعرف؟',
    });
    expect(client?.started[0]?.instructions).toContain('Language and dialect:\nتكلّم باللهجة الخليجية.');
    expect(client?.started[0]?.instructions).toContain('Your voice: A calm man from Riyadh speaking Gulf Arabic.');
    expect(started.greeting).toBe('Greet the user now in Gulf Arabic, in one short sentence like this: "هلا، أنا أطلس." Then pause and listen.');
  });

  it("starts with the chat's recent turns, each answer as a call would say it", async () => {
    const { calls, client, sessions } = setup();
    sessions.get('s1').addTurn({ question: 'What is the contract value?', answer, resultIds: [] }, usage);

    await calls.start({ sessionId: 's1', voiceId: 'english-female', sdp: 'offer' });

    expect(client?.started[0]?.history.slice(0, 2)).toEqual([
      { role: 'user', text: 'What is the contract value?' },
      { role: 'assistant', text: 'The contract value is SAR 12,500,000.' },
    ]);
    expect(client?.started[0]?.history.at(-1)?.role).toBe('developer');
  });

  it('refuses without a key, without the voice model, for an unknown voice, and with no folder loaded', async () => {
    expect((await rejection(setup({ client: null }).calls.start({ sessionId: 's1', voiceId: 'english-female', sdp: 'o' }))).code).toBe(
      'missing_api_key',
    );
    const unavailable = await rejection(setup({ available: false }).calls.start({ sessionId: 's1', voiceId: 'english-female', sdp: 'o' }));
    expect(unavailable).toMatchObject({ code: 'model_error', message: expect.stringContaining('live-model') });
    expect((await rejection(setup().calls.start({ sessionId: 's1', voiceId: 'klingon', sdp: 'o' }))).code).toBe('invalid_request');
    expect((await rejection(setup({ indexed: false }).calls.start({ sessionId: 's1', voiceId: 'english-female', sdp: 'o' }))).code).toBe(
      'not_indexed',
    );
  });

  it('logs a call the voice service would not start, and passes its error on', async () => {
    const { calls, client, logger } = setup();
    if (client) client.failNext = new AppError('rate_limited', 'Slow down.');

    expect((await rejection(calls.start({ sessionId: 's1', voiceId: 'english-female', sdp: 'o' }))).code).toBe('rate_limited');
    expect(logger.voices).toEqual([
      { event: 'call_start', sessionId: 's1', callId: null, voice: 'english-female', seconds: 0, costUsd: 0, error: 'rate_limited: Slow down.' },
    ]);
  });
});

describe('VoiceCalls.end', () => {
  it("adds the call's length and cost to the chat once, and hangs up only when asked", async () => {
    const { calls, client, sessions, logger } = setup();
    await calls.start({ sessionId: 's1', voiceId: 'english-female', sdp: 'o' });

    await calls.end({ sessionId: 's1', callId: 'live_1', seconds: 90, hangUp: false });
    await calls.end({ sessionId: 's1', callId: 'live_1', seconds: 120, hangUp: true });

    const session = sessions.get('s1');
    expect(session.voiceSeconds).toBe(90);
    expect(session.totalCostUsd).toBeCloseTo(0.075, 12);
    expect(client?.hungUp).toEqual([]);
    expect(logger.voices.at(-1)).toEqual({
      event: 'call_end',
      sessionId: 's1',
      callId: 'live_1',
      voice: 'english-female',
      seconds: 90,
      costUsd: expect.closeTo(0.075, 12),
      error: null,
    });
  });

  it('hangs up a call the page could not close, and logs a hang-up that failed', async () => {
    const { calls, client, logger } = setup();
    await calls.start({ sessionId: 's1', voiceId: 'english-female', sdp: 'o' });
    if (client) client.hangUpError = new Error('network down');

    await calls.end({ sessionId: 's1', callId: 'live_1', seconds: 30, hangUp: true });

    expect(client?.hungUp).toEqual(['live_1']);
    expect(logger.voices.at(-1)?.error).toBe('network down');
  });

  it("leaves alone a call it did not start and another chat's call", async () => {
    const { calls, client, sessions } = setup();
    await calls.start({ sessionId: 's1', voiceId: 'english-female', sdp: 'o' });

    await calls.end({ sessionId: 's1', callId: 'live_9', seconds: 30, hangUp: true });
    await calls.end({ sessionId: 's2', callId: 'live_1', seconds: 30, hangUp: true });

    expect(client?.hungUp).toEqual([]);
    expect(sessions.get('s1').voiceSeconds).toBe(0);
  });

  it('hangs up every open call when the server stops', async () => {
    const { calls, client } = setup();
    await calls.start({ sessionId: 's1', voiceId: 'english-female', sdp: 'a' });
    await calls.start({ sessionId: 's2', voiceId: 'gulf-male', sdp: 'b' });
    await calls.end({ sessionId: 's1', callId: 'live_1', seconds: 10, hangUp: false });

    await calls.hangUpAll();
    await calls.hangUpAll();

    expect(client?.hungUp).toEqual(['live_2']);
  });
});
