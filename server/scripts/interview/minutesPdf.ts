import { day, longDate } from '../samples/lib/dates';
import { formatAmount } from '../samples/lib/money';
import { PdfWriter, type WrittenPdf } from '../samples/lib/PdfWriter';
import { contract, parties, project } from './project';

export interface Attendee {
  name: string;
  organisation: string;
  role: string;
}

export interface Action {
  n: number;
  action: string;
  owner: string;
  /** YYYY-MM-DD. */
  due: string;
}

/** Progress Meeting No 12 - Minutes.pdf: progress against plan, quality, commercial status and an actions table. */
export const minutes = {
  fileName: 'Progress Meeting No 12 - Minutes.pdf',
  number: 12,
  date: '2026-10-06',
  previousDate: '2026-09-22',
  nextMeeting: '2026-10-20',
  progress: { actualPercent: 38.6, plannedPercent: 44.0, daysBehind: 23 },
  safeManHours: 1_246_800,
  rebarDelivery: '2026-09-03',
  attendees: [
    { name: 'Eng. Khalid Al-Dossary', organisation: parties.employer.name, role: 'Development Director' },
    { name: 'Ms. Hala Qassem', organisation: parties.employer.name, role: 'Cost Controller' },
    { name: 'Eng. Noura Al-Shehri', organisation: parties.engineer.name, role: 'Resident Engineer' },
    { name: 'Eng. Yousef Barakat', organisation: parties.engineer.name, role: 'Structural Inspector' },
    { name: 'Eng. Rami Haddad', organisation: parties.contractor.name, role: 'Project Manager' },
    { name: 'Mr. Imran Siddiqui', organisation: parties.contractor.name, role: 'Planning Engineer' },
    { name: 'Mr. Tariq Mansour', organisation: parties.steel.name, role: 'General Manager' },
  ] satisfies Attendee[],
  actions: [
    { n: 1, action: 'Issue the revised programme (Revision 2) showing how the 23-day delay is recovered', owner: 'Thuraya Build (Planning Engineer)', due: '2026-10-20' },
    { n: 2, action: 'Submit Extension of Time Claim No. 2 with the supporting records', owner: 'Thuraya Build (Project Manager)', due: '2026-10-12' },
    { n: 3, action: 'Confirm the relocation of the Zone C boundary fence with the neighbouring plot owner', owner: 'Bahr Line (Development Director)', due: '2026-10-15' },
    { n: 4, action: 'Return comments on the ESFR sprinkler design submission (deliverable D6)', owner: 'Rakeen (Resident Engineer)', due: '2026-10-18' },
    { n: 5, action: 'Re-inspect the Warehouse W3 slab reinforcement and close NCR-023', owner: 'Rakeen (Structural Inspector)', due: '2026-10-13' },
    { n: 6, action: 'Confirm the November delivery schedule for the Warehouse W2 steel', owner: 'Sahel Steel (General Manager)', due: '2026-10-10' },
  ] satisfies Action[],
};

export interface MinutesInput {
  voApprovedTotal: number;
  voApprovedCount: number;
  voPendingCount: number;
  ipcAmountDue: number;
  ipcCertified: string;
}

/** Marks: progress, daysBehind, ncr, commercial, safety, action:N, nextMeeting. */
export async function buildMinutes(input: MinutesInput): Promise<WrittenPdf> {
  const issued = day(minutes.date);
  const pdf = await PdfWriter.create({
    title: `${project.name} - Progress Meeting No. ${minutes.number} - Minutes`,
    subject: `Contract No. ${contract.number}`,
    runningHeader: `${project.name}  |  Progress Meeting No. ${minutes.number}  |  ${longDate(issued)}`,
    issued,
  });
  pdf.paragraph(parties.engineer.name, { size: 10, gapAfter: 2 });
  pdf.paragraph(`MINUTES OF PROGRESS MEETING No. ${minutes.number}`, { size: 14, bold: true, gapAfter: 10 });
  pdf.labelled([
    ['Project', `${project.name}, Contract No. ${contract.number}`],
    ['Date and time', `${longDate(issued)}, 10:00 to 12:15`],
    ['Place', "The Engineer's site office, Plot 12, Al Khobar Industrial Zone"],
    ['Minutes by', 'Eng. Yousef Barakat, Structural Inspector'],
  ]);
  pdf.heading('1  Attendance');
  pdf.table(
    [
      { header: 'Name', share: 0.3 },
      { header: 'Organisation', share: 0.42 },
      { header: 'Role', share: 0.28 },
    ],
    minutes.attendees.map((attendee) => [attendee.name, attendee.organisation, attendee.role]),
  );

  pdf.heading('2  Previous minutes');
  pdf.paragraph(`The minutes of Progress Meeting No. ${minutes.number - 1} held on ${longDate(day(minutes.previousDate))} were accepted without change.`);

  pdf.heading('3  Progress');
  const { progress } = minutes;
  pdf.paragraph(
    `Overall progress at the data date of 30 September 2026 is ${progress.actualPercent}% complete against ${progress.plannedPercent.toFixed(1)}% planned in the Baseline Programme Revision 1. The critical path runs through the Zone C ground improvement, the Warehouse W3 and W4 foundations and the steel erection; it is ${progress.daysBehind} days behind the baseline.`,
    {},
    { progress: `${progress.actualPercent}% complete`, daysBehind: `${progress.daysBehind} days behind` },
  );
  pdf.bullets([
    'Ground improvement is complete in all zones except sub-zone C-2, where the final pass follows the fence relocation.',
    'Warehouse W1 steel erection is 45% complete; the W1 frames are expected to be closed by the end of November.',
    `Reinforcement deliveries for the Warehouse W2 slab started on ${longDate(day(minutes.rebarDelivery))}; the mill certificates are on file.`,
    'The storm water drainage along the eastern truck court is 30% complete and is held back by the Zone C sequence.',
  ]);

  pdf.heading('4  Quality');
  pdf.paragraph(
    'Non-conformance report NCR-023 was raised on the Warehouse W3 slab reinforcement (bars fixed at 200 mm centres instead of 150 mm). Site Instruction No. 7 of 1 October 2026 stopped the pours in W3; the rejected concrete in sub-zone C-2 was broken out on 4 October and the replacement is due by 11 October. The Engineer will re-inspect before any further pour.',
    {},
    { ncr: 'NCR-023' },
  );

  pdf.heading('5  Commercial');
  pdf.paragraph(
    `Interim Payment Certificate No. 7 was certified on ${longDate(day(input.ipcCertified))} for SAR ${formatAmount(input.ipcAmountDue)} including VAT. ${input.voApprovedCount} variation orders are approved with a net value of SAR ${formatAmount(input.voApprovedTotal)}; ${input.voPendingCount} are pending the Employer's decision. The Contractor will submit Extension of Time Claim No. 2 for the late handover of Zone C by 12 October 2026.`,
    {},
    { commercial: 'Interim Payment Certificate No. 7' },
  );

  pdf.heading('6  Safety');
  pdf.paragraph(
    `No lost-time injury was recorded in the period. Safe man-hours since the Commencement Date stand at ${minutes.safeManHours.toLocaleString('en-US')}. The heat stress procedure stays in force until 15 October.`,
    {},
    { safety: 'No lost-time injury' },
  );

  pdf.heading('7  Actions');
  pdf.table(
    [
      { header: 'No.', share: 0.06 },
      { header: 'Action', share: 0.52 },
      { header: 'Owner', share: 0.26 },
      { header: 'Due', share: 0.16 },
    ],
    minutes.actions.map((action) => [String(action.n), action.action, action.owner, longDate(day(action.due))]),
    minutes.actions.map((action) => `action:${action.n}`),
  );

  pdf.heading('8  Next meeting');
  const next = longDate(day(minutes.nextMeeting));
  pdf.paragraph(`Progress Meeting No. ${minutes.number + 1} will be held on ${next} at 10:00 in the Engineer's site office.`, {}, { nextMeeting: next });
  pdf.space(14);
  pdf.labelled([
    ['Issued by', `${parties.engineer.representative}, ${parties.engineer.name}`],
    ['Distribution', 'All attendees; project file'],
  ]);
  return pdf.finish();
}
