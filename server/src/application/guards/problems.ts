/** Something the answer guards found wrong with a submitted answer. */
export type AnswerProblem =
  /** Numbers in the markdown that no tool output, the question or a cited page or row supports, as written. */
  | { type: 'numbers'; numbers: string[] }
  /** A source that could not be checked, and why. */
  | { type: 'source'; reason: string }
  /** result_id names no saved result in this chat. */
  | { type: 'result'; resultId: string }
  /** An answer of kind "answer" with no valid source. */
  | { type: 'no_source' };
