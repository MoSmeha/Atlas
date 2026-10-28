/** Consecutive pages, both ends included. */
export interface PageRange {
  from: number;
  to: number;
}

/** Collapses page numbers into sorted runs, so 300 scanned pages read as one range: [3, 1, 2, 7] gives 1-3 and 7. */
export function toPageRanges(pages: readonly number[]): PageRange[] {
  const sorted = [...new Set(pages)].sort((a, b) => a - b);
  const ranges: PageRange[] = [];
  for (const page of sorted) {
    const last = ranges.at(-1);
    if (last && page === last.to + 1) last.to = page;
    else ranges.push({ from: page, to: page });
  }
  return ranges;
}
