import { describe, expect, it } from 'vitest';
import { inputSummary, MAX_SUMMARY_CHARS } from '../../../src/application/agent/summaries';

describe('inputSummary', () => {
  it('writes compact JSON and leaves out null fields', () => {
    expect(inputSummary({ query: 'piles', document: null, limit: 5 })).toBe('{"query":"piles","limit":5}');
  });

  it('gives an empty string when there are no arguments', () => {
    expect(inputSummary({})).toBe('');
    expect(inputSummary({ document: null })).toBe('');
  });

  it('keeps it on one line and cuts long input with an ellipsis', () => {
    const summary = inputSummary({ sql: `SELECT *\nFROM boq\n${'WHERE amount > 1 AND '.repeat(20)}` });
    expect(summary).not.toContain('\n');
    expect(summary.length).toBeLessThanOrEqual(MAX_SUMMARY_CHARS);
    expect(summary.length).toBeGreaterThan(MAX_SUMMARY_CHARS - 5);
    expect(summary.endsWith('…')).toBe(true);
  });

  it('shows raw text as it is, with whitespace collapsed', () => {
    expect(inputSummary('{"query": \n "piles"')).toBe('{"query": "piles"');
  });

  it('keeps Arabic text readable', () => {
    expect(inputSummary({ query: 'الخرسانة المسلحة' })).toBe('{"query":"الخرسانة المسلحة"}');
  });
});
