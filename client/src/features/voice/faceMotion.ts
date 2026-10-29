/** What Atlas's face is doing, from the call's state and its live audio. Connecting includes making a new voice. */
export type FaceMood = 'connecting' | 'resting' | 'listening' | 'hearing' | 'thinking' | 'speaking';

/** One frame of the face. Every value is unitless; the face scales them to its own drawing. */
export interface FacePose {
  /** 0 closed to 1 open; a little above 1 is wide-eyed. Blinks multiply it. */
  eyeOpen: number;
  /** Where the eyes look: -1 left to 1 right, -1 up to 1 down. */
  lookX: number;
  lookY: number;
  /** 0 resting to 1 fully raised. */
  brow: number;
  /** 0 neutral to 1 smiling. */
  smile: number;
  /** 0 closed to 1 wide open. */
  mouth: number;
  /** Head tilt in degrees; positive leans toward the user's side. */
  tilt: number;
}

export const restingPose: FacePose = { eyeOpen: 0.14, lookX: 0, lookY: 0.35, brow: 0, smile: 0.25, mouth: 0, tilt: 0 };

const poses: Record<Exclude<FaceMood, 'speaking'>, FacePose> = {
  // Still resting while the call connects; the ring shows the wait, and the eyes open once Atlas can hear.
  connecting: restingPose,
  resting: restingPose,
  listening: { eyeOpen: 1, lookX: 0, lookY: 0, brow: 0.12, smile: 0.4, mouth: 0, tilt: 0 },
  // Brows up and a slight lean in: it has noticed the user speaking.
  hearing: { eyeOpen: 1.1, lookX: 0, lookY: -0.1, brow: 0.55, smile: 0.25, mouth: 0, tilt: 2.5 },
  // Eyes up and to the side, as when recalling something; lips pressed.
  thinking: { eyeOpen: 0.92, lookX: -0.55, lookY: -0.85, brow: 0.7, smile: 0.05, mouth: 0, tilt: -3 },
};

/** Below this loudness Atlas's voice is breath and line noise, so the mouth stays shut. */
const VOICE_GATE = 0.035;
/** At this loudness the mouth is fully open. */
const VOICE_FULL = 0.42;

/** How far the mouth opens for a loudness from 0 to 1: shut below the gate, then quickly most of the way. */
export function mouthOpening(voice: number): number {
  const open = (voice - VOICE_GATE) / (VOICE_FULL - VOICE_GATE);
  return Math.min(1, Math.max(0, open)) ** 0.7;
}

/** The pose the face moves toward for a mood; speaking opens the mouth with the voice and lifts the brows with stress. */
export function targetPose(mood: FaceMood, voice: number): FacePose {
  if (mood !== 'speaking') return poses[mood];
  const mouth = mouthOpening(voice);
  return { eyeOpen: 1, lookX: 0, lookY: 0, brow: 0.15 + mouth * 0.35, smile: 0.3, mouth, tilt: 0 };
}

/**
 * Moves each value toward its target by exponential decay: after `halfLifeMs` it has covered half the distance. Frame
 * rate does not change the motion. The mouth uses its own, shorter half-life so speech stays crisp.
 */
export function easePose(current: FacePose, target: FacePose, dtMs: number, halfLifeMs: number, mouthHalfLifeMs: number): FacePose {
  const step = (from: number, to: number, halfLife: number) => to + (from - to) * 0.5 ** (dtMs / Math.max(1, halfLife));
  return {
    eyeOpen: step(current.eyeOpen, target.eyeOpen, halfLifeMs),
    lookX: step(current.lookX, target.lookX, halfLifeMs),
    lookY: step(current.lookY, target.lookY, halfLifeMs),
    brow: step(current.brow, target.brow, halfLifeMs),
    smile: step(current.smile, target.smile, halfLifeMs),
    mouth: step(current.mouth, target.mouth, mouthHalfLifeMs),
    tilt: step(current.tilt, target.tilt, halfLifeMs),
  };
}

/** A blink closes over 70 ms and opens over 110 ms. */
export const BLINK_MS = 180;
const BLINK_CLOSE_MS = 70;
const BLINK_CLOSED = 0.08;

/** How open the eyes are `ms` into a blink: 1 at the start and end, nearly shut at 70 ms. */
export function blinkOpenness(ms: number): number {
  if (ms <= 0 || ms >= BLINK_MS) return 1;
  if (ms < BLINK_CLOSE_MS) return 1 - (1 - BLINK_CLOSED) * (ms / BLINK_CLOSE_MS);
  return BLINK_CLOSED + (1 - BLINK_CLOSED) * ((ms - BLINK_CLOSE_MS) / (BLINK_MS - BLINK_CLOSE_MS));
}

/** The wait before the next blink: 2.8 to 6.5 seconds, and now and then a quick second blink. */
export function nextBlinkDelay(random: () => number): number {
  if (random() < 0.15) return BLINK_MS + 140;
  return 2_800 + random() * 3_700;
}

/** A slow breath, -1 to 1, one cycle every 4.2 seconds. */
export function breath(ms: number): number {
  return Math.sin((ms / 4_200) * Math.PI * 2);
}

/** Which mood the face shows, from the call's state and the loudness of each side. */
export function faceMood(state: {
  status: 'connecting' | 'live' | 'ending' | 'ended';
  activity: 'listening' | 'hearing' | 'thinking' | 'speaking';
}): FaceMood {
  if (state.status === 'connecting') return 'connecting';
  return state.status === 'live' ? state.activity : 'resting';
}
