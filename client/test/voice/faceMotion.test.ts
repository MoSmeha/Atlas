import { describe, expect, it } from 'vitest';
import {
  BLINK_MS,
  blinkOpenness,
  breath,
  easePose,
  faceMood,
  mouthOpening,
  nextBlinkDelay,
  restingPose,
  targetPose,
} from '../../src/features/voice/faceMotion';

describe('mouthOpening', () => {
  it('keeps the mouth shut for breath and line noise, and opens it fully for loud speech', () => {
    expect(mouthOpening(0)).toBe(0);
    expect(mouthOpening(0.03)).toBe(0);
    expect(mouthOpening(0.2)).toBeGreaterThan(0.4);
    expect(mouthOpening(0.42)).toBe(1);
    expect(mouthOpening(0.9)).toBe(1);
  });
});

describe('targetPose', () => {
  it('looks up while it checks the documents and raises its brows while the user speaks', () => {
    expect(targetPose('thinking', 0).lookY).toBeLessThan(0);
    expect(targetPose('hearing', 0).brow).toBeGreaterThan(targetPose('listening', 0).brow);
    expect(targetPose('resting', 0).eyeOpen).toBeLessThan(0.5);
  });

  it('opens the mouth only while speaking, with the voice', () => {
    expect(targetPose('listening', 0.8).mouth).toBe(0);
    expect(targetPose('speaking', 0).mouth).toBe(0);
    expect(targetPose('speaking', 0.3).mouth).toBeGreaterThan(0.5);
  });
});

describe('easePose', () => {
  it('covers half the distance in one half-life whatever the frame rate, the mouth faster', () => {
    const target = targetPose('listening', 0);
    const once = easePose(restingPose, target, 110, 110, 45);
    expect(once.eyeOpen).toBeCloseTo((restingPose.eyeOpen + target.eyeOpen) / 2, 6);
    let stepped = restingPose;
    for (let i = 0; i < 10; i++) stepped = easePose(stepped, target, 11, 110, 45);
    expect(stepped.eyeOpen).toBeCloseTo(once.eyeOpen, 6);

    const speaking = targetPose('speaking', 0.42);
    const mouth = easePose(restingPose, speaking, 45, 110, 45).mouth;
    expect(mouth).toBeCloseTo(0.5, 6);
  });
});

describe('blinks', () => {
  it('close quickly, open a little slower, and stay open outside a blink', () => {
    expect(blinkOpenness(-5)).toBe(1);
    expect(blinkOpenness(70)).toBeCloseTo(0.08, 6);
    expect(blinkOpenness(35)).toBeGreaterThan(blinkOpenness(70));
    expect(blinkOpenness(BLINK_MS)).toBe(1);
  });

  it('come every 2.8 to 6.5 seconds, with a quick second blink now and then', () => {
    expect(nextBlinkDelay(() => 0.5)).toBeCloseTo(2_800 + 0.5 * 3_700, 6);
    expect(nextBlinkDelay(() => 0.99)).toBeLessThanOrEqual(6_500);
    expect(nextBlinkDelay(() => 0.05)).toBe(BLINK_MS + 140);
  });
});

describe('breath and mood', () => {
  it('breathes once every 4.2 seconds', () => {
    expect(breath(0)).toBeCloseTo(0, 6);
    expect(breath(1_050)).toBeCloseTo(1, 6);
    expect(breath(4_200)).toBeCloseTo(0, 6);
  });

  it('shows the connecting ring until the call is live, and rests once it ends', () => {
    expect(faceMood({ status: 'connecting', activity: 'listening' })).toBe('connecting');
    expect(faceMood({ status: 'ending', activity: 'speaking' })).toBe('resting');
    expect(faceMood({ status: 'ended', activity: 'listening' })).toBe('resting');
    expect(faceMood({ status: 'live', activity: 'thinking' })).toBe('thinking');
  });
});
