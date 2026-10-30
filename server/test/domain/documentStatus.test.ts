import { describe, expect, it } from 'vitest';
import type { FileStatus } from '@atlas/shared';
import { countStatuses, describeCounts, statusGroup } from '../../src/domain/documentStatus';

describe('statusGroup', () => {
  it('treats scanned files as ready, empty files as empty and failed reads as unreadable', () => {
    expect(statusGroup('ok')).toBe('ready');
    expect(statusGroup('scanned')).toBe('ready');
    expect(statusGroup('empty')).toBe('empty');
    const failed: FileStatus[] = ['corrupt', 'encrypted', 'too_large'];
    expect(new Set(failed.map(statusGroup))).toEqual(new Set(['unreadable']));
    expect(statusGroup('skipped')).toBe('skipped');
  });
});

describe('countStatuses', () => {
  it('counts every group', () => {
    expect(countStatuses(['ok', 'ok', 'scanned', 'empty', 'corrupt', 'encrypted', 'skipped'])).toEqual({
      total: 7,
      ready: 3,
      empty: 1,
      unreadable: 2,
      skipped: 1,
    });
  });
});

describe('describeCounts', () => {
  it('names all four groups when present', () => {
    expect(describeCounts({ total: 14, ready: 9, empty: 1, unreadable: 3, skipped: 1 })).toBe(
      '14 documents: 9 readable, 1 empty, 3 unreadable, 1 skipped',
    );
  });

  it('leaves out empty groups and uses the singular for one document', () => {
    expect(describeCounts({ total: 1, ready: 1, empty: 0, unreadable: 0, skipped: 0 })).toBe('1 document: 1 readable');
    expect(describeCounts({ total: 2, ready: 0, empty: 0, unreadable: 0, skipped: 2 })).toBe('2 documents: 0 readable, 2 skipped');
  });

  it('says so when the folder has nothing', () => {
    expect(describeCounts(countStatuses([]))).toBe('No documents in the loaded folder');
  });
});
