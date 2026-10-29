export type Speaker = 'user' | 'atlas';

/** One piece of a call's transcript as the voice service sent it. Times are milliseconds from the call's start. */
export interface Fragment {
  speaker: Speaker;
  /** As sent, with its own spaces. */
  text: string;
  startMs: number;
  endMs: number;
}

/** A pause this long between two pieces from one speaker starts a new utterance in the captions. */
export const UTTERANCE_GAP_MS = 1_200;
/** The user speaking this long after Atlas's last words is a new turn, not a word said over Atlas. */
export const NEW_TURN_GAP_MS = 800;

/**
 * The speaker's words from pieces that started at `fromMs` or later and before `toMs`, joined as they arrived, on one
 * line. Pieces carry their own spaces, so nothing is added between them.
 */
export function wordsBetween(fragments: readonly Fragment[], speaker: Speaker, fromMs: number, toMs = Number.POSITIVE_INFINITY): string {
  return fragments
    .filter((piece) => piece.speaker === speaker && piece.startMs >= fromMs && piece.startMs < toMs)
    .map((piece) => piece.text)
    .join('')
    .replace(/\s+/g, ' ')
    .trim();
}

/** The speaker's latest utterance: their pieces back to the last pause of `gapMs` or more, on one line. */
export function latestUtterance(fragments: readonly Fragment[], speaker: Speaker, gapMs = UTTERANCE_GAP_MS): string {
  const pieces = fragments.filter((piece) => piece.speaker === speaker);
  let first = pieces.length;
  while (first > 0) {
    const piece = pieces[first - 1];
    const next = pieces[first];
    if (piece === undefined || (next !== undefined && next.startMs - piece.endMs >= gapMs)) break;
    first -= 1;
  }
  return pieces
    .slice(first)
    .map((piece) => piece.text)
    .join('')
    .replace(/\s+/g, ' ')
    .trim();
}

/** True when a piece of the user's speech starts a new turn after Atlas spoke, rather than overlapping its reply. */
export function startsNewTurn(piece: Fragment, atlasEndMs: number, gapMs = NEW_TURN_GAP_MS): boolean {
  return piece.speaker === 'user' && piece.text.trim() !== '' && piece.startMs >= atlasEndMs + gapMs;
}

/**
 * The question to ask when the user adds to a request that is still being answered, such as a correction: the earlier
 * request, then the new words, as one question.
 */
export function joinQuestion(earlier: string | null, words: string): string {
  return [earlier ?? '', words].map((part) => part.trim()).filter((part) => part !== '').join(' ');
}
