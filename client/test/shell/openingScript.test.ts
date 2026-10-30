import { describe, expect, it } from 'vitest';
import { mouthOpening } from '../../src/features/voice/faceMotion';
import { openingBeats, openingTimeline, speakingMs, spokenVoice } from '../../src/shell/openingScript';

describe('openingTimeline', () => {
  it('wakes, speaks and has said its line in order, in under two seconds for five words', () => {
    const beats = openingTimeline(5, false);
    expect(beats.map((beat) => beat.phase)).toEqual(['awake', 'speaking', 'said']);
    const times = beats.map((beat) => beat.at);
    expect([...times].sort((a, b) => a - b)).toEqual(times);
    const said = times.at(-1) ?? 0;
    expect(said).toBeGreaterThan(1_000);
    expect(said).toBeLessThan(2_000);
  });

  it('gives the line time for every word before it says who said it', () => {
    const said = openingTimeline(9, false).find((beat) => beat.phase === 'said')?.at ?? 0;
    expect(said).toBe(openingBeats.speak + speakingMs(9));
    expect(said - openingBeats.speak).toBeGreaterThan(8 * openingBeats.wordMs);
  });

  it('with reduced motion has nothing to time, because it starts said', () => {
    expect(openingTimeline(5, true)).toEqual([]);
  });
});

describe('spokenVoice', () => {
  it('is silent before and after the line', () => {
    expect(spokenVoice(-10, 5)).toBe(0);
    expect(spokenVoice(0, 5)).toBe(0);
    expect(spokenVoice(speakingMs(5), 5)).toBe(0);
    expect(spokenVoice(10_000, 5)).toBe(0);
  });

  it('opens the mouth mid-syllable and lets it close between syllables', () => {
    const middle = openingBeats.syllableMs / 2;
    expect(mouthOpening(spokenVoice(middle, 5))).toBeGreaterThan(0.5);
    expect(mouthOpening(spokenVoice(openingBeats.syllableMs - 1, 5))).toBe(0);
    expect(mouthOpening(spokenVoice(openingBeats.syllableMs + 1, 5))).toBe(0);
  });

  it('stresses syllables differently, so the mouth does not open the same way each time', () => {
    const peaks = [0, 1, 2, 3].map((n) => spokenVoice((n + 0.5) * openingBeats.syllableMs, 5));
    expect(new Set(peaks.map((peak) => peak.toFixed(3))).size).toBeGreaterThan(2);
    for (const peak of peaks) expect(peak).toBeLessThanOrEqual(1);
  });
});
