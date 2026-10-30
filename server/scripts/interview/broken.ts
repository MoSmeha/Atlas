import * as mupdf from 'mupdf';
import { day, longDate } from '../samples/lib/dates';
import { PdfWriter } from '../samples/lib/PdfWriter';
import { addSheet, createWorkbook, MONEY, saveWorkbook } from '../samples/lib/workbook';
import { contract, parties, project } from './project';

/** The files Atlas cannot read, on purpose, and what it should say about each. */
export const brokenFiles = {
  corrupt: {
    fileName: 'Cost Report Aug 2026.xlsx',
    keptBytes: 4_000,
    reason: 'A real workbook cut off after 4,000 bytes, as a failed download leaves it.',
  },
  encrypted: {
    fileName: 'Tender Clarifications.pdf',
    issueDate: '2025-12-08',
    userPassword: 'KLP-tender-2026',
    ownerPassword: 'KLP-owner-only',
    encryption: 'aes-256',
    reason: 'Password-protected (AES-256); Atlas is not given the password.',
  },
  empty: { fileName: 'Method Statement - Piling.pdf', reason: 'A 0-byte file.' },
  csv: { fileName: 'Site Photos Index.csv', reason: 'A CSV file; Atlas reads only PDF and Excel files.' },
};

/** The cost report as it was before it was cut: a small, real workbook. */
export async function writeIntactCostReport(): Promise<Uint8Array> {
  const issued = day('2026-09-05');
  const workbook = createWorkbook(`${project.name} - Cost Report August 2026`, issued);
  const sheet = addSheet(workbook, 'Cost Report', [40, 18, 18]);
  sheet.getCell('A1').value = `${project.name} - Cost Report, August 2026`;
  sheet.getCell('A1').font = { bold: true, size: 13 };
  const rows: [string, number, number][] = [
    ['Preliminaries', 4_120_500, 3_980_000],
    ['Earthworks and ground improvement', 15_880_000, 16_420_000],
    ['Concrete works', 9_640_000, 9_210_000],
    ['Structural steel', 6_250_000, 6_250_000],
  ];
  sheet.getRow(3).values = ['Cost head', 'Budget (SAR)', 'Forecast (SAR)'];
  rows.forEach((row, index) => {
    const line = sheet.getRow(4 + index);
    line.values = row;
    line.getCell(2).numFmt = MONEY;
    line.getCell(3).numFmt = MONEY;
  });
  return saveWorkbook(workbook, issued);
}

/** The damaged file: the first bytes of the real workbook, and nothing after. */
export async function buildCorruptWorkbook(): Promise<Uint8Array> {
  const intact = await writeIntactCostReport();
  if (intact.length <= brokenFiles.corrupt.keptBytes) throw new Error('The cost report is too small to truncate');
  return intact.slice(0, brokenFiles.corrupt.keptBytes);
}

async function writePlainClarifications(): Promise<Uint8Array> {
  const issued = day(brokenFiles.encrypted.issueDate);
  const pdf = await PdfWriter.create({
    title: `${project.name} - Tender Clarifications`,
    subject: 'Tender clarifications',
    runningHeader: `${project.name}  |  Tender Clarifications`,
    issued,
  });
  pdf.heading('Tender Clarifications No. 1 to 4');
  pdf.paragraph(`Issued on ${longDate(issued)} by ${parties.engineer.name} on behalf of ${parties.employer.name}, before the Contract No. ${contract.number} was awarded.`);
  pdf.bullets([
    'The tender closing date is extended to 22 December 2025 at 12:00 noon.',
    'Tenderers shall price the dynamic compaction per square metre of warehouse footprint, two passes.',
    'The geotechnical report and the topographical survey are available to all tenderers on request.',
    'Questions received after 10 December 2025 will not be answered.',
  ]);
  return (await pdf.finish()).bytes;
}

/** The encrypted file. mupdf's save options are a comma-separated list, as in its pdf_write_options. */
export async function buildEncryptedPdf(): Promise<Uint8Array> {
  const plain = await writePlainClarifications();
  const document = mupdf.Document.openDocument(plain, 'application/pdf').asPDF();
  if (!document) throw new Error('The clarifications did not open as a PDF');
  try {
    const { encryption, userPassword, ownerPassword } = brokenFiles.encrypted;
    return document.saveToBuffer(`encrypt=${encryption},user-password=${userPassword},owner-password=${ownerPassword}`).asUint8Array().slice();
  } finally {
    document.destroy();
  }
}

/** A small real CSV, the kind of index a site team keeps beside the photos. */
export function buildCsv(): Uint8Array {
  const lines = [
    'Photo,Date,Zone,Description',
    'IMG_2041.jpg,2026-06-02,Zone A,Dynamic compaction rig at W1 footprint',
    'IMG_2102.jpg,2026-07-19,W1,Pad foundation F-14 before pour',
    'IMG_2230.jpg,2026-09-03,W2,Rebar delivery DN-0455 unloading',
    'IMG_2287.jpg,2026-09-30,W3,Rejected concrete broken out in sub-zone C-2',
  ];
  return new TextEncoder().encode(`${lines.join('\r\n')}\r\n`);
}
