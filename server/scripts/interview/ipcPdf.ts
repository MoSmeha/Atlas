import { addDays, day, isoDate, longDate } from '../samples/lib/dates';
import { formatAmount, sumAmounts } from '../samples/lib/money';
import { PdfWriter, type WrittenPdf } from '../samples/lib/PdfWriter';
import { contract, parties, project } from './project';

/** IPC-07 Payment Certificate.pdf: the latest interim payment certificate. The amounts follow from these figures. */
export const ipc = {
  fileName: 'IPC-07 Payment Certificate.pdf',
  number: 7,
  periodEnd: '2026-08-31',
  statementDate: '2026-08-28',
  certifiedDate: '2026-09-12',
  cumulativeWorkDone: 41_230_117.5,
  previousCumulative: 35_811_787.3,
};

export interface IpcFigures {
  thisPeriod: number;
  retention: number;
  advanceRecovery: number;
  net: number;
  vat: number;
  amountDue: number;
  /** YYYY-MM-DD, the certificate date plus the contract's payment period. */
  dueDate: string;
  advancePaid: number;
  cumulativeRetention: number;
}

const round2 = (value: number): number => Math.round(value * 100) / 100;

export function ipcFigures(contractPrice: number): IpcFigures {
  const thisPeriod = sumAmounts([ipc.cumulativeWorkDone, -ipc.previousCumulative]);
  const retention = round2((thisPeriod * contract.retention.percent) / 100);
  const advanceRecovery = round2((thisPeriod * contract.advancePayment.recoveryPercent) / 100);
  const net = sumAmounts([thisPeriod, -retention, -advanceRecovery]);
  const vat = round2((net * contract.vatPercent) / 100);
  const amountDue = sumAmounts([net, vat]);
  const dueDate = isoDate(addDays(day(ipc.certifiedDate), contract.payment.payWithinDays));
  const advancePaid = round2((contractPrice * contract.advancePayment.percent) / 100);
  const cumulativeRetention = round2((ipc.cumulativeWorkDone * contract.retention.percent) / 100);
  return { thisPeriod, retention, advanceRecovery, net, vat, amountDue, dueDate, advancePaid, cumulativeRetention };
}

/** Marks: amountDue (the table row), dueDate, certified, thisPeriod. */
export async function buildIpc(contractPrice: number): Promise<{ pdf: WrittenPdf; figures: IpcFigures }> {
  const figures = ipcFigures(contractPrice);
  const issued = day(ipc.certifiedDate);
  const certified = longDate(issued);
  const due = longDate(day(figures.dueDate));
  const pdf = await PdfWriter.create({
    title: `${project.name} - Interim Payment Certificate No. ${ipc.number}`,
    subject: `Contract No. ${contract.number}`,
    runningHeader: `${project.name}  |  Contract No. ${contract.number}  |  Interim Payment Certificate No. ${ipc.number}`,
    issued,
  });
  pdf.paragraph(parties.engineer.name, { size: 10, align: 'center', gapAfter: 2 });
  pdf.paragraph(`INTERIM PAYMENT CERTIFICATE No. ${ipc.number}`, { size: 15, bold: true, align: 'center', gapAfter: 14 });
  pdf.labelled(
    [
      ['Contract', `${contract.number}, ${project.name}`],
      ['Employer', parties.employer.name],
      ['Contractor', parties.contractor.name],
      ['Contract Price', `SAR ${formatAmount(contractPrice)} excluding VAT`],
      ['Period ending', longDate(day(ipc.periodEnd))],
      ["Contractor's Statement dated", longDate(day(ipc.statementDate))],
      ['Certificate date', certified],
      ['Payment due by', `${due} (${contract.payment.payWithinDays} days from the certificate date)`],
    ],
    { certified, dueDate: due },
  );
  pdf.space(8);
  pdf.heading('Certified amounts');
  const rows: [string, string][] = [
    ['Cumulative value of work done to the end of the period', formatAmount(ipc.cumulativeWorkDone)],
    [`Less: cumulative value previously certified (IPC-01 to IPC-0${ipc.number - 1})`, formatAmount(ipc.previousCumulative)],
    ['Value of work done this period', formatAmount(figures.thisPeriod)],
    [`Less: retention at ${contract.retention.percent}%`, formatAmount(figures.retention)],
    [`Less: recovery of advance payment at ${contract.advancePayment.recoveryPercent}%`, formatAmount(figures.advanceRecovery)],
    ['Net amount this period, excluding VAT', formatAmount(figures.net)],
    [`Add: VAT at ${contract.vatPercent}%`, formatAmount(figures.vat)],
    ['AMOUNT DUE UNDER THIS CERTIFICATE, INCLUDING VAT', formatAmount(figures.amountDue)],
  ];
  pdf.table(
    [
      { header: 'Description', share: 0.7 },
      { header: 'Amount (SAR)', share: 0.3 },
    ],
    rows,
    [null, null, 'thisPeriod', null, null, null, null, 'amountDue'],
  );
  pdf.paragraph(
    `The amount due under this certificate is SAR ${formatAmount(figures.amountDue)}, payable by the Employer by ${due}.`,
    { bold: true },
  );
  pdf.space(6);
  pdf.heading('Notes');
  pdf.bullets([
    `Advance payment of SAR ${formatAmount(figures.advancePaid)} (${contract.advancePayment.percent}% of the Contract Price) was paid on 2 April 2026; recovery continues at ${contract.advancePayment.recoveryPercent}% of each gross certificate.`,
    `Retention held to date: SAR ${formatAmount(figures.cumulativeRetention)}, within the limit of ${contract.retention.limitPercent}% of the Contract Price.`,
    'Approved variation orders are included in the cumulative value of work done at the rates agreed in each order.',
    "Quantities are as remeasured and agreed between the Engineer's and the Contractor's quantity surveyors on Site.",
  ]);
  pdf.space(12);
  pdf.labelled([
    ['Certified by', `${parties.engineer.representative}, ${parties.engineer.name}`],
    ['Received by', `${parties.employer.representative}, ${parties.employer.name}`],
  ]);
  return { pdf: await pdf.finish(), figures };
}
