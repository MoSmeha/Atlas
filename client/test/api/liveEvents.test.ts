import { afterEach, describe, expect, it, vi } from 'vitest';
import { parseLiveEvent } from '../../src/api/liveEvents';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('parseLiveEvent', () => {
  it('reads the events a call uses', () => {
    expect(parseLiveEvent(JSON.stringify({ type: 'session.started', event_id: 'e1', session: { id: 'live_1' } }))).toEqual({
      type: 'session.started',
    });
    expect(
      parseLiveEvent(JSON.stringify({ type: 'session.delegation.created', event_id: 'e2', offset_ms: 1000, delegation: { id: 'd1', type: 'delegation', target: 'client' } })),
    ).toEqual({ type: 'session.delegation.created', offset_ms: 1000, delegation: { id: 'd1', target: 'client' } });
    expect(parseLiveEvent(JSON.stringify({ type: 'session.input_transcript.delta', delta: 'كم', start_ms: 1, end_ms: 2 }))).toMatchObject({
      delta: 'كم',
    });
  });

  it('ignores event types a call does not use, and anything that is not an event', () => {
    expect(parseLiveEvent(JSON.stringify({ type: 'response.event', event: {} }))).toBeNull();
    expect(parseLiveEvent('not json')).toBeNull();
    expect(parseLiveEvent(new ArrayBuffer(2))).toBeNull();
  });

  it('skips a known event with the wrong shape, with a warning', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    expect(parseLiveEvent(JSON.stringify({ type: 'session.usage.updated', usage: { seconds: 'ten' } }))).toBeNull();
    expect(warn).toHaveBeenCalledOnce();
  });
});
