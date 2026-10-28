import { describe, expect, it } from 'vitest';
import { StringFieldExtractor } from '../../../src/application/agent/partialJson';

/** Feeds the chunks one by one and returns every delta the extractor gave back. */
function feed(chunks: string[]): { deltas: string[]; extractor: StringFieldExtractor } {
  const extractor = new StringFieldExtractor('markdown');
  return { deltas: chunks.map((chunk) => extractor.push(chunk)), extractor };
}

/** The JSON with every non-ASCII character written as a \uXXXX escape, as some models stream it. */
function asciiJson(value: unknown): string {
  return JSON.stringify(value).replace(/[^\x20-\x7e]/g, (char) => `\\u${char.charCodeAt(0).toString(16).padStart(4, '0')}`);
}

/** Checks that every way of cutting the JSON in two, and cutting it into single characters, decodes the same text. */
function expectEverySplit(json: string, expected: string): void {
  for (let cut = 0; cut <= json.length; cut++) {
    const { deltas, extractor } = feed([json.slice(0, cut), json.slice(cut)]);
    expect(deltas.join(''), `cut at ${cut}`).toBe(expected);
    expect(extractor.text).toBe(expected);
  }
  const { deltas } = feed([...json]);
  expect(deltas.join('')).toBe(expected);
  for (const delta of deltas) expect(/[\ud800-\udbff]$/.test(delta), `lone half of a pair in ${delta}`).toBe(false);
}

describe('StringFieldExtractor', () => {
  it('decodes the markdown field across every chunk boundary, escapes included', () => {
    const markdown = 'Line 1\nHe said "hi" \\ path/to\tend';
    expectEverySplit(JSON.stringify({ kind: 'answer', markdown, sources: [] }), markdown);
  });

  it('decodes Arabic text written as is or as \\u escapes', () => {
    const markdown = 'إجمالي قيمة البند A-101 هو 1,250,000 ريال سعودي.\nالمصدر: BOQ_Phase2.xlsx';
    expectEverySplit(JSON.stringify({ markdown }), markdown);
    expectEverySplit(asciiJson({ markdown }), markdown);
  });

  it('holds back half of an escaped surrogate pair until the other half arrives', () => {
    const json = asciiJson({ markdown: 'ok \u{1F600}!' });
    const cut = json.indexOf('\\ude00');
    const { deltas } = feed([json.slice(0, cut), json.slice(cut)]);
    expect(deltas).toEqual(['ok ', '\u{1F600}!']);
  });

  it('streams text as it arrives and marks the field complete at its closing quote', () => {
    const { deltas, extractor } = feed(['{"markdown":"The tot', 'al is', ' 5', '"', ',"sources":[]}']);
    expect(deltas).toEqual(['The tot', 'al is', ' 5', '', '']);
    expect(extractor.complete).toBe(true);
  });

  it('ignores nested fields with the same name and string values that look like the key', () => {
    const json = JSON.stringify({
      title: 'markdown',
      sources: [{ markdown: 'nested in an array' }],
      notes: { markdown: 'nested in an object' },
      markdown: 'the answer',
    });
    expectEverySplit(json, 'the answer');
  });

  it('reads keys written with escapes and skips other values of any type', () => {
    const json = '{"count": 3, "ok": true, "list": [1, "a\\"b", {"x": null}], "mark\\u0064own": "found"}';
    expectEverySplit(json, 'found');
  });

  it('gives nothing until the field starts, and nothing for a missing field', () => {
    expect(feed(['{"kind":"not_found",', '"sources":[]}']).deltas).toEqual(['', '']);
    expect(feed(['{"kind":"not_found",', '"sources":[]}']).extractor.complete).toBe(false);
  });
});
