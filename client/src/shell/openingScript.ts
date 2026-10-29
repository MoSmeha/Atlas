/**
 * The opening, beat by beat: the bust comes into focus with its eyes lowered, looks up at the viewer,
 * says its line one word at a time, holds, and lifts away. About 2.5 s for a five-word line.
 */
export type OpeningPhase = 'arriving' | 'awake' | 'speaking' | 'said' | 'leaving' | 'gone';

/** Times in ms. Words appear `wordMs` apart; the mouth moves in syllables of `syllableMs`. */
export const openingBeats = {
  wake: 380,
  speak: 760,
  wordMs: 150,
  syllableMs: 112,
  hold: 620,
  leaveMs: 420,
  /** With reduced motion the face and the whole line show at once, hold, and fade. */
  stillHold: 1_400,
  stillLeaveMs: 220,
} as const;

export interface OpeningBeat {
  phase: OpeningPhase;
  /** ms from the moment the page is first seen. */
  at: number;
}

/** How long Atlas speaks a line of `words` words: the last word's start plus one more beat. */
export function speakingMs(words: number): number {
  return Math.max(1, words) * openingBeats.wordMs + 120;
}

/** Every phase after the first and when it starts. A skip jumps straight to leaving. */
export function openingTimeline(words: number, reduced: boolean): OpeningBeat[] {
  if (reduced) {
    return [
      { phase: 'leaving', at: openingBeats.stillHold },
      { phase: 'gone', at: openingBeats.stillHold + openingBeats.stillLeaveMs },
    ];
  }
  const said = openingBeats.speak + speakingMs(words);
  const leaving = said + openingBeats.hold;
  return [
    { phase: 'awake', at: openingBeats.wake },
    { phase: 'speaking', at: openingBeats.speak },
    { phase: 'said', at: said },
    { phase: 'leaving', at: leaving },
    { phase: 'gone', at: leaving + openingBeats.leaveMs },
  ];
}

/** Stress on each syllable in turn, so the mouth does not open the same way every time. */
const stress = [1, 0.72, 0.9, 0.6, 0.96, 0.78, 0.86];

/**
 * A stand-in for the loudness of Atlas's voice, `ms` into its line, from 0 to 1: one rounded swell per
 * syllable, silent before and after. It drives the mouth exactly as a call's measured voice does.
 */
export function spokenVoice(ms: number, words: number): number {
  if (ms <= 0 || ms >= speakingMs(words)) return 0;
  const syllable = Math.floor(ms / openingBeats.syllableMs);
  const within = (ms % openingBeats.syllableMs) / openingBeats.syllableMs;
  return 0.34 * (stress[syllable % stress.length] ?? 1) * Math.sin(Math.PI * within) ** 0.9;
}
