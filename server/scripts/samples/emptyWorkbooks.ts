import { day } from './lib/dates';
import { createWorkbook, saveWorkbook } from './lib/workbook';
import { project } from './project';

/** Cost_Report_Empty.xlsx: a 0-byte file, as left behind by a failed save or copy. */
export const costReportEmpty = { fileName: 'Cost_Report_Empty.xlsx', bytes: new Uint8Array(0) };

/** Blank_Template.xlsx: a valid workbook with three sheets and not a single filled cell. */
export const blankTemplate = {
  fileName: 'Blank_Template.xlsx',
  sheets: ['Cost Summary', 'Cost Detail', 'Notes'],
  issueDate: '2026-03-01',
};

export async function writeBlankTemplate(): Promise<Uint8Array> {
  const issued = day(blankTemplate.issueDate);
  const workbook = createWorkbook(`${project.name} - Cost Report Template`, issued);
  for (const name of blankTemplate.sheets) workbook.addWorksheet(name);
  return saveWorkbook(workbook, issued);
}
