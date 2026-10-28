import { describe, expect, it } from 'vitest';
import { capOutput, MAX_OUTPUT_CHARS, toJsonText, withNotice } from '../../../src/application/agent/toolOutput';

describe('tool output', () => {
  it('writes results as JSON and refuses values JSON cannot hold', () => {
    expect(toJsonText({ rows: [[1, 'A1']] })).toBe('{"rows":[[1,"A1"]]}');
    expect(toJsonText(null)).toBe('null');
    expect(() => toJsonText(undefined)).toThrow(/could not be written as JSON/);
  });

  it('passes short output through unchanged', () => {
    expect(capOutput('{"a":1}')).toBe('{"a":1}');
  });

  it('cuts long output and says how much was kept and how to narrow the request', () => {
    const long = toJsonText({ pages: 'x'.repeat(MAX_OUTPUT_CHARS * 2) });
    const capped = capOutput(long);
    const [kept, note] = capped.split('\n');
    expect(kept).toBe(long.slice(0, MAX_OUTPUT_CHARS));
    expect(note).toContain(`first ${MAX_OUTPUT_CHARS} of ${long.length} characters`);
    expect(note).toMatch(/Narrow the request/);
  });

  it('never cuts a surrogate pair in half', () => {
    const capped = capOutput(`ab\u{1F600}cd`, 3);
    expect(capped.startsWith('ab\n')).toBe(true);
  });

  it('adds a notice after the output', () => {
    expect(withNotice('{"a":1}', 'Answer now.')).toBe('{"a":1}\n\nAnswer now.');
  });
});
