import { describe, expect, it } from 'vitest';
import { AppError } from '../../../src/application/errors';
import { SessionStore } from '../../../src/application/session/SessionStore';
import { TranscribeSpeech } from '../../../src/application/voice/TranscribeSpeech';
import { Workspace } from '../../../src/application/workspace/Workspace';
import { FakeIndex } from '../../fakes/FakeIndex';
import { FakeTranscriber } from '../../fakes/FakeTranscriber';
import { MemoryRunLogger } from '../../fakes/MemoryRunLogger';
import { boqTable, excelRecord } from '../../fakes/records';

const audio = new Uint8Array([1, 2, 3]);

function setup(options: { indexed?: boolean; transcriber?: FakeTranscriber | null } = {}) {
  const index = new FakeIndex();
  index.save(excelRecord('Bills/BOQ-Phase1.xlsx', [boqTable([['A1', 'Piles', 10, 200000, 2000000]], 'Bill 1')]));
  const workspace = new Workspace();
  if (options.indexed !== false) workspace.activate('/folder', index);
  const transcriber = options.transcriber === undefined ? new FakeTranscriber() : options.transcriber;
  const sessions = new SessionStore();
  const logger = new MemoryRunLogger();
  const transcribe = new TranscribeSpeech({ transcriber, workspace, sessions, logger, pricePerMinute: 0.006 });
  return { transcribe, transcriber, sessions, logger };
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

describe('TranscribeSpeech', () => {
  it("transcribes with the folder's names as hints, and adds the cost to the chat", async () => {
    const { transcribe, transcriber, sessions, logger } = setup();

    const result = await transcribe.execute({ sessionId: 's1', audio, mimeType: 'audio/webm;codecs=opus', recordedMs: 5000 });

    expect(result).toEqual({ text: 'Which items cost over one million?', durationMs: 6000, costUsd: expect.closeTo(0.0006, 12) });
    expect(transcriber?.requests[0]).toMatchObject({
      audio,
      fileName: 'speech.webm',
      mimeType: 'audio/webm',
      keywords: ['BOQ-Phase1', 'Bill 1'],
      languages: ['ar', 'en'],
      prompt: expect.stringContaining('Gulf, Levantine, Egyptian or North African'),
    });
    expect(sessions.get('s1').totalCostUsd).toBeCloseTo(0.0006, 12);
    expect(logger.voices).toEqual([
      { event: 'dictation', sessionId: 's1', callId: null, voice: null, seconds: 6, costUsd: expect.closeTo(0.0006, 12), error: null },
    ]);
  });

  it('prices by the recorded length when the service does not report one, and works with no folder loaded', async () => {
    const transcriber = new FakeTranscriber();
    transcriber.transcript = { text: 'كم قيمة العقد؟', seconds: null };
    const { transcribe } = setup({ indexed: false, transcriber });

    const result = await transcribe.execute({ sessionId: 's1', audio, mimeType: 'audio/mp4', recordedMs: 30_000 });

    expect(result).toEqual({ text: 'كم قيمة العقد؟', durationMs: 30_000, costUsd: expect.closeTo(0.003, 12) });
    expect(transcriber.requests[0]).toMatchObject({ fileName: 'speech.mp4', keywords: [] });
  });

  it('refuses a recording it cannot name, an empty one, and any without a key', async () => {
    const { transcribe, logger } = setup();
    expect((await rejection(transcribe.execute({ sessionId: 's1', audio, mimeType: 'video/quicktime', recordedMs: null }))).code).toBe(
      'invalid_request',
    );
    expect(
      (await rejection(transcribe.execute({ sessionId: 's1', audio: new Uint8Array(), mimeType: 'audio/webm', recordedMs: null }))).code,
    ).toBe('invalid_request');
    expect(logger.voices).toEqual([]);
    const noKey = setup({ transcriber: null });
    expect((await rejection(noKey.transcribe.execute({ sessionId: 's1', audio, mimeType: 'audio/webm', recordedMs: null }))).code).toBe(
      'missing_api_key',
    );
  });

  it('logs a transcription that failed and passes the error on', async () => {
    const transcriber = new FakeTranscriber();
    transcriber.transcribe = async () => {
      throw new AppError('rate_limited', 'Slow down.');
    };
    const { transcribe, logger, sessions } = setup({ transcriber });

    expect((await rejection(transcribe.execute({ sessionId: 's1', audio, mimeType: 'audio/webm', recordedMs: 1000 }))).code).toBe('rate_limited');
    expect(logger.voices[0]).toMatchObject({ event: 'dictation', error: 'rate_limited: Slow down.', costUsd: 0 });
    expect(sessions.find('s1')).toBeNull();
  });
});
