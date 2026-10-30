import { day, longDate } from '../samples/lib/dates';
import { formatAmount } from '../samples/lib/money';
import { PdfWriter, type WrittenPdf } from '../samples/lib/PdfWriter';
import { contract, parties, project } from './project';

/** Correspondence/Letter - EOT Claim No 2.pdf: the Contractor claims 46 days for the late handover of Zone C. */
export const eotLetter = {
  fileName: 'Letter - EOT Claim No 2.pdf',
  reference: 'TBC-KLP-LTR-0288',
  date: '2026-10-12',
  claimNumber: 2,
  days: 46,
  zone: 'Zone C',
  plannedAccess: '2026-03-15',
  actualAccess: '2026-04-30',
  /** The contract completion date plus 46 days. */
  revisedCompletion: '2027-10-30',
  prolongationCost: 1_118_000,
  prolongationVo: 'VO-013',
  claimOne: { days: 12, determination: 'ED-01', date: '2026-07-02', subject: 'the delayed utility survey' },
};

/** Marks: days, cause, revisedCompletion, cost, claimOne. */
export async function buildEotLetter(): Promise<WrittenPdf> {
  const issued = day(eotLetter.date);
  const pdf = await PdfWriter.create({
    title: `${project.name} - Extension of Time Claim No. ${eotLetter.claimNumber}`,
    subject: `Letter ${eotLetter.reference}`,
    runningHeader: `${parties.contractor.name}  |  Ref. ${eotLetter.reference}  |  Extension of Time Claim No. ${eotLetter.claimNumber}`,
    issued,
  });
  pdf.paragraph(parties.contractor.name.toUpperCase(), { size: 12, bold: true, gapAfter: 1 });
  pdf.paragraph(parties.contractor.address, { size: 9, gapAfter: 16 });
  pdf.labelled([
    ['Our ref.', eotLetter.reference],
    ['Date', longDate(issued)],
    ['To', `${parties.engineer.representative}, ${parties.engineer.name}, ${parties.engineer.address}`],
    ['Copy', `${parties.employer.representative}, ${parties.employer.name}`],
    ['Subject', `Contract No. ${contract.number}, ${project.name}: Extension of Time Claim No. ${eotLetter.claimNumber}, late handover of ${eotLetter.zone}`],
  ]);
  pdf.space(6);
  pdf.paragraph('Dear Eng. Noura,');
  const planned = longDate(day(eotLetter.plannedAccess));
  const actual = longDate(day(eotLetter.actualAccess));
  pdf.paragraph(
    `1. Further to our notice of 4 May 2026 under Sub-Clause 20.1, we submit our fully detailed claim for an extension of the Time for Completion. The particulars and the supporting records are attached.`,
  );
  pdf.paragraph(
    `2. The Contract required the Employer to give the Contractor access to the whole of the Site on the Commencement Date, ${planned}. Access to ${eotLetter.zone}, the footprint of Warehouses W3 and W4 and the eastern truck court, was given on ${actual}, ${eotLetter.days} days late, because the fence of the neighbouring plot had not been relocated.`,
    {},
    { cause: `Access to ${eotLetter.zone}` },
  );
  pdf.paragraph(
    `3. The ground improvement in ${eotLetter.zone} is on the critical path of the Baseline Programme Revision 1 (activities A050, A070 and A090). The attached time impact analysis shows that the late access delayed the completion of the Works by the same ${eotLetter.days} days, and that no concurrent delay of the Contractor's own was on the critical path in that period.`,
  );
  const revised = longDate(day(eotLetter.revisedCompletion));
  pdf.paragraph(
    `4. We therefore claim an extension of the Time for Completion of ${eotLetter.days} calendar days, so that the Completion Date moves from ${longDate(day(contract.completion))} to ${revised}.`,
    {},
    { days: `${eotLetter.days} calendar days`, revisedCompletion: revised },
  );
  pdf.paragraph(
    `5. The prolongation costs arising from the same event amount to SAR ${formatAmount(eotLetter.prolongationCost)} and are submitted separately as variation order ${eotLetter.prolongationVo}.`,
    {},
    { cost: formatAmount(eotLetter.prolongationCost) },
  );
  pdf.paragraph(
    `6. For the record, Claim No. 1 (${eotLetter.claimOne.days} days for ${eotLetter.claimOne.subject}) was rejected by the Engineer's determination ${eotLetter.claimOne.determination} of ${longDate(day(eotLetter.claimOne.date))} and is not repeated here; we reserve our position on it.`,
    {},
    { claimOne: 'Claim No. 1' },
  );
  pdf.paragraph('7. We would be grateful for your determination within the period allowed by the Contract.');
  pdf.space(6);
  pdf.paragraph('Yours sincerely,');
  pdf.space(28);
  pdf.paragraph(parties.contractor.representative, { bold: true, gapAfter: 1 });
  pdf.paragraph(parties.contractor.name);
  pdf.space(10);
  pdf.paragraph('Attachments:', { bold: true, gapAfter: 3 });
  pdf.bullets([
    'Time impact analysis, as-planned against as-built, with the critical path at each window',
    `Site handover records for ${eotLetter.zone}, signed by the Engineer on ${actual}`,
    'Correspondence on the relocation of the neighbouring fence',
    'Daily site diaries, March to May 2026',
  ]);
  return pdf.finish();
}
