import ExcelJS from 'exceljs';
import * as mupdf from 'mupdf';
import { describe, expect, it } from 'vitest';
import { skipReason } from '../../src/domain/fileTypes';
import { openPdfBytes } from '../../src/infrastructure/readers/openPdf';
import { coverLetter } from '../../scripts/samples/coverLetter';
import { buildDrawingRegister, drawingRegister, writeIntactDrawingRegister } from '../../scripts/samples/drawingRegister';
import { blankTemplate, costReportEmpty, writeBlankTemplate } from '../../scripts/samples/emptyWorkbooks';
import { buildTenderAddendum, tenderAddendum } from '../../scripts/samples/tenderAddendum';

const pageText = (doc: mupdf.Document) => doc.loadPage(0).toStructuredText('preserve-whitespace').asText();

describe('Drawing_Register.pdf', () => {
  it('starts like the real register and then turns to noise, so it cannot be opened', async () => {
    const intact = await writeIntactDrawingRegister();
    expect(pageText(mupdf.Document.openDocument(intact, 'application/pdf'))).toContain('Drawing Register');
    const damaged = await buildDrawingRegister();
    expect(damaged.length).toBe(drawingRegister.keptBytes + drawingRegister.garbageBytes);
    expect(damaged.subarray(0, drawingRegister.keptBytes)).toEqual(intact.subarray(0, drawingRegister.keptBytes));
    expect(openPdfBytes(damaged)).toMatchObject({ ok: false, status: 'corrupt' });
    expect(await buildDrawingRegister()).toEqual(damaged);
  });
});

describe('Tender_Addendum_03.pdf', () => {
  it('needs a password, and only the right one unlocks the addendum', async () => {
    const bytes = await buildTenderAddendum();
    expect(openPdfBytes(bytes)).toEqual({ ok: false, status: 'encrypted', detail: 'The PDF is password-protected.' });
    const doc = mupdf.Document.openDocument(bytes, 'application/pdf');
    expect(doc.authenticatePassword('wrong password')).toBe(0);
    expect(doc.authenticatePassword(tenderAddendum.userPassword)).toBeGreaterThan(0);
    expect(pageText(doc)).toContain('Tender Addendum No. 03');
  });
});

describe('the empty workbooks', () => {
  it('Cost_Report_Empty.xlsx has no bytes at all', () => {
    expect(costReportEmpty.bytes.length).toBe(0);
  });

  it('Blank_Template.xlsx is a valid workbook with three sheets and no cell values', async () => {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load((await writeBlankTemplate()) as unknown as ExcelJS.Buffer);
    expect(workbook.worksheets.map((sheet) => sheet.name)).toEqual(blankTemplate.sheets);
    for (const sheet of workbook.worksheets) expect(sheet.actualRowCount).toBe(0);
  });
});

describe('Cover_Letter.docx', () => {
  it('is a Word file, which Atlas lists as skipped', () => {
    expect(coverLetter.fileName.endsWith('.docx')).toBe(true);
    expect(skipReason('.docx')).toBe('Word documents (.docx) are not read; only PDF and Excel files are.');
  });
});
