import { describe, expect, it } from 'vitest';
import { cleanItemPath, isWithin, isWithinAny } from '../../src/domain/folderItems';

describe('isWithin', () => {
  it('matches the item itself and anything inside it, never a sibling that shares its start', () => {
    expect(isWithin('Phase 2', 'Phase 2')).toBe(true);
    expect(isWithin('Phase 2/BOQ.xlsx', 'Phase 2')).toBe(true);
    expect(isWithin('Phase 2/old/BOQ.xlsx', 'Phase 2')).toBe(true);
    expect(isWithin('Phase 20/BOQ.xlsx', 'Phase 2')).toBe(false);
    expect(isWithin('Phase 2.pdf', 'Phase 2')).toBe(false);
  });

  it('checks a list', () => {
    expect(isWithinAny('A/b.pdf', ['C', 'A'])).toBe(true);
    expect(isWithinAny('A/b.pdf', [])).toBe(false);
  });
});

describe('cleanItemPath', () => {
  it('gives the stored form: forward slashes, no leading ./ and no trailing slash', () => {
    expect(cleanItemPath('Phase 2/')).toBe('Phase 2');
    expect(cleanItemPath('./Phase 2\\BOQ.xlsx')).toBe('Phase 2/BOQ.xlsx');
    expect(cleanItemPath('  Contract.pdf ')).toBe('Contract.pdf');
  });

  it('refuses empty, absolute and climbing paths', () => {
    for (const typed of ['', '/', '.', '/etc/passwd', 'C:/Projects/A.pdf', 'c:\\A.pdf', '../A.pdf', 'A/../../B.pdf', 'A/./B.pdf']) {
      expect(cleanItemPath(typed)).toBeNull();
    }
  });
});
