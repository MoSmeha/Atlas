/**
 * Generates samples/khobar-park, the interview rehearsal folder (20 files, two of them in a subfolder), and
 * samples/khobar-park-expected.json, its ground truth. Run with `pnpm interview:samples`; the Arabic site
 * instruction needs Microsoft Edge. Every document is fictional.
 */
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { addDays, day, isoDate } from '../samples/lib/dates';
import { formatAmount } from '../samples/lib/money';
import type { WrittenPdf } from '../samples/lib/PdfWriter';
import { boqFiles, buildBoqs } from './boqs';
import { brokenFiles, buildCorruptWorkbook, buildCsv, buildEncryptedPdf } from './broken';
import { buildContract } from './contractPdf';
import { buildDeliveryNote, deliveryNote } from './deliveryNote';
import { buildEotLetter, eotLetter } from './eotLetter';
import { buildIpc, ipc } from './ipcPdf';
import { labour, writeLabour } from './labour';
import { buildMinutes, minutes } from './minutesPdf';
import { contract, CORRESPONDENCE_FOLDER, dueDate, dueText, EXPECTED_FILE, OUT_FOLDER, parties, project } from './project';
import { quotations, quotationTotals, writeQuotations } from './quotations';
import { highRisks, risks, writeRisks } from './risks';
import { lateActivities, schedule, writeSchedule } from './schedule';
import { buildSiteInstruction, siteInstruction } from './siteInstructionAr';
import { buildSpecification, specDecoys, specFacts, specification } from './specPdf';
import { buildSubcontract, subcontract } from './subcontractPdf';
import { variations, variationSummary, writeVariations } from './variations';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const folder = join(root, OUT_FOLDER);
const inCorrespondence = (name: string) => `${CORRESPONDENCE_FOLDER}/${name}`;

function page(pdf: WrittenPdf, key: string): number {
  const found = pdf.pages[key];
  if (found === undefined) throw new Error(`No page recorded for mark ${key}`);
  return found;
}

const completion = isoDate(addDays(day(contract.commencement), contract.timeForCompletionDays));
if (completion !== contract.completion) throw new Error(`Commencement plus ${contract.timeForCompletionDays} days is ${completion}, not ${contract.completion}`);
const revised = isoDate(addDays(day(contract.completion), eotLetter.days));
if (revised !== eotLetter.revisedCompletion) throw new Error(`Completion plus ${eotLetter.days} days is ${revised}, not ${eotLetter.revisedCompletion}`);
const access = Math.round((day(eotLetter.actualAccess).getTime() - day(eotLetter.plannedAccess).getTime()) / 86_400_000);
if (access !== eotLetter.days) throw new Error(`Zone C access was ${access} days late, not ${eotLetter.days}`);

console.log('Building the BOQs...');
const boqs = await buildBoqs();
const priceSchedule = [
  ...boqs.fileTotals.map((entry) => ({ label: entry.label, amount: entry.total })),
  { label: 'Provisional Sums and Dayworks', amount: contract.provisionalSums },
];
console.log(`Contract Price SAR ${formatAmount(boqs.contractPrice)} (BOQs SAR ${formatAmount(boqs.boqSum)} + provisional sums)`);
const contractPdf = await buildContract(priceSchedule, boqs.contractPrice);
const subcontractPdf = await buildSubcontract();
const { pdf: ipcPdf, figures: ipcFigures } = await buildIpc(boqs.contractPrice);
const quotes = await writeQuotations();
const vos = await writeVariations();
const voSummary = variationSummary();
const sched = await writeSchedule();
const riskBook = await writeRisks();
const minutesPdf = await buildMinutes({
  voApprovedTotal: voSummary.approvedTotal,
  voApprovedCount: voSummary.approved.length,
  voPendingCount: voSummary.pending.length,
  ipcAmountDue: ipcFigures.amountDue,
  ipcCertified: ipc.certifiedDate,
});
console.log('Building the specification...');
const spec = await buildSpecification();
const eot = await buildEotLetter();
console.log('Rendering the Arabic site instruction with Edge...');
const si = await buildSiteInstruction();
const dn = await buildDeliveryNote();
console.log('Writing the labour returns...');
const lab = await writeLabour();
const corrupt = await buildCorruptWorkbook();
const encrypted = await buildEncryptedPdf();

const files: [string, Uint8Array][] = [
  [contract.fileName, contractPdf.bytes],
  ...boqs.files,
  [subcontract.fileName, subcontractPdf.bytes],
  [ipc.fileName, ipcPdf.bytes],
  [quotations.fileName, quotes.bytes],
  [variations.fileName, vos.bytes],
  [schedule.fileName, sched.bytes],
  [risks.fileName, riskBook.bytes],
  [minutes.fileName, minutesPdf.bytes],
  [specification.fileName, spec.bytes],
  [inCorrespondence(eotLetter.fileName), eot.bytes],
  [inCorrespondence(siteInstruction.fileName), si],
  [deliveryNote.fileName, dn],
  [labour.fileName, lab.bytes],
  [brokenFiles.corrupt.fileName, corrupt],
  [brokenFiles.encrypted.fileName, encrypted],
  [brokenFiles.empty.fileName, new Uint8Array(0)],
  [brokenFiles.csv.fileName, buildCsv()],
];
if (files.length !== 20) throw new Error(`${files.length} files, not 20`);

await rm(folder, { recursive: true, force: true });
await mkdir(folder, { recursive: true });
for (const [name, bytes] of files) {
  const path = join(folder, ...name.split('/'));
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, bytes);
  console.log(`wrote ${OUT_FOLDER}/${name} (${bytes.length.toLocaleString('en-US')} bytes)`);
}

const lastErection = subcontract.erection.at(-1)!;
const highs = highRisks(riskBook.rows);
const late = lateActivities(sched.rows);
const expected = {
  about:
    'Ground truth for the interview rehearsal folder samples/khobar-park. Generated by server/scripts/interview; do not edit by hand. Excel rows are 1-based as Excel shows them; PDF pages are 1-based.',
  folder: OUT_FOLDER,
  project: {
    name: project.name,
    location: project.location,
    employer: parties.employer.name,
    contractor: parties.contractor.name,
    engineer: parties.engineer.name,
    steelSubcontractor: parties.steel.name,
  },
  filesStatus: {
    [contract.fileName]: { kind: 'pdf', status: 'ok', pages: contractPdf.pageCount },
    [boqFiles.civil.fileName]: { kind: 'excel', status: 'ok', sheets: [boqFiles.civil.sheet] },
    [boqFiles.mep.fileName]: { kind: 'excel', status: 'ok', sheets: Object.values(boqFiles.mep.sheets) },
    [boqFiles.external.fileName]: { kind: 'pdf', status: 'ok', pages: boqs.externalPages },
    [subcontract.fileName]: { kind: 'pdf', status: 'ok', pages: subcontractPdf.pageCount },
    [ipc.fileName]: { kind: 'pdf', status: 'ok', pages: ipcPdf.pageCount },
    [quotations.fileName]: { kind: 'excel', status: 'ok', sheets: [quotations.sheet] },
    [variations.fileName]: { kind: 'excel', status: 'ok', sheets: [variations.sheet] },
    [schedule.fileName]: { kind: 'excel', status: 'ok', sheets: [schedule.sheet] },
    [risks.fileName]: { kind: 'excel', status: 'ok', sheets: [risks.sheet] },
    [minutes.fileName]: { kind: 'pdf', status: 'ok', pages: minutesPdf.pageCount },
    [specification.fileName]: { kind: 'pdf', status: 'ok', pages: spec.pageCount },
    [inCorrespondence(eotLetter.fileName)]: { kind: 'pdf', status: 'ok', pages: eot.pageCount },
    [inCorrespondence(siteInstruction.fileName)]: { kind: 'pdf', status: 'ok', pages: siteInstruction.pages, language: 'ar' },
    [deliveryNote.fileName]: {
      kind: 'pdf',
      status: 'scanned',
      pages: 1,
      scannedPages: [1],
      reason: 'One page that is only an image, with no text layer; it can be read only by looking at the page.',
    },
    [labour.fileName]: { kind: 'excel', status: 'ok', sheets: [labour.sheet], dataRows: lab.facts.rows },
    [brokenFiles.corrupt.fileName]: { kind: 'excel', status: 'corrupt', reason: brokenFiles.corrupt.reason },
    [brokenFiles.encrypted.fileName]: { kind: 'pdf', status: 'encrypted', reason: brokenFiles.encrypted.reason },
    [brokenFiles.empty.fileName]: { kind: 'pdf', status: 'empty', reason: brokenFiles.empty.reason },
    [brokenFiles.csv.fileName]: { kind: 'other', status: 'skipped', reason: brokenFiles.csv.reason },
  },
  contract: {
    file: contract.fileName,
    number: contract.number,
    price: { amount: boqs.contractPrice, text: `SAR ${formatAmount(boqs.contractPrice)}`, page: page(contractPdf, 'price'), coverPage: page(contractPdf, 'cover') },
    excludesVat: true,
    vatPercent: contract.vatPercent,
    priceSchedule: priceSchedule.map((line, index) => ({ ...line, page: page(contractPdf, `schedule:${index}`) })),
    provisionalSums: { amount: contract.provisionalSums, page: page(contractPdf, 'provisional') },
    dates: {
      letterOfAcceptance: { date: contract.letterOfAcceptance, page: page(contractPdf, 'letterOfAcceptance') },
      agreement: { date: contract.agreementDate, page: page(contractPdf, 'parties') },
      commencement: { date: contract.commencement, page: page(contractPdf, 'commencement') },
      completion: { date: contract.completion, page: page(contractPdf, 'completion') },
      timeForCompletionDays: contract.timeForCompletionDays,
      defectsNotificationDays: contract.defectsNotificationDays,
    },
    liquidatedDamages: { ...contract.liquidatedDamages, page: page(contractPdf, 'ld') },
    retention: { ...contract.retention, page: page(contractPdf, 'retention') },
    advancePayment: { ...contract.advancePayment, page: page(contractPdf, 'advance') },
    payment: { ...contract.payment, page: page(contractPdf, 'payment') },
    performanceSecurityPercent: contract.performanceSecurityPercent,
    scope: { page: page(contractPdf, 'scope'), items: contract.scope.map((text, index) => ({ text, page: page(contractPdf, `scope:${index + 1}`) })) },
    exclusions: { page: page(contractPdf, 'exclusions'), items: contract.exclusions },
    milestones: contract.milestones.map((milestone) => ({
      id: milestone.id,
      title: milestone.title,
      due: dueText(milestone.due),
      date: dueDate(milestone.due),
      page: page(contractPdf, `milestone:${milestone.id}`),
    })),
    deliverables: contract.deliverables.map((deliverable) => ({
      id: deliverable.id,
      name: deliverable.name,
      due: dueText(deliverable.due),
      date: dueDate(deliverable.due),
      page: page(contractPdf, `deliverable:${deliverable.id}`),
    })),
  },
  boqs: {
    files: boqs.fileTotals,
    totals: boqs.totals,
    sum: boqs.boqSum,
    contractPrice: boqs.contractPrice,
    differenceToContractPrice: contract.provisionalSums,
    itemCount: boqs.items.length,
    itemsAbove1m: boqs.items.filter((item) => item.amount > 1_000_000),
    atThreshold: boqFiles.atThreshold,
  },
  subcontract: {
    file: subcontract.fileName,
    number: subcontract.number,
    date: subcontract.date,
    price: { amount: subcontract.price, text: `SAR ${formatAmount(subcontract.price)}`, page: page(subcontractPdf, 'price') },
    tonnes: subcontract.tonnes,
    commencement: { date: subcontract.commencement, page: page(subcontractPdf, 'commencement') },
    erection: subcontract.erection.map((entry) => ({ ...entry, page: page(subcontractPdf, `erection:${entry.warehouse}`) })),
    allErectionComplete: { date: lastErection.date, page: page(subcontractPdf, 'allErection') },
    liquidatedDamages: { ...subcontract.liquidatedDamages, page: page(subcontractPdf, 'ld') },
    retentionPercent: subcontract.retentionPercent,
    paymentDays: subcontract.paymentDays,
    scope: { page: page(subcontractPdf, 'scope'), items: subcontract.scope },
  },
  ipc: {
    file: ipc.fileName,
    number: ipc.number,
    periodEnd: ipc.periodEnd,
    certifiedDate: ipc.certifiedDate,
    cumulativeWorkDone: ipc.cumulativeWorkDone,
    previousCumulative: ipc.previousCumulative,
    ...ipcFigures,
    pages: { amountDue: page(ipcPdf, 'amountDue'), dueDate: page(ipcPdf, 'dueDate'), thisPeriod: page(ipcPdf, 'thisPeriod') },
  },
  quotations: {
    file: quotations.fileName,
    sheet: quotations.sheet,
    rows: quotes.rows,
    totalsByCurrency: quotationTotals(),
    items: quotations.items.map((item, index) => ({ ...item, row: quotes.rows.firstRow + index })),
  },
  variations: {
    file: variations.fileName,
    sheet: variations.sheet,
    rows: vos.layout.rows,
    summaryRows: vos.layout.summaryRows,
    approvedTotal: voSummary.approvedTotal,
    pendingTotal: voSummary.pendingTotal,
    rejectedTotal: voSummary.rejectedTotal,
    approved: voSummary.approved.map((item) => ({ id: item.id, amount: item.amount, row: vos.layout.rows.firstRow + variations.items.indexOf(item) })),
    pending: voSummary.pending.map((item) => ({ id: item.id, amount: item.amount, row: vos.layout.rows.firstRow + variations.items.indexOf(item) })),
    rejected: voSummary.rejected.map((item) => ({ id: item.id, amount: item.amount, row: vos.layout.rows.firstRow + variations.items.indexOf(item) })),
  },
  schedule: {
    file: schedule.fileName,
    sheet: schedule.sheet,
    dataDate: schedule.dataDate,
    contractCompletion: contract.completion,
    rows: sched.rows,
    activityCount: schedule.activities.length,
    lateActivities: late,
    onTimeIds: schedule.activities.filter((activity) => !late.some((entry) => entry.id === activity.id)).map((activity) => activity.id),
  },
  risks: {
    file: risks.fileName,
    sheet: risks.sheet,
    rows: riskBook.rows,
    high: highs,
    otherIds: risks.items.filter((item) => !highs.some((entry) => entry.id === item.id)).map((item) => item.id),
  },
  minutes: {
    file: minutes.fileName,
    number: minutes.number,
    date: minutes.date,
    progress: { ...minutes.progress, page: page(minutesPdf, 'progress') },
    actions: minutes.actions.map((action) => ({ ...action, page: page(minutesPdf, `action:${action.n}`) })),
    nextMeeting: { date: minutes.nextMeeting, page: page(minutesPdf, 'nextMeeting') },
    ncr: { id: siteInstruction.ncr, page: page(minutesPdf, 'ncr') },
    attendees: minutes.attendees,
  },
  specification: {
    file: specification.fileName,
    pages: spec.pageCount,
    facts: specFacts.map((fact) => ({ key: fact.key, section: fact.section, question: fact.question, answer: fact.answer, quote: fact.quote, page: page(spec, fact.key) })),
    decoys: specDecoys.map((decoy) => ({ key: decoy.key, section: decoy.section, quote: decoy.quote, page: page(spec, decoy.key) })),
  },
  eot: {
    file: inCorrespondence(eotLetter.fileName),
    reference: eotLetter.reference,
    date: eotLetter.date,
    claimNumber: eotLetter.claimNumber,
    days: eotLetter.days,
    zone: eotLetter.zone,
    plannedAccess: eotLetter.plannedAccess,
    actualAccess: eotLetter.actualAccess,
    revisedCompletion: eotLetter.revisedCompletion,
    prolongationCost: eotLetter.prolongationCost,
    prolongationVo: eotLetter.prolongationVo,
    claimOne: eotLetter.claimOne,
    pages: { days: page(eot, 'days'), cause: page(eot, 'cause'), revisedCompletion: page(eot, 'revisedCompletion'), cost: page(eot, 'cost') },
  },
  siteInstruction: {
    file: inCorrespondence(siteInstruction.fileName),
    number: siteInstruction.number,
    date: siteInstruction.date,
    deadline: siteInstruction.deadline,
    warehouse: siteInstruction.warehouse,
    subZone: siteInstruction.subZone,
    ncr: siteInstruction.ncr,
    drawing: siteInstruction.drawing,
    volumeM3: siteInstruction.volumeM3,
    days: siteInstruction.days,
    spacingRequiredMm: siteInstruction.spacingRequiredMm,
    spacingFoundMm: siteInstruction.spacingFoundMm,
    phrases: siteInstruction.phrases,
    questions: siteInstruction.questions,
  },
  deliveryNote: {
    file: deliveryNote.fileName,
    number: deliveryNote.number,
    date: deliveryNote.date,
    supplier: deliveryNote.supplier,
    item: deliveryNote.item,
    visionFact: deliveryNote.visionFact,
    question: `What was delivered under delivery note ${deliveryNote.number}, and how much?`,
  },
  labour: {
    file: labour.fileName,
    sheet: labour.sheet,
    ...lab.facts,
    question: `In the labour returns, how many entries in September 2026 have more than ${labour.overtimeThreshold} overtime hours, and what is the total of overtime hours booked to Warehouse ${labour.questionZone} that month?`,
  },
  notFound: {
    question: "Who is the project's health and safety manager?",
    note: 'No document names a health and safety manager; the HSE Plan is a deliverable without a named person.',
  },
};

await writeFile(join(root, EXPECTED_FILE), `${JSON.stringify(expected, null, 2)}\n`);
console.log(
  `wrote ${EXPECTED_FILE}: ${files.length} files, ${expected.boqs.itemsAbove1m.length} BOQ items above SAR 1M of ${expected.boqs.itemCount}, ` +
    `specification ${spec.pageCount} pages, labour ${lab.facts.rows.toLocaleString('en-US')} rows ` +
    `(September: ${lab.facts.month.entriesOverThreshold} entries over ${lab.facts.month.threshold} h, W2 overtime ${lab.facts.month.zoneOvertimeTotal} h), ` +
    `${late.length} late activities, ${highs.length} high risks`,
);
