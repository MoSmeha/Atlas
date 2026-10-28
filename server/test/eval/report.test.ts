import { describe, expect, it } from 'vitest';
import { percentile, renderReport, type QuestionResult } from '../../scripts/eval/report';

const usage = { model: 'm', inputTokens: 1200, cachedInputTokens: 800, outputTokens: 90, reasoningTokens: 10, costUsd: 0.0123, durationMs: 4000 };

function result(id: string, pass: boolean, durationMs: number): QuestionResult {
  const answer = { kind: 'answer' as const, language: 'en' as const, markdown: 'The total is SAR 1 | 2.', table: null, sources: [], unreadableFiles: [], warnings: [] };
  return { id, question: `Question ${id}?`, pass, reason: pass ? 'ok' : 'total missing', answer, usage: { ...usage, durationMs }, steps: ['query_tables'], durationMs };
}

describe('eval report', () => {
  it('takes percentiles by nearest rank', () => {
    expect(percentile([4, 1, 3, 2], 50)).toBe(2);
    expect(percentile([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 90)).toBe(9);
    expect(percentile([], 90)).toBe(0);
  });

  it('has a header, one row per question and details for each failure', () => {
    const report = renderReport({
      date: new Date(2026, 9, 28, 22, 41),
      model: 'gpt-6-luna',
      folder: 'samples/riyadh-tower',
      indexSeconds: 12.5,
      subset: false,
      results: [result('a', true, 2000), result('b', false, 6000)],
    });
    expect(report).toContain('- **Date:** 2026-10-28 22:41');
    expect(report).toContain('- **Passed:** 1 of 2\n');
    expect(report).toContain('- **Total cost:** $0.0246');
    expect(report).toContain('median 2.0 s, p90 6.0 s');
    expect(report).toContain('| b | **fail** | 6.0 s | $0.0123 | 1 | 1,200 / 800 / 90 / 10 | answer | total missing |');
    expect(report).toContain('### b');
    expect(report).toContain('> The total is SAR 1 | 2.');
    expect(report).not.toContain('### a');
  });
});
