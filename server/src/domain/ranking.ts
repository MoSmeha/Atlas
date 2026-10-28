/** One id after fusion, with what each input list added to its score. */
export interface FusedItem<Id> {
  id: Id;
  score: number;
  /** One entry per input list, in list order: 1 / (k + rank), or 0 when the list did not have the id. */
  contributions: number[];
}

/**
 * Reciprocal rank fusion: merges ranked lists (best first) into one ranking, scoring each id
 * by the sum of 1 / (k + rank) over the lists that hold it. An id repeated in one list counts once,
 * at its best rank. Ties keep the order in which ids were first seen.
 */
export function reciprocalRankFusion<Id>(lists: readonly (readonly Id[])[], k = 60): FusedItem<Id>[] {
  if (!(k > 0)) throw new RangeError(`k must be positive, got ${k}`);
  const fused = new Map<Id, FusedItem<Id>>();
  lists.forEach((list, listIndex) => {
    list.forEach((id, position) => {
      let item = fused.get(id);
      if (!item) {
        item = { id, score: 0, contributions: lists.map(() => 0) };
        fused.set(id, item);
      }
      if (item.contributions[listIndex] !== 0) return;
      const contribution = 1 / (k + position + 1);
      item.contributions[listIndex] = contribution;
      item.score += contribution;
    });
  });
  return [...fused.values()].sort((a, b) => b.score - a.score);
}
