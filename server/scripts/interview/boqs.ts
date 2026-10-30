import { day, longDate } from '../samples/lib/dates';
import { sumAmounts } from '../samples/lib/money';
import { writePdfBoq, type GeneratedPdfBoq } from '../samples/lib/pdfBoqWriter';
import { addSheet, BOX, createWorkbook, HEADER_FILL, MONEY, saveWorkbook, writeFooter } from '../samples/lib/workbook';
import { civilSections, electricalSections, externalSections, fireSections, mechanicalSections } from './boqItems';
import { writeBillSheet, type BillSheet } from './boqSheet';
import { contract, parties, project } from './project';

export const boqFiles = {
  civil: { fileName: 'BOQ - Package 2 Civil (Rev C).xlsx', revision: 'C', issueDate: '2026-02-10', sheet: 'Civil Works' },
  mep: {
    fileName: 'BOQ - Package 2 MEP (Rev B).xlsx',
    revision: 'B',
    issueDate: '2026-02-10',
    sheets: { electrical: 'Electrical', mechanical: 'Mechanical', fire: 'Fire Protection', summary: 'Summary' },
  },
  external: { fileName: 'BOQ - External Works and Landscaping.pdf', revision: 'A', issueDate: '2026-02-12' },
  /** Exactly SAR 1,000,000.00: at the threshold, so not "above SAR 1 million". */
  atThreshold: { file: 'BOQ - Package 2 Civil (Rev C).xlsx', code: '1.05', amount: 1_000_000 },
};

export interface BoqItemRecord {
  file: string;
  sheet: string | null;
  page: number | null;
  row: number | null;
  code: string;
  description: string;
  unit: string;
  quantity: number;
  rate: number;
  amount: number;
}

export interface BoqTotal {
  file: string;
  sheet: string | null;
  total: number;
  row: number | null;
  page: number | null;
}

export interface BoqSet {
  files: [string, Uint8Array][];
  items: BoqItemRecord[];
  /** One total per bill sheet or PDF, plus the MEP summary. */
  totals: BoqTotal[];
  /** One total per file. */
  fileTotals: { file: string; label: string; total: number }[];
  boqSum: number;
  contractPrice: number;
  externalPages: number;
}

const currencyNote = (issued: Date, revision: string) =>
  `Contract No. ${contract.number}  |  Revision ${revision}, issued ${longDate(issued)}  |  All rates and amounts in Saudi Riyals (SAR), excluding VAT`;

function sheetItems(file: string, bill: BillSheet): BoqItemRecord[] {
  return bill.items.map((item) => ({
    file,
    sheet: bill.sheet,
    page: null,
    row: item.row,
    code: item.code,
    description: item.description,
    unit: item.unit,
    quantity: item.quantity,
    rate: item.rate,
    amount: item.amount,
  }));
}

async function writeCivil(): Promise<{ bytes: Uint8Array; bill: BillSheet }> {
  const { revision, issueDate, sheet } = boqFiles.civil;
  const issued = day(issueDate);
  const workbook = createWorkbook(`${project.name} - Bill of Quantities - Civil Works`, issued);
  const bill = writeBillSheet(
    workbook,
    sheet,
    [project.name, `Bill of Quantities - Civil Works - Revision ${revision}`, currencyNote(issued, revision)],
    civilSections,
    'TOTAL CIVIL WORKS CARRIED TO CONTRACT PRICE',
  );
  return { bytes: await saveWorkbook(workbook, issued), bill };
}

async function writeMep(): Promise<{ bytes: Uint8Array; bills: BillSheet[]; total: number; summaryTotalRow: number }> {
  const { revision, issueDate, sheets } = boqFiles.mep;
  const issued = day(issueDate);
  const workbook = createWorkbook(`${project.name} - Bill of Quantities - MEP Works`, issued);
  const titles = (part: string) => [
    project.name,
    `Bill of Quantities - MEP Works - ${part} - Revision ${revision}`,
    currencyNote(issued, revision),
  ];
  const bills = [
    writeBillSheet(workbook, sheets.electrical, titles('Electrical'), electricalSections, 'TOTAL ELECTRICAL WORKS CARRIED TO SUMMARY'),
    writeBillSheet(workbook, sheets.mechanical, titles('Mechanical'), mechanicalSections, 'TOTAL MECHANICAL WORKS CARRIED TO SUMMARY'),
    writeBillSheet(workbook, sheets.fire, titles('Fire Protection'), fireSections, 'TOTAL FIRE PROTECTION CARRIED TO SUMMARY'),
  ];
  const summary = addSheet(workbook, sheets.summary, [44, 22]);
  summary.getCell('A1').value = project.name;
  summary.getCell('A1').font = { bold: true, size: 13 };
  summary.getCell('A2').value = `Bill of Quantities - MEP Works - Summary - Revision ${revision}`;
  summary.getCell('A4').value = 'Bill';
  summary.getCell('B4').value = 'Total (SAR)';
  for (const address of ['A4', 'B4']) {
    summary.getCell(address).font = { bold: true };
    summary.getCell(address).fill = HEADER_FILL;
    summary.getCell(address).border = BOX;
  }
  bills.forEach((bill, index) => {
    const row = 5 + index;
    summary.getCell(`A${row}`).value = bill.sheet;
    summary.getCell(`B${row}`).value = { formula: `'${bill.sheet}'!F${bill.totalRow}`, result: bill.total };
    summary.getCell(`B${row}`).numFmt = MONEY;
    summary.getCell(`A${row}`).border = BOX;
    summary.getCell(`B${row}`).border = BOX;
  });
  const total = sumAmounts(bills.map((bill) => bill.total));
  const summaryTotalRow = 5 + bills.length;
  summary.getCell(`A${summaryTotalRow}`).value = 'TOTAL MEP WORKS CARRIED TO CONTRACT PRICE';
  summary.getCell(`B${summaryTotalRow}`).value = { formula: `SUM(B5:B${summaryTotalRow - 1})`, result: total };
  summary.getCell(`B${summaryTotalRow}`).numFmt = MONEY;
  for (const column of ['A', 'B']) {
    const cell = summary.getCell(`${column}${summaryTotalRow}`);
    cell.font = { bold: true };
    cell.fill = HEADER_FILL;
    cell.border = BOX;
  }
  writeFooter(summary, summaryTotalRow + 2);
  return { bytes: await saveWorkbook(workbook, issued), bills, total, summaryTotalRow };
}

async function writeExternal(): Promise<GeneratedPdfBoq> {
  const { fileName, revision, issueDate } = boqFiles.external;
  const issued = day(issueDate);
  return writePdfBoq({
    fileName,
    title: `${project.name} - Bill of Quantities - External Works and Landscaping`,
    subject: `Contract No. ${contract.number}`,
    runningHeader: `${project.name}  |  Bill of Quantities - External Works and Landscaping  |  Revision ${revision}`,
    heading: [
      { text: project.name, size: 15, bold: true },
      { text: 'Bill of Quantities - External Works and Landscaping', size: 12, bold: true },
      { text: `Revision ${revision}  |  Issued ${longDate(issued)}  |  Contract No. ${contract.number}`, size: 9 },
      { text: `Prepared by ${parties.engineer.name} for ${parties.employer.name}`, size: 9 },
    ],
    notes: [
      'All rates and amounts are in Saudi Riyals (SAR) and exclude Value Added Tax.',
      'Rates include supply, delivery, installation, testing and protection. Quantities are measured net from the Drawings and are subject to remeasurement.',
      'The total of this Bill is carried to the Contract Price.',
    ],
    currency: 'SAR',
    issued,
    sections: externalSections,
  });
}

/** Builds the three BOQ files and the facts they decide: every item, each total, and the Contract Price. */
export async function buildBoqs(): Promise<BoqSet> {
  const civil = await writeCivil();
  const mep = await writeMep();
  const external = await writeExternal();
  const civilFile = boqFiles.civil.fileName;
  const mepFile = boqFiles.mep.fileName;
  const externalFile = boqFiles.external.fileName;

  const items: BoqItemRecord[] = [
    ...sheetItems(civilFile, civil.bill),
    ...mep.bills.flatMap((bill) => sheetItems(mepFile, bill)),
    ...external.layout.items.map((entry) => ({
      file: externalFile,
      sheet: null,
      page: entry.page,
      row: null,
      code: entry.item.code,
      description: entry.item.description,
      unit: entry.item.unit,
      quantity: entry.item.quantity,
      rate: entry.item.rate,
      amount: entry.amount,
    })),
  ];
  const totals: BoqTotal[] = [
    { file: civilFile, sheet: civil.bill.sheet, total: civil.bill.total, row: civil.bill.totalRow, page: null },
    ...mep.bills.map((bill) => ({ file: mepFile, sheet: bill.sheet, total: bill.total, row: bill.totalRow, page: null })),
    { file: mepFile, sheet: boqFiles.mep.sheets.summary, total: mep.total, row: mep.summaryTotalRow, page: null },
    { file: externalFile, sheet: null, total: external.layout.total.amount, row: null, page: external.layout.total.page },
  ];
  const fileTotals = [
    { file: civilFile, label: `Bill of Quantities - Civil Works (Revision ${boqFiles.civil.revision})`, total: civil.bill.total },
    { file: mepFile, label: `Bill of Quantities - MEP Works (Revision ${boqFiles.mep.revision})`, total: mep.total },
    {
      file: externalFile,
      label: `Bill of Quantities - External Works and Landscaping (Revision ${boqFiles.external.revision})`,
      total: external.layout.total.amount,
    },
  ];
  const boqSum = sumAmounts(fileTotals.map((entry) => entry.total));
  const contractPrice = sumAmounts([boqSum, contract.provisionalSums]);
  const threshold = items.find((item) => item.file === boqFiles.atThreshold.file && item.code === boqFiles.atThreshold.code);
  if (threshold?.amount !== boqFiles.atThreshold.amount) throw new Error(`Item ${boqFiles.atThreshold.code} is not exactly SAR 1,000,000.00`);
  return {
    files: [
      [civilFile, civil.bytes],
      [mepFile, mep.bytes],
      [externalFile, external.bytes],
    ],
    items,
    totals,
    fileTotals,
    boqSum,
    contractPrice,
    externalPages: external.pageCount,
  };
}
