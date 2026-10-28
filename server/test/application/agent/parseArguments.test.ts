import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { callKey } from '../../../src/application/agent/callKey';
import { parseArguments } from '../../../src/application/agent/parseArguments';

const parameters = z.object({ query: z.string(), limit: z.number().int().nullable() });

describe('parseArguments', () => {
  it('returns the checked arguments', () => {
    expect(parseArguments('{"query":"piles","limit":null}', parameters)).toEqual({
      ok: true,
      args: { query: 'piles', limit: null },
      json: { query: 'piles', limit: null },
    });
  });

  it('explains JSON that does not parse and keeps the raw text', () => {
    const parsed = parseArguments('{"query":"piles"', parameters);
    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;
    expect(parsed.error).toMatch(/^The arguments were not valid JSON: /);
    expect(parsed.json).toBe('{"query":"piles"');
  });

  it('explains arguments that do not match and asks for a fix', () => {
    const parsed = parseArguments('{"query":5,"limit":null}', parameters);
    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;
    expect(parsed.error).toMatch(/^Invalid arguments: .*query.*; fix them and call again\.$/s);
    expect(parsed.json).toEqual({ query: 5, limit: null });
  });
});

describe('callKey', () => {
  it('is the same whatever the key order, also in nested objects', () => {
    expect(callKey('search', { b: 1, a: { y: 2, x: [{ q: 1, p: 2 }] } })).toBe(
      callKey('search', { a: { x: [{ p: 2, q: 1 }], y: 2 }, b: 1 }),
    );
  });

  it('differs by tool name and by argument value', () => {
    expect(callKey('search', { a: 1 })).not.toBe(callKey('read_pages', { a: 1 }));
    expect(callKey('search', { a: 1 })).not.toBe(callKey('search', { a: 2 }));
    expect(callKey('search', { list: [1, 2] })).not.toBe(callKey('search', { list: [2, 1] }));
  });
});
