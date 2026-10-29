import type { ExcelSource, Source } from '@atlas/shared';

/** Most sources one answer lists. */
export const MAX_SOURCES = 25;

/**
 * At most `max` sources, in their order. Row ranges on the same sheet are merged first, the two closest at a time,
 * so an answer that cites many single rows still points at each part of each sheet. Only when that is not enough
 * (more sheets and pages than `max`) are the last sources left out.
 */
export function capSources(sources: readonly Source[], max = MAX_SOURCES): Source[] {
  const list = [...sources];
  while (list.length > max) {
    const pair = closestRanges(list);
    if (pair === null) break;
    const [keep, drop] = pair;
    const a = list[keep] as ExcelSource;
    const b = list[drop] as ExcelSource;
    list[keep] = { ...a, rowFrom: Math.min(a.rowFrom, b.rowFrom), rowTo: Math.max(a.rowTo, b.rowTo) };
    list.splice(drop, 1);
  }
  return list.slice(0, max);
}

/**
 * Positions of the two ranges on one sheet with the fewest rows between them, the earlier first; null when no sheet
 * has two. Of equally close pairs, the one making the shorter range goes first, so even gaps merge evenly.
 */
function closestRanges(list: readonly Source[]): [number, number] | null {
  const bySheet = new Map<string, number[]>();
  list.forEach((source, at) => {
    if (source.kind !== 'excel') return;
    const key = `${source.document}|${source.sheet}`;
    bySheet.set(key, [...(bySheet.get(key) ?? []), at]);
  });

  let best: { gap: number; span: number; pair: [number, number] } | null = null;
  for (const positions of bySheet.values()) {
    const sorted = positions.toSorted((i, j) => (list[i] as ExcelSource).rowFrom - (list[j] as ExcelSource).rowFrom);
    for (let k = 1; k < sorted.length; k++) {
      const a = list[sorted[k - 1] ?? 0] as ExcelSource;
      const b = list[sorted[k] ?? 0] as ExcelSource;
      const gap = b.rowFrom - a.rowTo;
      const span = Math.max(a.rowTo, b.rowTo) - a.rowFrom;
      const i = sorted[k - 1] ?? 0;
      const j = sorted[k] ?? 0;
      const pair: [number, number] = i < j ? [i, j] : [j, i];
      const closer =
        best === null || gap < best.gap || (gap === best.gap && (span < best.span || (span === best.span && pair[0] < best.pair[0])));
      if (closer) best = { gap, span, pair };
    }
  }
  return best?.pair ?? null;
}
