import { describe, expect, it } from 'vitest';
import { fileSlug, fileTimestamp, safeFileName } from '../../src/domain/fileName';

describe('fileSlug', () => {
  it('turns a title into lower-case words joined by dashes', () => {
    expect(fileSlug('BOQ items above 1M (SAR)', 'result')).toBe('boq-items-above-1m-sar');
  });

  it('drops accents and characters that are unsafe in file names', () => {
    expect(fileSlug('Café ../ Résumé: "final"', 'result')).toBe('cafe-resume-final');
  });

  it('falls back when no ASCII letters or digits are left', () => {
    expect(fileSlug('جدول الكميات', 'result')).toBe('result');
    expect(fileSlug('   ', 'result')).toBe('result');
  });

  it('keeps the ASCII part of a mixed title', () => {
    expect(fileSlug('BOQ جدول 2026', 'result')).toBe('boq-2026');
  });

  it('shortens long titles at a word boundary', () => {
    const slug = fileSlug('concrete works '.repeat(10), 'result');
    expect(slug.length).toBeLessThanOrEqual(60);
    expect(slug).toMatch(/^concrete-works-.*[a-z]$/);
  });
});

describe('fileTimestamp', () => {
  it('formats local date and time as yyyymmdd-hhmmss', () => {
    expect(fileTimestamp(new Date(2026, 9, 28, 14, 5, 9))).toBe('20261028-140509');
  });
});

describe('safeFileName', () => {
  it('keeps an ordinary name as it is', () => {
    expect(safeFileName('BOQ_Phase1_Rev1.xlsx')).toBe('BOQ_Phase1_Rev1.xlsx');
    expect(safeFileName('Contract Main Works (signed).pdf')).toBe('Contract Main Works (signed).pdf');
  });

  it('keeps Arabic names', () => {
    expect(safeFileName('محضر الاجتماع ٧.pdf')).toBe('محضر الاجتماع ٧.pdf');
  });

  it('drops any path, so a name cannot reach outside the folder', () => {
    expect(safeFileName('../../secret/BOQ.xlsx')).toBe('BOQ.xlsx');
    expect(safeFileName('C:\\Users\\me\\Spec.pdf')).toBe('Spec.pdf');
  });

  it('replaces characters Windows refuses', () => {
    expect(safeFileName('Bill: 3 <final>?.pdf')).toBe('Bill 3 final.pdf');
    expect(safeFileName('a\u0000b.pdf')).toBe('a b.pdf');
  });

  it('removes a leading dot or lock-file prefix that would hide the file', () => {
    expect(safeFileName('.hidden.pdf')).toBe('hidden.pdf');
    expect(safeFileName('~$BOQ.xlsx')).toBe('BOQ.xlsx');
    expect(safeFileName('report. .pdf')).toBe('report.pdf');
  });

  it('renames reserved Windows device names', () => {
    expect(safeFileName('CON.pdf')).toBe('_CON.pdf');
    expect(safeFileName('nul.tar.xlsx')).toBe('_nul.tar.xlsx');
  });

  it('falls back when nothing is left of the name', () => {
    expect(safeFileName('.pdf')).toBe('upload.pdf');
    expect(safeFileName('???')).toBe('upload');
    expect(safeFileName('', 'file')).toBe('file');
  });

  it('shortens very long names and keeps the extension', () => {
    const name = safeFileName(`${'long '.repeat(60)}.xlsx`);
    expect(name.endsWith('.xlsx')).toBe(true);
    expect(name.length).toBeLessThanOrEqual(125);
  });
});
