import { day, longDate } from './lib/dates';
import { sumAmounts } from './lib/money';
import { placeTable, writeTable, writeTitleBlock, type Column, type TableRows } from './lib/tableSheet';
import { addSheet, createWorkbook, saveWorkbook, writeFooter } from './lib/workbook';
import { project } from './project';

export interface ProvisionalSum {
  ref: string;
  description: string;
  /** The amount exactly as typed in the cell: a text cell, not a number. */
  text: string;
  /** What the text means, in SAR. */
  amount: number;
  remarks: string;
}

/**
 * Provisional_Sums.xlsx. Every amount is a text cell: short forms ("SAR 1.2M", "SAR 850K"), Arabic-Indic digits
 * and an Arabic scale word. PS-03 has an Arabic description.
 */
export const provisionalSums = {
  fileName: 'Provisional_Sums.xlsx',
  sheet: 'Provisional Sums',
  issueDate: '2026-09-14',
  currency: 'SAR',
  items: [
    {
      ref: 'PS-01',
      description: 'Utility authority connection works at the main substation interface',
      text: 'SAR 1.2M',
      amount: 1_200_000,
      remarks: 'Final cost depends on the authority quotation',
    },
    {
      ref: 'PS-02',
      description: 'Public art installation at the podium plaza',
      text: 'SAR 850K',
      amount: 850_000,
      remarks: 'Artist to be selected by the Employer',
    },
    {
      ref: 'PS-03',
      description: 'أعمال الخط العربي والزخارف على واجهة المدخل الرئيسي',
      text: '٣٢٠٬٠٠٠ ر.س',
      amount: 320_000,
      remarks: 'Arabic calligraphy at the main entrance',
    },
    {
      ref: 'PS-04',
      description: 'Civil defence and telecom authority inspections and approvals',
      text: '١٬٢٥٠٬٠٠٠ ريال',
      amount: 1_250_000,
      remarks: 'Fees and specialist attendance',
    },
    {
      ref: 'PS-05',
      description: 'Specialist signage and wayfinding',
      text: 'SR 475,000/-',
      amount: 475_000,
      remarks: "Design by the Employer's branding consultant",
    },
    {
      ref: 'PS-06',
      description: 'Unforeseen ground conditions below the raft foundation',
      text: '١٫٥ مليون ريال',
      amount: 1_500_000,
      remarks: 'Expended only if the Engineer confirms the condition',
    },
    {
      ref: 'PS-07',
      description: 'Testing by an independent laboratory beyond the tests measured in the Bills',
      text: 'SAR 185,000.00',
      amount: 185_000,
      remarks: 'Against laboratory invoices',
    },
  ] satisfies ProvisionalSum[],
};

export interface ProvisionalSumsLayout {
  fileName: string;
  sheet: string;
  rows: TableRows;
  noteRow: number;
  footerRow: number;
  total: number;
}

export function layoutProvisionalSums(): ProvisionalSumsLayout {
  const rows = placeTable(5, provisionalSums.items.length, { title: false, total: false });
  return {
    fileName: provisionalSums.fileName,
    sheet: provisionalSums.sheet,
    rows,
    noteRow: rows.end + 1,
    footerRow: rows.end + 3,
    total: sumAmounts(provisionalSums.items.map((item) => item.amount)),
  };
}

const COLUMNS: Column<ProvisionalSum>[] = [
  { header: 'Ref', width: 9, value: (item) => item.ref },
  { header: 'Description', width: 62, value: (item) => item.description },
  { header: 'Amount', width: 20, value: (item) => item.text },
  { header: 'Remarks', width: 46, value: (item) => item.remarks },
];

/** A short list of provisional sums whose amounts are typed as text, the way they often arrive from tender documents. */
export async function writeProvisionalSums(layout: ProvisionalSumsLayout): Promise<Uint8Array> {
  const issued = day(provisionalSums.issueDate);
  const workbook = createWorkbook(`${project.name} - Provisional Sums`, issued);
  const sheet = addSheet(workbook, layout.sheet, COLUMNS.map((column) => column.width));
  writeTitleBlock(sheet, [project.name, 'Schedule of Provisional Sums', `Issued ${longDate(issued)}. Amounts in Saudi Riyals, excluding VAT.`]);
  writeTable(sheet, layout.rows, COLUMNS, provisionalSums.items);
  for (let row = layout.rows.firstRow; row <= layout.rows.lastRow; row++) {
    sheet.getCell(`C${row}`).alignment = { horizontal: 'right', vertical: 'top' };
  }
  sheet.getCell(`A${layout.noteRow}`).value = 'Provisional sums are spent only on the instruction of the Engineer.';
  writeFooter(sheet, layout.footerRow);
  return saveWorkbook(workbook, issued);
}
