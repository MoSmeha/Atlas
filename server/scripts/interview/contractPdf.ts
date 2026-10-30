import { day, hijriDate, longDate } from '../samples/lib/dates';
import { formatAmount } from '../samples/lib/money';
import { PdfWriter, type WrittenPdf } from '../samples/lib/PdfWriter';
import { amountInWords } from './amountWords';
import { contract, dueText, parties, project } from './project';

export interface PriceLine {
  label: string;
  amount: number;
}

/**
 * Contract Agreement - Package 2.pdf: cover, then ten articles. Marks record the page of each fact: price,
 * letterOfAcceptance, commencement, timeForCompletion, completion, defects, advance, payment, retention, ld,
 * security, scope, scope:N, exclusions, provisional, schedule:N, schedule:total, milestone:ID, deliverable:ID.
 */
export async function buildContract(schedule: readonly PriceLine[], price: number): Promise<WrittenPdf> {
  const issued = day(contract.agreementDate);
  const priceText = `SAR ${formatAmount(price)}`;
  const pdf = await PdfWriter.create({
    title: `${project.name} - ${contract.title}`,
    subject: `Contract No. ${contract.number}`,
    runningHeader: `${project.name}  |  Contract No. ${contract.number}  |  Contract Agreement`,
    issued,
  });

  pdf.moveTo(170);
  pdf.paragraph(parties.employer.name.toUpperCase(), { size: 10.5, align: 'center', gapAfter: 4 });
  pdf.paragraph(project.name, { size: 17, bold: true, align: 'center', gapAfter: 8 });
  pdf.paragraph(contract.title, { size: 12.5, bold: true, align: 'center', gapAfter: 30 });
  pdf.labelled(
    [
      ['Contract No.', contract.number],
      ['Employer', parties.employer.name],
      ['Contractor', parties.contractor.name],
      ['Engineer', parties.engineer.name],
      ['Site', project.location],
      ['Contract Price', `${priceText} excluding VAT`],
      ['Date of Agreement', `${longDate(issued)} (${hijriDate(issued)})`],
    ],
    { cover: contract.number },
  );
  pdf.space(40);
  pdf.paragraph(
    'This Agreement, the Conditions of Contract, the Specification, the Drawings and the priced Bills of Quantities together form the Contract.',
    { italic: true, size: 9, align: 'center' },
  );

  pdf.newPage();
  pdf.heading('Article 1  The Parties');
  pdf.paragraph(
    `This Contract Agreement is made on ${longDate(issued)} between ${parties.employer.name} ("the Employer"), of ${parties.employer.address}, represented by ${parties.employer.representative}, and ${parties.contractor.name} ("the Contractor"), of ${parties.contractor.address}, represented by ${parties.contractor.representative}.`,
    {},
    { parties: 'This Contract Agreement is made on' },
  );
  pdf.paragraph(
    `${parties.engineer.name} ("the Engineer"), of ${parties.engineer.address}, administers the Contract on behalf of the Employer. The Engineer's Resident Engineer is ${parties.engineer.representative}.`,
  );
  const acceptance = longDate(day(contract.letterOfAcceptance));
  pdf.paragraph(`The Employer accepted the Contractor's Tender by the Letter of Acceptance dated ${acceptance}.`, {}, { letterOfAcceptance: acceptance });

  pdf.heading('Article 2  The Works');
  pdf.paragraph(
    `The Contractor shall construct and complete ${project.name}: ${project.description}, at ${project.location} ("the Site"), and remedy any defects in it ("the Works").`,
  );
  pdf.paragraph('The scope of the Works comprises:', { gapAfter: 3 }, { scope: 'The scope of the Works comprises' });
  pdf.bullets(
    contract.scope,
    contract.scope.map((_, index) => `scope:${index + 1}`),
  );
  pdf.paragraph(
    'The following are excluded from the Works and are procured by the Employer or the tenants separately:',
    { gapAfter: 3 },
    { exclusions: 'excluded from the Works' },
  );
  pdf.bullets(contract.exclusions);

  pdf.heading('Article 3  The Contract Price');
  pdf.paragraph(
    `The Contract Price is ${priceText} (${amountInWords(price)}), excluding Value Added Tax. VAT at ${contract.vatPercent}% is paid by the Employer in addition, against tax invoices.`,
    {},
    { price: formatAmount(price) },
  );
  pdf.paragraph('The Contract Price is made up as follows:', { gapAfter: 3 });
  pdf.table(
    [
      { header: 'Part', share: 0.72 },
      { header: 'Amount (SAR)', share: 0.28 },
    ],
    [...schedule.map((line) => [line.label, formatAmount(line.amount)]), ['Contract Price, excluding VAT', formatAmount(price)]],
    [...schedule.map((_, index) => `schedule:${index}`), 'schedule:total'],
  );
  pdf.paragraph(
    "The Provisional Sums are expended only on the Engineer's written instruction, and any part not used is deducted from the Contract Price. The quantities in the Bills of Quantities are estimated and are subject to remeasurement.",
    {},
    { provisional: 'Provisional Sums are expended' },
  );

  pdf.heading('Article 4  Dates and Time for Completion');
  const commencement = longDate(day(contract.commencement));
  const completion = longDate(day(contract.completion));
  pdf.labelled(
    [
      ['Commencement Date', commencement],
      ['Time for Completion', `${contract.timeForCompletionDays} days from the Commencement Date`],
      ['Completion Date', completion],
      ['Defects Notification Period', `${contract.defectsNotificationDays} days from the date of the Taking-Over Certificate`],
    ],
    {
      commencement,
      timeForCompletion: `${contract.timeForCompletionDays} days`,
      completion,
      defects: `${contract.defectsNotificationDays} days`,
    },
  );
  pdf.paragraph(
    'The Contractor shall complete the whole of the Works, and pass the Tests on Completion, within the Time for Completion. An extension of time is due only for the causes and in the manner set out in the Conditions of Contract.',
  );

  pdf.heading('Article 5  Milestones');
  pdf.paragraph('The Contractor shall achieve the following milestones by the dates stated. Each date is a calendar date or is counted from the Commencement Date.', {
    gapAfter: 4,
  });
  pdf.table(
    [
      { header: 'ID', share: 0.08 },
      { header: 'Milestone', share: 0.6 },
      { header: 'Due', share: 0.32 },
    ],
    contract.milestones.map((milestone) => [milestone.id, milestone.title, dueText(milestone.due)]),
    contract.milestones.map((milestone) => `milestone:${milestone.id}`),
  );

  pdf.heading("Article 6  Contractor's Deliverables");
  pdf.paragraph('The Contractor shall submit the following to the Engineer for review:', { gapAfter: 4 });
  pdf.table(
    [
      { header: 'ID', share: 0.08 },
      { header: 'Deliverable', share: 0.6 },
      { header: 'Due', share: 0.32 },
    ],
    contract.deliverables.map((deliverable) => [deliverable.id, deliverable.name, dueText(deliverable.due)]),
    contract.deliverables.map((deliverable) => `deliverable:${deliverable.id}`),
  );

  pdf.heading('Article 7  Payment');
  const { advancePayment, retention, payment } = contract;
  pdf.paragraph(
    `The Employer pays an advance payment of ${advancePayment.percent}% of the Contract Price against an advance payment guarantee, recovered by deducting ${advancePayment.recoveryPercent}% of the gross amount of each Interim Payment Certificate until it is repaid in full.`,
    {},
    { advance: 'advance payment of' },
  );
  pdf.paragraph(
    `The Contractor submits a Statement by the ${payment.statementDay}th day of each month. The Engineer issues an Interim Payment Certificate within ${payment.certifyWithinDays} days of receiving the Statement, and the Employer pays the certified amount within ${payment.payWithinDays} days of the date of the certificate.`,
    {},
    { payment: 'Interim Payment Certificate within' },
  );
  pdf.paragraph(
    `Retention of ${retention.percent}% is deducted from each payment until the retention held reaches ${retention.limitPercent}% of the Contract Price. ${retention.releasedAtTakingOverPercent}% of the retention is released on the Taking-Over Certificate and the rest at the end of the Defects Notification Period.`,
    {},
    { retention: 'Retention of' },
  );

  pdf.heading('Article 8  Liquidated Damages');
  const perDay = `SAR ${formatAmount(contract.liquidatedDamages.perDay)}`;
  pdf.paragraph(
    `If the Contractor fails to complete the Works within the Time for Completion, the Contractor pays the Employer delay damages of ${perDay} for every day of delay, up to a maximum of ${contract.liquidatedDamages.limitPercent}% of the Contract Price.`,
    {},
    { ld: perDay },
  );

  pdf.heading('Article 9  Securities');
  pdf.paragraph(
    `The Contractor provides a performance security of ${contract.performanceSecurityPercent}% of the Contract Price, valid until 28 days after the end of the Defects Notification Period, and keeps the insurances required by the Conditions of Contract in force.`,
    {},
    { security: 'performance security of' },
  );

  pdf.heading('Article 10  Governing Law and Priority of Documents');
  pdf.paragraph(
    'The Contract is governed by the laws of the Kingdom of Saudi Arabia. The documents forming the Contract are to be taken as mutually explanatory; in case of ambiguity the priority is: this Agreement, the Letter of Acceptance, the Particular Conditions, the General Conditions, the Specification, the Drawings, the priced Bills of Quantities.',
  );

  pdf.heading('Signed for and on behalf of the parties');
  pdf.labelled(
    [
      ['For the Employer', `${parties.employer.representative}, ${parties.employer.name}`],
      ['For the Contractor', `${parties.contractor.representative}, ${parties.contractor.name}`],
      ['Witnessed by', `${parties.engineer.representative}, ${parties.engineer.name}`],
    ],
    { signatures: parties.employer.representative },
  );
  return pdf.finish();
}
