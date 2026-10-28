import { describe, expect, it } from 'vitest';
import { isHighSurrogate, sliceText } from '../../src/domain/text';

describe('sliceText', () => {
  it('keeps short text whole and cuts long text', () => {
    expect(sliceText('abc', 5)).toBe('abc');
    expect(sliceText('abcdef', 4)).toBe('abcd');
  });

  it('never splits a surrogate pair', () => {
    const text = 'ab\u{1F600}cd';
    expect(sliceText(text, 3)).toBe('ab');
    expect(sliceText(text, 4)).toBe('ab\u{1F600}');
    expect(isHighSurrogate(text.charCodeAt(2))).toBe(true);
  });
});
