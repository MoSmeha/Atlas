import { describe, expect, it } from 'vitest';
import { isIgnoredName, kindForExtension, READABLE_EXTENSIONS, skipReason } from '../../src/domain/fileTypes';

describe('kindForExtension', () => {
  it('reads PDF and modern Excel files', () => {
    expect(kindForExtension('.pdf')).toBe('pdf');
    expect(kindForExtension('.xlsx')).toBe('excel');
    expect(kindForExtension('.xlsm')).toBe('excel');
    expect(READABLE_EXTENSIONS).toEqual(['.pdf', '.xlsx', '.xlsm']);
  });

  it('ignores letter case', () => {
    expect(kindForExtension('.PDF')).toBe('pdf');
    expect(kindForExtension('.XLSX')).toBe('excel');
  });

  it('treats legacy .xls and everything else as other', () => {
    expect(kindForExtension('.xls')).toBe('other');
    expect(kindForExtension('.docx')).toBe('other');
    expect(kindForExtension('')).toBe('other');
  });
});

describe('skipReason', () => {
  it('is null for files Atlas reads', () => {
    expect(skipReason('.pdf')).toBeNull();
    expect(skipReason('.xlsm')).toBeNull();
  });

  it('asks for .xlsx instead of the old .xls format', () => {
    expect(skipReason('.xls')).toBe('Old .xls format is not supported; save it as .xlsx.');
    expect(skipReason('.XLS')).toBe('Old .xls format is not supported; save it as .xlsx.');
  });

  it('names the kind of file it skips', () => {
    expect(skipReason('.docx')).toBe('Word documents (.docx) are not read; only PDF and Excel files are.');
    expect(skipReason('.png')).toBe('Images (.png) are not read; only PDF and Excel files are.');
    expect(skipReason('.dwg')).toBe('CAD drawings (.dwg) are not read; only PDF and Excel files are.');
    expect(skipReason('.zip')).toBe('Archives (.zip) are not opened; extract the files into the folder first.');
  });

  it('still explains unknown extensions and files without one', () => {
    expect(skipReason('.foo')).toBe('.foo files are not read; only PDF and Excel files are.');
    expect(skipReason('')).toBe('Files without an extension are not read; only PDF and Excel files are.');
  });
});

describe('isIgnoredName', () => {
  it('ignores hidden files and folders and Office lock files', () => {
    expect(isIgnoredName('.git')).toBe(true);
    expect(isIgnoredName('.DS_Store')).toBe(true);
    expect(isIgnoredName('~$BOQ.xlsx')).toBe(true);
  });

  it('keeps ordinary names, including a tilde without the dollar sign', () => {
    expect(isIgnoredName('BOQ.xlsx')).toBe(false);
    expect(isIgnoredName('~draft.pdf')).toBe(false);
  });
});
