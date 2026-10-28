import * as mupdf from 'mupdf';
import { day, longDate } from './lib/dates';
import { PdfWriter } from './lib/PdfWriter';
import { contract, parties, project } from './project';

/**
 * Tender_Addendum_03.pdf: a tender addendum saved with AES-256 encryption and a user password, so it cannot
 * be opened without the password. AES uses random salts, so the bytes differ on every run while the content stays the same.
 */
export const tenderAddendum = {
  fileName: 'Tender_Addendum_03.pdf',
  issueDate: '2025-11-20',
  userPassword: 'NGT-addendum-03',
  ownerPassword: 'NGT-owner-only',
  encryption: 'aes-256',
};

const CLARIFICATIONS = [
  'The tender closing date is extended to 14 December 2025 at 12:00 noon, Riyadh time.',
  'Tenderers shall price the facade visual mock-up as a separate item in Bill No. 2.',
  'The Employer will provide the site survey and the geotechnical report to all tenderers on request.',
  'Questions received after 30 November 2025 will not be answered.',
];

/** The addendum before encryption. */
export async function writePlainTenderAddendum(): Promise<Uint8Array> {
  const issued = day(tenderAddendum.issueDate);
  const pdf = await PdfWriter.create({
    title: `${project.name} - Tender Addendum No. 03`,
    subject: 'Tender addendum',
    runningHeader: `${project.name}  |  Tender Addendum No. 03`,
    issued,
  });
  pdf.heading('Tender Addendum No. 03');
  pdf.paragraph(`Issued on ${longDate(issued)} by ${parties.engineer.name} on behalf of ${parties.employer.name}.`);
  pdf.paragraph(`This addendum forms part of the tender documents for Contract No. ${contract.number}. Tenderers shall acknowledge it in their tender.`);
  pdf.bullets(CLARIFICATIONS);
  return (await pdf.finish()).bytes;
}

/** The encrypted file. mupdf's save options are a comma-separated list, as in its pdf_write_options. */
export async function buildTenderAddendum(): Promise<Uint8Array> {
  const plain = await writePlainTenderAddendum();
  const document = mupdf.Document.openDocument(plain, 'application/pdf').asPDF();
  if (!document) throw new Error('The tender addendum did not open as a PDF');
  try {
    const options = [
      `encrypt=${tenderAddendum.encryption}`,
      `user-password=${tenderAddendum.userPassword}`,
      `owner-password=${tenderAddendum.ownerPassword}`,
    ].join(',');
    return document.saveToBuffer(options).asUint8Array().slice();
  } finally {
    document.destroy();
  }
}
