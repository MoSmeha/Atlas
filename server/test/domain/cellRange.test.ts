import { describe, expect, it } from 'vitest';
import { columnNumber, parseCellRange } from '../../src/domain/cellRange';

describe('columnNumber', () => {
  it('counts columns from A as 1', () => {
    expect(columnNumber('A')).toBe(1);
    expect(columnNumber('Z')).toBe(26);
    expect(columnNumber('AA')).toBe(27);
    expect(columnNumber('ab')).toBe(28);
    expect(columnNumber('XFD')).toBe(16_384);
  });
});

describe('parseCellRange', () => {
  it('reads a merged header range as 1-based inclusive coordinates', () => {
    expect(parseCellRange('A1:C1')).toEqual({ top: 1, left: 1, bottom: 1, right: 3 });
    expect(parseCellRange('B4:D12')).toEqual({ top: 4, left: 2, bottom: 12, right: 4 });
  });

  it('reads a single cell as a one-cell range', () => {
    expect(parseCellRange('AA10')).toEqual({ top: 10, left: 27, bottom: 10, right: 27 });
  });

  it('accepts corners in either order, absolute references and lower case', () => {
    expect(parseCellRange('C3:A1')).toEqual({ top: 1, left: 1, bottom: 3, right: 3 });
    expect(parseCellRange('$a$1:$b$2')).toEqual({ top: 1, left: 1, bottom: 2, right: 2 });
  });

  it('returns null for text that is not a cell range', () => {
    for (const reference of ['', 'A', '1', 'A0', 'A1:', 'A1:B2:C3', 'Sheet1!A1', 'R1C1', 'XFE1', 'A1048577']) {
      expect(parseCellRange(reference)).toBeNull();
    }
  });
});
