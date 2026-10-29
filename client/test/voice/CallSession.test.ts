import type { Answer, CallDiagnosis } from '@atlas/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AudioLevels } from '../../src/api/audioMeter';
import type { LiveConnection } from '../../src/api/liveCall';
import type { LiveCommand, LiveEvent } from '../../src/api/liveEvents';
import type { TurnEnd } from '../../src/features/chat/ChatContext';
import { spokenUpdates } from '../../src/features/voice/callCopy';
import { CallSession } from '../../src/features/voice/CallSession';

const answer: Answer = {
  kind: 'answer',
  language: 'en',
  markdown: 'Three items cost more than SAR 1,000,000.',
  table: null,
  sources: [],
  unreadableFiles: [],
  warnings: [],
};

const measured: CallDiagnosis = {
  micLabel: 'Microphone',
  micState: 'live',
  micPeak: 0.3,
  micEnergy: 0.8,
  packetsSent: 500,
  direction: 'sendrecv',
  events: { 'session.started': 1 },
  notes: [],
};

/**
 * A call connection that records what the call sends; the test decides when a close is confirmed, how loud each side
 * is, and whether the microphone is silent.
 */
function fakeConnection() {
  const sent: LiveCommand[] = [];
  const mic: boolean[] = [];
  const audio = { levels: { mic: 0, voice: 0 } as AudioLevels, silent: false };
  let confirmClose: ((seconds: number | null) => void) | null = null;
  const connection: LiveConnection = {
    callId: 'live_1',
    greeting: 'Greet the user now in English.',
    send: (command) => sent.push(command),
    setMicEnabled: (enabled) => mic.push(enabled),
    levels: () => audio.levels,
    micSilent: () => audio.silent,
    diagnosis: () => measured,
    close: () =>
      new Promise((resolve) => {
        confirmClose = resolve;
      }),
    dispose: vi.fn(),
  };
  return { connection, sent, mic, audio, confirmClose: (seconds: number | null) => confirmClose?.(seconds) };
}

/** A chat whose questions stay open until the test ends them; stop ends the running one as stopped. */
function fakeChat() {
  const asked: string[] = [];
  const said: string[] = [];
  const open: { turnId: string; end: (end: TurnEnd) => void }[] = [];
  let turns = 0;
  const chat = {
    ask: (question: string) =>
      new Promise<TurnEnd>((resolve) => {
        asked.push(question);
        open.push({ turnId: `turn-${++turns}`, end: resolve });
      }),
    stop: vi.fn(() => {
      const running = open.shift();
      running?.end({ status: 'stopped', turnId: running.turnId, error: { code: 'stopped', message: 'Stopped.', retryAfterSeconds: null } });
    }),
    noteSaid: (turnId: string, text: string) => said.push(`${turnId}:${text}`),
  };
  const finish = (end: (turnId: string) => TurnEnd) => {
    const running = open.shift();
    if (running) running.end(end(running.turnId));
  };
  return { chat, asked, said, finish };
}

const user = (delta: string, start: number, end: number): LiveEvent => ({
  type: 'session.input_transcript.delta',
  delta,
  start_ms: start,
  end_ms: end,
});
const atlas = (delta: string, start: number, end: number): LiveEvent => ({
  type: 'session.output_transcript.delta',
  delta,
  start_ms: start,
  end_ms: end,
});
const handOff = (id: string, offset: number): LiveEvent => ({
  type: 'session.delegation.created',
  offset_ms: offset,
  delegation: { id, target: 'client' },
});
const said = (commands: LiveCommand[]) =>
  commands.filter((command) => command.type === 'session.commentary.append').map((command) => ('content' in command ? command.content : ''));

function setup(limits = { idleMs: 120_000, maxMs: 30 * 60_000 }) {
  const live = fakeConnection();
  const talk = fakeChat();
  const session = new CallSession(talk.chat, limits, () => Date.now());
  session.attach(live.connection);
  session.handle({ type: 'session.started' });
  return { session, ...live, ...talk };
}

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

describe('CallSession', () => {
  it('greets once the call has started', () => {
    const { session, sent } = setup();
    expect(session.snapshot().status).toBe('live');
    expect(sent).toEqual([
      { type: 'session.commentary.append', event_id: 'say_1', delegation_id: null, content: 'Greet the user now in English.' },
    ]);
  });

  it("asks what the user said before the hand-off, then gives the voice the answer's spoken text", async () => {
    const { session, sent, asked, finish } = setup();
    session.handle(user('Which items ', 1000, 1600));
    session.handle(user('cost over one million?', 1600, 2500));
    session.handle(handOff('del_1', 2600));
    session.handle(user(' Thanks.', 2700, 3000));

    await vi.advanceTimersByTimeAsync(500);
    expect(asked).toEqual(['Which items cost over one million?']);
    expect(session.snapshot().busy).toBe(true);

    finish((turnId) => ({ status: 'done', turnId, answer, speech: 'Three items cost more than SAR 1,000,000.' }));
    await vi.advanceTimersByTimeAsync(0);

    expect(sent.at(-1)).toEqual({
      type: 'session.commentary.append',
      event_id: 'say_2',
      delegation_id: 'del_1',
      content: 'Three items cost more than SAR 1,000,000.',
    });
    expect(session.snapshot().busy).toBe(false);
  });

  it('keeps what Atlas says about the answer with its turn, from where the result reached the voice', async () => {
    const { session, said: kept, finish } = setup();
    session.handle(user('What is the fee?', 1000, 2000));
    session.handle(handOff('del_1', 2100));
    await vi.advanceTimersByTimeAsync(500);
    session.handle(atlas('Let me check.', 2200, 2900));
    finish((turnId) => ({ status: 'done', turnId, answer, speech: 'The fee is SAR 1,000.' }));
    await vi.advanceTimersByTimeAsync(0);

    session.handle(atlas('The fee is ', 4000, 4600));
    session.handle({ type: 'session.commentary.appended', client_event_id: 'say_2', start_ms: 3900, end_ms: 3900 });
    session.handle(atlas('SAR 1,000.', 4600, 5400));
    session.handle(user('Great, thanks.', 7000, 7800));
    session.handle(atlas('You are welcome.', 8000, 8800));

    // The words already spoken when the result arrived keep their own spacing, so the text joins up.
    expect(kept).toEqual(['turn-1:The fee is ', 'turn-1:SAR 1,000.']);
  });

  it('asks one combined question when the user corrects a request that is still being answered', async () => {
    const { session, asked, sent, chat, finish } = setup();
    session.handle(user('Which items cost over one million?', 1000, 2500));
    session.handle(handOff('del_1', 2600));
    await vi.advanceTimersByTimeAsync(500);
    session.handle(user('Actually, only in euros.', 3000, 4000));
    session.handle(handOff('del_2', 4100));
    await vi.advanceTimersByTimeAsync(500);

    expect(chat.stop).toHaveBeenCalledTimes(1);
    expect(asked).toEqual(['Which items cost over one million?', 'Which items cost over one million? Actually, only in euros.']);

    finish((turnId) => ({ status: 'done', turnId, answer, speech: 'One item, in EUR.' }));
    await vi.advanceTimersByTimeAsync(0);
    expect(said(sent).slice(1)).toEqual(['One item, in EUR.']);
    expect(sent.at(-1)).toMatchObject({ delegation_id: 'del_2' });
  });

  it('asks the user to repeat a hand-off with no words, and says why a question failed', async () => {
    const { session, sent, finish } = setup();
    session.handle(handOff('del_1', 500));
    await vi.advanceTimersByTimeAsync(1_300);
    expect(said(sent).at(-1)).toBe(spokenUpdates.didNotCatch);

    session.handle(user('What is the retention?', 2000, 3000));
    session.handle(handOff('del_2', 3100));
    await vi.advanceTimersByTimeAsync(500);
    finish((turnId) => ({ status: 'error', turnId, error: { code: 'rate_limited', message: 'Slow down.', retryAfterSeconds: 20 } }));
    await vi.advanceTimersByTimeAsync(0);
    expect(said(sent).at(-1)).toBe(spokenUpdates.failed('OpenAI is busy. Wait 20 seconds, then ask again.'));
  });

  it('says once that a slow question is still running, and keeps a stopped one quiet', async () => {
    const { session, sent } = setup();
    session.handle(user('List every deadline.', 1000, 2000));
    session.handle(handOff('del_1', 2100));
    await vi.advanceTimersByTimeAsync(13_000);
    expect(said(sent).filter((text) => text === spokenUpdates.stillWorking)).toHaveLength(1);

    session.stopQuestion();
    await vi.advanceTimersByTimeAsync(0);
    expect(sent.at(-1)).toMatchObject({ type: 'session.thinking.append', delegation_id: 'del_1', content: spokenUpdates.stopped });
    expect(session.snapshot().busy).toBe(false);
  });

  it('sends a refused result once more, shorter and as general context', async () => {
    const { session, sent, finish } = setup();
    session.handle(user('What is the fee?', 1000, 2000));
    session.handle(handOff('del_1', 2100));
    await vi.advanceTimersByTimeAsync(500);
    finish((turnId) => ({ status: 'done', turnId, answer, speech: 'x'.repeat(900) }));
    await vi.advanceTimersByTimeAsync(0);

    session.handle({ type: 'error', error: { code: 'too_long', message: 'Too many tokens.', client_event_id: 'say_2' } });
    session.handle({ type: 'error', error: { code: 'too_long', message: 'Too many tokens.', client_event_id: 'say_3' } });

    const retries = sent.slice(2);
    expect(retries).toHaveLength(1);
    expect(retries[0]).toMatchObject({ delegation_id: null });
    expect(said(retries)[0]?.length).toBe(600);
  });

  it('mutes the microphone and tells the voice', () => {
    const { session, sent, mic } = setup();
    session.setMuted(true);
    expect(mic).toEqual([false]);
    expect(sent.at(-1)).toMatchObject({ type: 'session.input_audio.mute' });
    expect(session.snapshot().muted).toBe(true);
  });

  it('hangs up after the idle time with nothing said, and reports the confirmed length', async () => {
    const { session, confirmClose } = setup({ idleMs: 10_000, maxMs: 60_000 });
    await vi.advanceTimersByTimeAsync(10_200);
    expect(session.snapshot()).toMatchObject({ status: 'ending', endReason: 'idle' });

    confirmClose(10.4);
    await expect(session.ended).resolves.toEqual({ callId: 'live_1', seconds: 10.4, confirmed: true, diagnosis: measured });
    expect(session.snapshot().status).toBe('ended');
  });

  it('ends when the service closes the call, and reports a broken one as unconfirmed', async () => {
    const closed = setup();
    closed.session.handle({ type: 'session.closed', reason: 'expired', usage: { seconds: 1800 } });
    await expect(closed.session.ended).resolves.toEqual({ callId: 'live_1', seconds: 1800, confirmed: true, diagnosis: measured });
    expect(closed.session.snapshot().endReason).toBe('limit');

    const dropped = setup();
    await vi.advanceTimersByTimeAsync(3_000);
    dropped.session.dropped();
    const outcome = await dropped.session.ended;
    expect(outcome.confirmed).toBe(false);
    expect(outcome.seconds).toBeGreaterThanOrEqual(3);
    expect(dropped.connection.dispose).toHaveBeenCalled();
  });

  it('says nothing about an answer that arrives after the call ended', async () => {
    const { session, sent, finish, confirmClose } = setup();
    session.handle(user('What is the fee?', 1000, 2000));
    session.handle(handOff('del_1', 2100));
    await vi.advanceTimersByTimeAsync(500);
    void session.end('hung_up');
    confirmClose(5);
    await session.ended;
    const before = sent.length;
    finish((turnId) => ({ status: 'done', turnId, answer, speech: 'Too late.' }));
    await vi.advanceTimersByTimeAsync(0);
    expect(sent).toHaveLength(before);
  });
});

describe('CallSession hearing the user', () => {
  it('says when the microphone picks up speech but none of it reaches the call, until words arrive', async () => {
    const { session, audio } = setup();
    audio.levels = { mic: 0.3, voice: 0 };

    await vi.advanceTimersByTimeAsync(4_500);
    expect(session.snapshot().micTrouble).toBeNull();
    await vi.advanceTimersByTimeAsync(700);
    expect(session.snapshot().micTrouble).toBe('unheard');

    session.handle(user('Hello?', 4000, 4500));
    expect(session.snapshot().micTrouble).toBeNull();
    await vi.advanceTimersByTimeAsync(10_000);
    expect(session.snapshot().micTrouble).toBeNull();
  });

  it('does not count sound while Atlas speaks or while the microphone is muted', async () => {
    const { session, audio } = setup();
    audio.levels = { mic: 0.3, voice: 0.3 };
    await vi.advanceTimersByTimeAsync(6_000);
    expect(session.snapshot().micTrouble).toBeNull();

    audio.levels = { mic: 0.3, voice: 0 };
    session.setMuted(true);
    await vi.advanceTimersByTimeAsync(6_000);
    expect(session.snapshot().micTrouble).toBeNull();
  });

  it('says when the microphone gives no sound at all, once its first readings are in', async () => {
    const { session, audio } = setup();
    audio.silent = true;

    await vi.advanceTimersByTimeAsync(5_000);
    expect(session.snapshot().micTrouble).toBeNull();
    await vi.advanceTimersByTimeAsync(1_200);
    expect(session.snapshot().micTrouble).toBe('silent');

    audio.silent = false;
    await vi.advanceTimersByTimeAsync(300);
    expect(session.snapshot().micTrouble).toBeNull();
  });
});
