import { describe, expect, it } from 'vitest';
import { documentId } from '../../src/domain/documentId';
import { sqlIdentifier } from '../../src/domain/table';

describe('sqlIdentifier', () => {
  it('turns a header into snake_case', () => {
    expect(sqlIdentifier('Unit Rate (SAR)', 'col_1')).toBe('unit_rate_sar');
  });

  it('prefixes names that start with a digit', () => {
    expect(sqlIdentifier('2026 Budget', 'col_1')).toBe('c_2026_budget');
  });

  it('falls back for an Arabic header', () => {
    expect(sqlIdentifier('الكمية', 'col_4')).toBe('col_4');
  });
});

describe('documentId', () => {
  it('is stable and ignores letter case', () => {
    expect(documentId('BOQ/Phase1.xlsx')).toBe(documentId('boq/phase1.xlsx'));
    expect(documentId('a.pdf')).not.toBe(documentId('b.pdf'));
  });
});
