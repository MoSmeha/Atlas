import { describe, expect, it } from 'vitest';
import { viewerCopy } from '../../src/features/viewer/viewerCopy';

const { en, ar } = viewerCopy;

describe('viewerCopy', () => {
  it('says which rows of a sheet are shown', () => {
    expect(en.shownRows(1, 0, 0)).toBe('This sheet is empty');
    expect(en.shownRows(1, 1, 1)).toBe('The only row');
    expect(en.shownRows(1, 200, 29)).toBe('All 29 rows');
    expect(en.shownRows(2768, 2817, 10001)).toBe('Showing rows 2,768–2,817 of 10,001');
  });

  it('says the same in Arabic, with Western digits', () => {
    expect(ar.shownRows(1, 0, 0)).toBe('هذه الورقة فارغة');
    expect(ar.shownRows(1, 1, 1)).toBe('الصف الوحيد');
    expect(ar.shownRows(1, 200, 29)).toBe('كل الصفوف (29)');
    expect(ar.shownRows(2768, 2817, 10001)).toBe('الصفوف 2,768 إلى 2,817 من 10,001');
  });

  it('numbers cited rows as Excel shows them', () => {
    expect(en.rows(14, 14)).toBe('row 14');
    expect(en.rows(14, 18)).toBe('rows 14–18');
    expect(ar.rows(4, 9)).toBe('الصفوف 4 إلى 9');
    expect(en.citedRows(1200, 1210)).toBe('Cited rows 1200–1210');
  });

  it('counts pages', () => {
    expect(en.pageOf(3, 64)).toBe('Page 3 of 64');
    expect(en.pageOf(3, null)).toBe('Page 3');
    expect(ar.pageOf(3, 64)).toBe('صفحة 3 من 64');
    expect(ar.pageField(1500)).toBe('رقم الصفحة، من 1 إلى 1,500');
  });
});
