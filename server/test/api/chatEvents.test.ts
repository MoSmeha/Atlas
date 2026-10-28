import type { ChatEvent } from '@atlas/shared';
import { describe, expect, it } from 'vitest';
import { chatEventSink } from '../../src/api/chatEvents';
import type { SseChannel } from '../../src/api/sse';

const internal = { type: 'error', error: { code: 'internal', message: expect.stringContaining('server log') } };

function setup() {
  const browser = new AbortController();
  const sent: ChatEvent[] = [];
  const logged: unknown[] = [];
  const channel: SseChannel<ChatEvent> = { send: (event) => sent.push(event), close: () => {}, signal: browser.signal };
  const sink = chatEventSink(channel, (error) => logged.push(error));
  return { sink, sent, logged, disconnect: () => browser.abort() };
}

describe('chatEventSink', () => {
  it('forwards events that match the shared schema', () => {
    const { sink, sent } = setup();
    sink.send({ type: 'started', questionId: 'q1', model: 'small-model' });
    sink.send({ type: 'answer_delta', delta: 'A1 ' });
    expect(sent).toEqual([
      { type: 'started', questionId: 'q1', model: 'small-model' },
      { type: 'answer_delta', delta: 'A1 ' },
    ]);
    expect(sink.signal.aborted).toBe(false);
  });

  it('sends nothing further once the browser has gone, and tells the question to stop', () => {
    const { sink, sent, logged, disconnect } = setup();
    sink.send({ type: 'answer_delta', delta: 'A1 ' });
    disconnect();
    sink.send({ type: 'error', error: { code: 'stopped', message: 'The question was stopped.' } });
    sink.fail(new Error('after the stop'));
    expect(sent).toEqual([{ type: 'answer_delta', delta: 'A1 ' }]);
    expect(logged).toEqual([]);
    expect(sink.signal.aborted).toBe(true);
  });

  it('replaces an event that fails the schema with an internal error, logs it and stops the question', () => {
    const { sink, sent, logged } = setup();
    sink.send({ type: 'step', step: { id: 'call_1', name: 'query_tables' } } as unknown as ChatEvent);
    sink.send({ type: 'answer_delta', delta: 'late' });
    expect(sent).toEqual([internal]);
    expect(logged).toHaveLength(1);
    expect(sink.signal.aborted).toBe(true);
  });

  it('reports an unexpected failure once, in plain words', () => {
    const { sink, sent, logged } = setup();
    sink.fail(new Error('boom'));
    sink.fail(new Error('again'));
    expect(sent).toEqual([internal]);
    expect(logged).toEqual([new Error('boom')]);
  });
});
