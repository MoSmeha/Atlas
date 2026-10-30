import { day, longDate } from '../samples/lib/dates';
import { formatAmount } from '../samples/lib/money';
import { PdfWriter, type WrittenPdf } from '../samples/lib/PdfWriter';
import { amountInWords } from './amountWords';
import { contract, parties, project } from './project';

/** Steel Subcontract - Warehouse Frames.pdf: the Contractor's subcontract with the steel fabricator. */
export const subcontract = {
  fileName: 'Steel Subcontract - Warehouse Frames.pdf',
  number: 'KLP-P2-SC-03',
  date: '2026-05-10',
  commencement: '2026-06-01',
  price: 14_250_000,
  tonnes: 3_150,
  liquidatedDamages: { perDay: 7_500, limitPercent: 10 },
  retentionPercent: 10,
  paymentDays: 30,
  erection: [
    { warehouse: 'W1', date: '2026-11-15' },
    { warehouse: 'W2', date: '2027-01-31' },
    { warehouse: 'W3', date: '2027-03-31' },
    { warehouse: 'W4', date: '2027-04-30' },
  ],
  scope: [
    "Connection design, shop drawings and fabrication drawings for the portal frames of Warehouses W1 to W4, for the Engineer's review.",
    'Supply of structural steel grade S355JR for the portal frames, eaves beams, gable posts, crane beams and bracing, about 3,150 tonnes in all.',
    'Fabrication, shot blasting and painting of the main members to the Specification, and hot-dip galvanising of the purlins and side rails.',
    'Delivery to Site in erection sequence, with mill certificates and inspection records for every batch.',
    'Erection, lining, levelling, bolting and grouting of the frames on the holding-down bolts cast in by the Contractor.',
    'Supply and fixing of purlins, side rails, sag rods and roof bracing, ready to receive the cladding.',
  ],
  exclusions: [
    'Foundations, holding-down bolts and grout, which the Contractor supplies and casts in.',
    'Roof and wall cladding, roof lights, gutters and rainwater goods.',
    "Craneage beyond the Subcontractor's own mobile cranes, and the overhead travelling cranes of the warehouses.",
  ],
};

/** Marks: price, commencement, erection:W1 to erection:W4, allErection, ld, retention, payment, scope, scope:N, exclusions. */
export async function buildSubcontract(): Promise<WrittenPdf> {
  const issued = day(subcontract.date);
  const priceText = `SAR ${formatAmount(subcontract.price)}`;
  const pdf = await PdfWriter.create({
    title: `${project.name} - Subcontract ${subcontract.number} - Structural Steel`,
    subject: `Subcontract No. ${subcontract.number}`,
    runningHeader: `${project.name}  |  Subcontract No. ${subcontract.number}  |  Structural Steel for Warehouses W1 to W4`,
    issued,
  });
  pdf.paragraph('SUBCONTRACT AGREEMENT', { size: 15, bold: true, align: 'center', gapAfter: 4 });
  pdf.paragraph('Structural Steel Frames for Warehouses W1 to W4', { size: 11.5, bold: true, align: 'center', gapAfter: 16 });
  pdf.labelled(
    [
      ['Subcontract No.', subcontract.number],
      ['Main Contract', `${contract.number}, ${project.name}`],
      ['Contractor', parties.contractor.name],
      ['Subcontractor', parties.steel.name],
      ['Date', longDate(issued)],
    ],
    { cover: subcontract.number },
  );

  pdf.heading('1  Parties');
  pdf.paragraph(
    `This Subcontract is made on ${longDate(issued)} between ${parties.contractor.name} ("the Contractor"), of ${parties.contractor.address}, represented by ${parties.contractor.representative}, and ${parties.steel.name} ("the Subcontractor"), of ${parties.steel.address}, represented by ${parties.steel.representative}.`,
  );
  pdf.paragraph(
    `The Subcontract Works form part of the Works under Main Contract No. ${contract.number} between the Contractor and ${parties.employer.name}. The Subcontractor has read the Main Contract and shall perform the Subcontract Works so that the Contractor is not in breach of it.`,
  );

  pdf.heading('2  Subcontract Works');
  pdf.paragraph('The Subcontract Works comprise:', { gapAfter: 3 }, { scope: 'The Subcontract Works comprise' });
  pdf.bullets(
    subcontract.scope,
    subcontract.scope.map((_, index) => `scope:${index + 1}`),
  );
  pdf.paragraph('Excluded from the Subcontract Works:', { gapAfter: 3 }, { exclusions: 'Excluded from the Subcontract Works' });
  pdf.bullets(subcontract.exclusions);

  pdf.heading('3  Subcontract Price');
  pdf.paragraph(
    `The Subcontract Price is ${priceText} (${amountInWords(subcontract.price)}), excluding Value Added Tax, for about ${subcontract.tonnes.toLocaleString('en-US')} tonnes of fabricated and erected steel. The Price is a lump sum; it is adjusted only for variations instructed in writing by the Contractor.`,
    {},
    { price: formatAmount(subcontract.price) },
  );

  pdf.heading('4  Programme');
  const commencement = longDate(day(subcontract.commencement));
  pdf.paragraph(`The Subcontractor starts fabrication on ${commencement} and completes erection of each warehouse by the following dates:`, { gapAfter: 4 }, { commencement });
  pdf.table(
    [
      { header: 'Warehouse', share: 0.3 },
      { header: 'Erection complete by', share: 0.7 },
    ],
    subcontract.erection.map((entry) => [entry.warehouse, longDate(day(entry.date))]),
    subcontract.erection.map((entry) => `erection:${entry.warehouse}`),
  );
  const last = subcontract.erection.at(-1)!;
  pdf.paragraph(
    `Completion of the whole of the Subcontract Works, with the purlins, side rails and bracing fixed on all four warehouses, is due by ${longDate(day(last.date))}.`,
    {},
    { allErection: 'Completion of the whole of the Subcontract Works' },
  );

  pdf.heading('5  Liquidated Damages');
  const perDay = `SAR ${formatAmount(subcontract.liquidatedDamages.perDay)}`;
  pdf.paragraph(
    `If the Subcontractor fails to complete the erection of any warehouse by its date, the Subcontractor pays the Contractor liquidated damages of ${perDay} per day of delay, up to ${subcontract.liquidatedDamages.limitPercent}% of the Subcontract Price in all.`,
    {},
    { ld: perDay },
  );

  pdf.heading('6  Payment');
  pdf.paragraph(
    `The Subcontractor submits a monthly statement of the steel fabricated, delivered and erected. The Contractor pays within ${subcontract.paymentDays} days of its certificate, less retention of ${subcontract.retentionPercent}%, half of which is released on completion of erection of Warehouse W4 and the rest at the end of the Main Contract Defects Notification Period.`,
    {},
    { payment: `within ${subcontract.paymentDays} days`, retention: `retention of ${subcontract.retentionPercent}%` },
  );

  pdf.heading('7  Quality and Safety');
  pdf.paragraph(
    "The Subcontractor works to the Main Contract Specification, Part 4 Structural Steel and Cladding, and to the Contractor's Health, Safety and Environment Plan. Every erection crew includes a certified rigger and a qualified crane operator, and no member is lifted without an approved lifting plan.",
  );

  pdf.heading('Signed for and on behalf of the parties');
  pdf.labelled([
    ['For the Contractor', `${parties.contractor.representative}, ${parties.contractor.name}`],
    ['For the Subcontractor', `${parties.steel.representative}, ${parties.steel.name}`],
  ]);
  return pdf.finish();
}
