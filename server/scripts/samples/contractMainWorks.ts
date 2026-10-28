import { addDays, addMonths, checkHijri, day, longDate, ordinal } from './lib/dates';
import { dueText } from './lib/due';
import { formatAmount } from './lib/money';
import { PdfWriter, type WrittenPdf } from './lib/PdfWriter';
import { contract, parties, project, type Party } from './project';

export interface GeneratedPdf extends WrittenPdf {
  fileName: string;
}

/** The last day of the Time for Completion: the day before the same date 30 months on. */
export function completionDate(): Date {
  return addDays(addMonths(day(contract.commencement.date), contract.timeForCompletionMonths), -1);
}

/** Contract_Main_Works.pdf: an eight-page contract agreement whose facts are marked with their page numbers. */
export async function buildContractMainWorks(): Promise<GeneratedPdf> {
  const signed = longDate(day(contract.contractDate.date));
  const signedHijri = checkHijri(contract.contractDate.date, contract.contractDate.hijri);
  const commencement = longDate(day(contract.commencement.date));
  const commencementHijri = checkHijri(contract.commencement.date, contract.commencement.hijri);
  const acceptance = longDate(day(contract.letterOfAcceptance));
  const completion = longDate(completionDate());
  const price = `SAR ${formatAmount(contract.price.amount)}`;

  const pdf = await PdfWriter.create({
    title: `${project.name} - ${contract.title}`,
    subject: `Contract No. ${contract.number}`,
    runningHeader: `${project.name}  |  ${contract.title}  |  Contract No. ${contract.number}`,
    issued: day(contract.contractDate.date),
  });

  // Page 1: cover
  pdf.moveTo(170);
  pdf.paragraph('CONTRACT AGREEMENT', { size: 22, bold: true, align: 'center', gapAfter: 4 });
  pdf.paragraph('for the Main Works', { size: 14, align: 'center', gapAfter: 36 });
  pdf.paragraph(project.name, { size: 17, bold: true, align: 'center', gapAfter: 4 }, { projectName: project.name });
  pdf.paragraph(project.location, { size: 10.5, align: 'center', gapAfter: 36 });
  pdf.paragraph(`Contract No. ${contract.number}`, { size: 11, align: 'center', gapAfter: 2 });
  pdf.paragraph(`Dated ${signed} (${signedHijri})`, { size: 11, align: 'center', gapAfter: 48 });
  pdf.labelled([
    ['Employer', parties.employer.name],
    ['Contractor', parties.contractor.name],
    ['Engineer', parties.engineer.name],
    ['Contract Price', `${contract.price.shortText}, exclusive of VAT (exact amount in Article 2)`],
    ['Commencement Date', commencement],
    ['Time for Completion', `${contract.timeForCompletionMonths} months`],
  ], { contractPriceShort: contract.price.shortText });

  // Page 2: parties and definitions
  pdf.newPage();
  pdf.heading('Agreement');
  pdf.paragraph(`This Contract Agreement is made on ${signed}, corresponding to ${signedHijri}, between:`, {}, {
    contractDate: signed,
    contractDateHijri: signedHijri,
  });
  partyParagraph(pdf, '(1)', parties.employer, 'employer', '; and');
  partyParagraph(pdf, '(2)', parties.contractor, 'contractor', '.');
  pdf.paragraph(
    `The Employer has appointed ${parties.engineer.name}, ${parties.engineer.address}, ${parties.engineer.registration}, as the Engineer for the purposes of the Contract, represented by ${parties.engineer.representative}.`,
    {},
    { engineer: parties.engineer.name },
  );
  pdf.paragraph(
    `Whereas the Employer wishes to have the Works known as the ${project.name} executed by the Contractor, being ${project.description}, at ${project.location}; and whereas the Employer has accepted the Tender of the Contractor by a Letter of Acceptance dated ${acceptance}; the Employer and the Contractor agree as follows.`,
    {},
    { letterOfAcceptance: acceptance },
  );
  pdf.heading('Article 1  Definitions');
  pdf.paragraph('In this Contract the following words have the meanings given below.');
  const definitions: [string, string][] = [
    ['Commencement Date', 'the date stated in Article 5.1, from which the Time for Completion is counted.'],
    ['Contract Price', 'the amount stated in Article 2.1, subject to adjustment under the Contract.'],
    ['Day', 'a calendar day. Month means a Gregorian calendar month.'],
    ['Engineer', 'the person appointed by the Employer to act as the Engineer under the Contract.'],
    ['Site', `the land at ${project.location} where the Works are to be executed.`],
    ['Taking-Over Certificate', 'the certificate the Engineer issues when the Works are complete and ready for use.'],
    ['Time for Completion', 'the period stated in Article 5.3 for completing the Works.'],
    ['Works', 'the permanent and temporary works described in Article 4.'],
  ];
  for (const [term, meaning] of definitions) pdf.paragraph(`"${term}" means ${meaning}`, { indent: 14, gapAfter: 4 });

  // Page 3: price and contract documents
  pdf.newPage();
  pdf.heading('Article 2  Contract Price');
  pdf.paragraph(
    `2.1  The Contract Price is ${price} (${contract.price.words}), exclusive of Value Added Tax.`,
    {},
    { contractPrice: price },
  );
  pdf.paragraph(
    `2.2  Value Added Tax at the rate in force, currently ${contract.vatPercent}%, shall be added to each payment and shown separately on each invoice.`,
    {},
    { vat: `currently ${contract.vatPercent}%` },
  );
  pdf.paragraph(
    '2.3  The Contract Price was built up from the priced Bills of Quantities. Quantities in the Bills are estimates; the Works shall be measured and valued at the rates in the Bills.',
  );
  pdf.paragraph(
    '2.4  The Bill of Quantities for Phase 1 covers the substructure, the superstructure and the mechanical, electrical and plumbing (MEP) works. The Bill of Quantities for Phase 2, covering vertical transportation, internal finishes to common areas, external works and landscaping, will be issued separately.',
  );
  pdf.paragraph('2.5  All amounts are stated and paid in Saudi Riyals (SAR).');
  pdf.heading('Article 3  Contract Documents');
  pdf.paragraph(
    '3.1  The following documents form the Contract and shall be read together. If there is a conflict between them, the document listed first prevails.',
  );
  pdf.bullets([
    'This Contract Agreement.',
    `The Letter of Acceptance dated ${acceptance}.`,
    'The Particular Conditions of Contract.',
    'The General Conditions of Contract.',
    "The Employer's Requirements and the Specification.",
    'The Drawings.',
    'The priced Bills of Quantities, including the Bill of Quantities for Phase 1.',
    "The Contractor's Technical Proposal.",
  ]);
  pdf.paragraph(
    '3.2  The Contract is written in English. Notices and correspondence may be in English or Arabic; where a translation is required, the English text prevails.',
  );

  // Page 4: scope of work
  pdf.newPage();
  pdf.heading('Article 4  Scope of Work', { scopeOfWork: 'Scope of Work' });
  pdf.paragraph(
    "4.1  The Contractor shall design, to the extent stated in the Employer's Requirements, execute and complete the Works and remedy any defects in them. The Works include:",
  );
  pdf.bullets(contract.scope, contract.scope.map((_, i) => `scope.${i + 1}`));
  pdf.paragraph('4.2  The following are not part of the Works:');
  pdf.bullets(contract.exclusions, contract.exclusions.map((_, i) => `exclusion.${i + 1}`));
  pdf.paragraph(
    '4.3  The Contractor shall provide all labour, materials, plant, equipment and supervision needed for the Works, and shall keep the Site safe, secure and clean until the Taking-Over Certificate is issued.',
  );

  // Page 5: time
  pdf.newPage();
  pdf.heading('Article 5  Commencement and Time for Completion');
  pdf.paragraph(`5.1  The Commencement Date is ${commencement}, corresponding to ${commencementHijri}.`, {}, {
    commencementDate: commencement,
    commencementHijri,
  });
  pdf.paragraph(
    '5.2  The Contractor shall submit the Baseline Programme to the Engineer within 28 days of the Commencement Date. The programme shall show the sequence of the Works, the milestones in Article 6 and the critical path.',
    {},
    { baselineProgramme: 'within 28 days of the Commencement Date' },
  );
  pdf.paragraph(
    `5.3  Time for Completion: ${contract.timeForCompletionMonths} months from the Commencement Date. The Works shall be completed, and the Taking-Over Certificate issued, on or before ${completion}.`,
    {},
    { timeForCompletion: `Time for Completion: ${contract.timeForCompletionMonths} months`, completionDate: completion },
  );
  pdf.paragraph(
    `5.4  The Engineer shall review each design submission and respond within ${contract.designReviewDays} days of receiving it. The Contractor shall not start work on any part of the Works until the design for that part has been reviewed.`,
    {},
    { designReview: `within ${contract.designReviewDays} days of receiving it` },
  );
  pdf.paragraph(
    '5.5  The Contractor is entitled to an extension of the Time for Completion if completion is or will be delayed by a variation, by an act or omission of the Employer, or by exceptionally adverse events beyond the control of the Contractor. The Contractor shall give notice within 28 days after becoming aware of the event.',
  );
  pdf.paragraph(
    '5.6  Working hours on Site follow the Saudi Labour Law, including the reduced working hours during the month of Ramadan. Work at night or on official holidays needs the prior consent of the Engineer.',
  );
  pdf.paragraph(
    '5.7  All dates in this Contract are Gregorian. Hijri dates are given for reference only; where they differ, the Gregorian date governs.',
  );

  // Page 6: milestones and deliverables
  pdf.newPage();
  pdf.heading('Article 6  Milestones and Deliverables', { milestonesSection: 'Milestones and Deliverables' });
  pdf.paragraph('6.1  The Contractor shall achieve the following milestones by the dates stated.');
  pdf.table(
    [
      { header: 'Milestone', share: 0.12 },
      { header: 'Description', share: 0.48 },
      { header: 'Date', share: 0.4 },
    ],
    contract.milestones.map((m) => [m.id, m.title, dueText(m.due)]),
    contract.milestones.map((m) => `milestone.${m.id}`),
  );
  pdf.paragraph('6.2  The Contractor shall submit the following deliverables to the Engineer.');
  pdf.table(
    [
      { header: 'Ref.', share: 0.1 },
      { header: 'Deliverable', share: 0.5 },
      { header: 'Due', share: 0.4 },
    ],
    contract.deliverables.map((d) => [d.id, d.name, dueText(d.due)]),
    contract.deliverables.map((d) => `deliverable.${d.id}`),
  );
  pdf.paragraph(
    '6.3  Each deliverable shall be submitted in electronic form, as PDF and in its native format, together with two printed copies.',
  );

  // Page 7: payment
  pdf.newPage();
  pdf.heading('Article 7  Payment Terms', { paymentTerms: 'Payment Terms' });
  const advance = contract.advancePayment;
  pdf.paragraph(
    `7.1  Advance payment. The Employer shall pay an advance payment of ${advance.percent}% of the Contract Price within ${advance.paidWithinDays} days of receiving the Advance Payment Guarantee. The advance payment shall be recovered by deducting ${advance.recoveryPercent}% from each Interim Payment Certificate until it is repaid in full.`,
    {},
    { advancePayment: `advance payment of ${advance.percent}% of the Contract Price` },
  );
  const pay = contract.payment;
  pdf.paragraph(
    `7.2  Monthly statements. The Contractor shall submit a Statement to the Engineer by the ${ordinal(pay.statementDay)} day of each month, showing the value of the work executed up to the end of that month, supported by measurements and progress records.`,
    {},
    { paymentStatement: `by the ${ordinal(pay.statementDay)} day of each month` },
  );
  pdf.paragraph(
    `7.3  Interim Payment Certificates. The Engineer shall issue an Interim Payment Certificate within ${pay.certifyWithinDays} days of receiving each Statement.`,
    {},
    { paymentCertificate: `within ${pay.certifyWithinDays} days of receiving each Statement` },
  );
  pdf.paragraph(
    `7.4  Payment. The Employer shall pay the amount certified within ${pay.payWithinDays} days of the date of each Interim Payment Certificate.`,
    {},
    { paymentPeriod: `within ${pay.payWithinDays} days of the date of each Interim Payment Certificate` },
  );
  const retention = contract.retention;
  pdf.paragraph(
    `7.5  Retention. Retention money of ${retention.percentOfEachPayment}% shall be deducted from each Interim Payment Certificate until the total retention reaches ${retention.limitPercentOfPrice}% of the Contract Price.`,
    {},
    { retention: `Retention money of ${retention.percentOfEachPayment}%` },
  );
  pdf.paragraph(
    `7.6  Release of retention. ${retention.releasedAtTakingOverPercent}% of the retention money shall be released when the Taking-Over Certificate is issued, and the remaining ${100 - retention.releasedAtTakingOverPercent}% after the end of the Defects Notification Period.`,
    {},
    { retentionRelease: `${retention.releasedAtTakingOverPercent}% of the retention money shall be released` },
  );
  pdf.paragraph(
    `7.7  Final payment. The Employer shall pay the amount of the Final Payment Certificate within ${pay.finalPayWithinDays} days of its issue.`,
    {},
    { finalPayment: `within ${pay.finalPayWithinDays} days of its issue` },
  );
  pdf.paragraph(
    '7.8  Each Statement and certificate shall show separately the value of work done, the retention deducted, the advance payment recovered and the Value Added Tax.',
  );

  // Page 8: securities, damages, law and signatures
  pdf.newPage();
  pdf.heading('Article 8  Securities, Delay Damages and Defects');
  pdf.paragraph(
    `8.1  Performance Security. The Contractor shall deliver a Performance Security of ${contract.performanceSecurityPercent}% of the Contract Price within 28 days of receiving the Letter of Acceptance. It shall remain valid until the Performance Certificate is issued.`,
    {},
    { performanceSecurity: `Performance Security of ${contract.performanceSecurityPercent}% of the Contract Price` },
  );
  const damages = contract.liquidatedDamages;
  pdf.paragraph(
    `8.2  Liquidated damages. If the Contractor fails to complete the Works within the Time for Completion, it shall pay liquidated damages of SAR ${formatAmount(damages.perDay)} per day of delay. The total liquidated damages shall not exceed ${damages.limitPercentOfPrice}% of the Contract Price.`,
    {},
    {
      liquidatedDamages: `SAR ${formatAmount(damages.perDay)} per day of delay`,
      liquidatedDamagesLimit: `shall not exceed ${damages.limitPercentOfPrice}% of the Contract Price`,
    },
  );
  pdf.paragraph(
    `8.3  Defects Notification Period. The Defects Notification Period is ${contract.defectsNotificationMonths} months from the date in the Taking-Over Certificate. The Contractor shall remedy any defect notified during this period at its own cost.`,
    {},
    { defectsNotificationPeriod: `${contract.defectsNotificationMonths} months from the date in the Taking-Over Certificate` },
  );
  pdf.paragraph(
    "8.4  Insurance. The Contractor shall insure the Works, the Contractor's equipment and third-party liability in the joint names of the Parties from the Commencement Date until the Taking-Over Certificate is issued.",
  );
  pdf.heading('Article 9  Governing Law and Disputes');
  pdf.paragraph('9.1  The Contract is governed by the laws of the Kingdom of Saudi Arabia.');
  pdf.paragraph(
    '9.2  A dispute shall first be referred to the Engineer, then to a Dispute Avoidance and Adjudication Board, and finally to arbitration seated in Riyadh under the Saudi Arbitration Law.',
  );
  pdf.space(10);
  pdf.paragraph('In witness whereof the Parties have signed this Contract Agreement on the date first written above.');
  pdf.space(14);
  for (const party of [parties.employer, parties.contractor]) {
    pdf.paragraph(`Signed for and on behalf of the ${party.role}, ${party.name}`, { bold: true, gapAfter: 16 });
    pdf.paragraph(`Signature: ______________________     Name: ${party.representative}`, { gapAfter: 14 });
  }

  return { fileName: contract.fileName, ...(await pdf.finish()) };
}

function partyParagraph(pdf: PdfWriter, label: string, party: Party, key: string, ending: string): void {
  pdf.paragraph(
    `${label}  ${party.name}, ${party.registration}, of ${party.address}, represented by ${party.representative} (the "${party.role}")${ending}`,
    { indent: 14 },
    { [key]: party.name },
  );
}
