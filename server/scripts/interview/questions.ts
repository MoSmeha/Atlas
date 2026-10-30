import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { Answer, Usage } from '@atlas/shared';
import expected from '../../../samples/khobar-park-expected.json' with { type: 'json' };
import {
  answerText,
  type CheckResult,
  type ExpectedRow,
  formatNumber,
  hasCode,
  hasNumber,
  hasSource,
  linesNaming,
  listProblem,
  matchRows,
  mentions,
  missingCodes,
  missingDates,
  missingNumbers,
  normalizeText,
  type RunTrace,
  sameFile,
  sourceProblem,
  verdict,
} from '../eval/checks';
import type { EvalQuestion } from '../eval/questions';

/**
 * Questions an interviewer might ask of samples/khobar-park, none of them seen by the agent before, each checked
 * against samples/khobar-park-expected.json. The first three are the email's own examples, word for word.
 */

const contract = expected.contract;

function numbersProblem(answer: Answer, labelled: readonly { label: string; amount: number }[]): string[] {
  const missing = missingNumbers(
    answer,
    labelled.map((item) => item.amount),
  );
  return listProblem(
    'numbers missing',
    labelled.filter((item) => missing.includes(item.amount)).map((item) => `${item.label} ${formatNumber(item.amount)}`),
  );
}

function tableText(answer: Answer): string {
  return (answer.table?.rows ?? []).map((row) => row.join(' ')).join('\n');
}

function itemsAboveOneMillion(answer: Answer): CheckResult {
  if (answer.table === null) return { pass: false, reason: 'no table attached' };
  const rows: ExpectedRow[] = expected.boqs.itemsAbove1m.map((item) => ({ label: `${item.file} ${item.code}`, codes: [item.code], amount: item.amount, file: item.file }));
  const match = matchRows(answer.table, rows);
  const problems = [
    ...listProblem(`rows missing of ${rows.length}`, match.missing.map((row) => row.label)),
    ...listProblem('extra rows', match.extra.map((row) => row.filter((cell) => cell !== null).slice(0, 3).join(' '))),
  ];
  for (const file of expected.boqs.files) problems.push(...sourceProblem(answer, { document: file.file }));
  return verdict(problems, `all ${rows.length} rows across ${expected.boqs.files.length} BOQ files, nothing extra, the SAR 1,000,000.00 item left out`);
}

function exportTable(_answer: Answer, _usage: Usage, trace: RunTrace): CheckResult {
  const exports = trace.steps.filter((step) => step.name === 'export_table');
  const done = exports.find((step) => step.status === 'ok');
  if (done === undefined) return { pass: false, reason: exports.length === 0 ? 'export_table was not called' : `export_table failed: ${exports[0]?.error ?? 'unknown'}` };
  const file = /([^\s/\\]+\.xlsx)\b/i.exec(done.resultSummary ?? '')?.[1];
  if (file === undefined) return { pass: false, reason: `no .xlsx file in the export result (${done.resultSummary ?? 'empty'})` };
  if (!existsSync(join(trace.exportsDir, file))) return { pass: false, reason: `${file} is not in the exports folder` };
  return { pass: true, reason: `exported ${file}` };
}

const STOP_WORDS = new Set(['including', 'whole', 'works', 'level', 'three', 'other', 'their', 'under', 'within', 'through', 'systems', 'package']);

/** Each scope item's words of five letters or more that no other item uses; all its words when none are its own. */
function scopeKeywords(items: readonly string[]): string[][] {
  const words = items.map((item) => [...new Set(normalizeText(item).split(/[^\p{L}]+/u).filter((word) => word.length >= 5 && !STOP_WORDS.has(word)))]);
  return words.map((own, index) => {
    const distinct = own.filter((word) => !words.some((other, otherIndex) => otherIndex !== index && other.includes(word)));
    return distinct.length > 0 ? distinct : own;
  });
}

function scopeOfWork(answer: Answer): CheckResult {
  const items = contract.scope.items.map((item) => item.text);
  const keywords = scopeKeywords(items);
  const text = normalizeText(answerText(answer));
  const covered = keywords.filter((words) => words.some((word) => text.includes(word.slice(0, 6))));
  const needed = Math.ceil(items.length * 0.7);
  const problems = covered.length >= needed ? [] : [`mentions ${covered.length} of ${items.length} scope items, needs ${needed}`];
  problems.push(...sourceProblem(answer, { document: contract.file }));
  const note = hasSource(answer, { document: expected.subcontract.file }) ? ', the steel subcontract also cited' : '';
  return verdict(problems, `mentions ${covered.length} of ${items.length} scope items, contract cited${note}`);
}

function datesAndDeliverables(answer: Answer): CheckResult {
  const { dates } = contract;
  const keyDates = [
    { label: 'agreement', date: dates.agreement.date },
    { label: 'commencement', date: dates.commencement.date },
    { label: 'completion', date: dates.completion.date },
  ];
  const missingKey = missingDates(
    answer,
    keyDates.map((item) => item.date),
  );
  const problems = listProblem('key dates missing', keyDates.filter((item) => missingKey.includes(item.date)).map((item) => `${item.label} ${item.date}`));
  const deliverableDates = [...new Set(contract.deliverables.flatMap((item) => (item.date === null ? [] : [item.date])))];
  const missing = missingDates(answer, deliverableDates);
  const found = deliverableDates.length - missing.length;
  if (found < Math.ceil(deliverableDates.length * 0.7)) problems.push(`${found} of ${deliverableDates.length} deliverable dates (missing ${missing.join(', ')})`);
  problems.push(...sourceProblem(answer, { document: contract.file }));
  return verdict(problems, `key dates and ${found} of ${deliverableDates.length} deliverable dates present, contract cited`);
}

function contractValue(answer: Answer): CheckResult {
  const problems = numbersProblem(answer, [{ label: 'contract price', amount: contract.price.amount }]);
  if (!mentions(answer, 'vat') && !mentions(answer, 'value added tax')) problems.push('does not say whether VAT is included');
  if (!/exclud|not includ|without|plus vat|in addition|على|لا يشمل|غير شامل/i.test(answer.markdown)) problems.push('does not say the price excludes VAT');
  const cited = [contract.price.page, contract.price.coverPage].some((page) => hasSource(answer, { document: contract.file, page }));
  if (!cited) problems.push(...sourceProblem(answer, { document: contract.file, page: contract.price.page }));
  return verdict(problems, `${contract.price.text} excluding VAT, page ${contract.price.page} cited`);
}

function boqVsContract(answer: Answer): CheckResult {
  const totals = expected.boqs.files.map((file) => ({ label: file.file, amount: file.total }));
  const problems = numbersProblem(answer, [...totals, { label: 'contract price', amount: contract.price.amount }]);
  for (const file of expected.boqs.files) problems.push(...sourceProblem(answer, { document: file.file }));
  problems.push(...sourceProblem(answer, { document: contract.file }));
  const difference = hasNumber(answer, expected.boqs.differenceToContractPrice) || hasNumber(answer, expected.boqs.sum);
  if (!difference) problems.push(`neither the BOQ sum ${formatNumber(expected.boqs.sum)} nor the difference ${formatNumber(expected.boqs.differenceToContractPrice)} is given`);
  return verdict(problems, `all ${totals.length} BOQ totals, the contract price and the provisional-sums difference given, every file cited`);
}

function variationsApproved(answer: Answer): CheckResult {
  const { variations } = expected;
  const problems = numbersProblem(answer, [{ label: 'approved total', amount: variations.approvedTotal }]);
  problems.push(...listProblem('pending VOs missing', missingCodes(answer, variations.pending.map((item) => item.id))));
  const text = answerText(answer);
  const wrong = variations.rejected.filter((item) => hasCode(text, item.id) && !/reject/i.test(text));
  problems.push(...listProblem('rejected VOs named without saying so', wrong.map((item) => item.id)));
  problems.push(...sourceProblem(answer, { document: variations.file }));
  return verdict(problems, `approved total ${formatNumber(variations.approvedTotal)} and all ${variations.pending.length} pending VOs named`);
}

function ipcLatest(answer: Answer): CheckResult {
  const { ipc } = expected;
  const problems = numbersProblem(answer, [{ label: 'amount due', amount: ipc.amountDue }]);
  if (missingDates(answer, [ipc.dueDate]).length > 0) problems.push(`due date ${ipc.dueDate} not given`);
  problems.push(...sourceProblem(answer, { document: ipc.file }));
  return verdict(problems, `SAR ${formatNumber(ipc.amountDue)} due by ${ipc.dueDate}, certificate cited`);
}

function risksHigh(answer: Answer): CheckResult {
  const { risks } = expected;
  const problems = listProblem('high risks missing', missingCodes(answer, risks.high.map((item) => item.id)));
  const rows = tableText(answer);
  if (rows !== '') problems.push(...listProblem('risks listed that are not High', risks.otherIds.filter((id) => hasCode(rows, id))));
  const ownerless = risks.high.filter((item) => !mentions(answer, item.owner.split(',')[0] ?? item.owner));
  problems.push(...listProblem('owners missing', ownerless.map((item) => `${item.id} ${item.owner}`)));
  problems.push(...sourceProblem(answer, { document: risks.file }));
  return verdict(problems, `all ${risks.high.length} high risks with their owners, nothing else listed`);
}

function scheduleLate(answer: Answer): CheckResult {
  const { schedule } = expected;
  const problems = listProblem('late activities missing', missingCodes(answer, schedule.lateActivities.map((item) => item.id)));
  const rows = tableText(answer);
  if (rows !== '') problems.push(...listProblem('on-time activities listed', schedule.onTimeIds.filter((id) => hasCode(rows, id))));
  problems.push(...sourceProblem(answer, { document: schedule.file }));
  return verdict(problems, schedule.lateActivities.map((item) => `${item.id} (${item.daysLate} days late)`).join(', '));
}

function eotClaim(answer: Answer): CheckResult {
  const { eot } = expected;
  const problems = numbersProblem(answer, [{ label: 'days claimed', amount: eot.days }]);
  if (!mentions(answer, eot.zone)) problems.push(`${eot.zone} not named as the cause`);
  problems.push(...sourceProblem(answer, { document: eot.file }));
  const revised = missingDates(answer, [eot.revisedCompletion]).length === 0 ? ', revised completion date given' : '';
  return verdict(problems, `${eot.days} days for the late handover of ${eot.zone}, letter cited${revised}`);
}

function meetingProgress(answer: Answer): CheckResult {
  const { progress } = expected.minutes;
  const problems = numbersProblem(answer, [
    { label: 'actual %', amount: progress.actualPercent },
    { label: 'planned %', amount: progress.plannedPercent },
    { label: 'days behind', amount: progress.daysBehind },
  ]);
  problems.push(...sourceProblem(answer, { document: expected.minutes.file }));
  return verdict(problems, `${progress.actualPercent}% against ${progress.plannedPercent}% planned, ${progress.daysBehind} days behind, minutes cited`);
}

function meetingActions(answer: Answer): CheckResult {
  const { actions, file } = expected.minutes;
  const dates = actions.map((action) => action.due);
  const missing = missingDates(answer, dates);
  const found = dates.length - missing.length;
  const problems = found >= Math.ceil(dates.length * 0.8) ? [] : [`${found} of ${dates.length} due dates (missing ${missing.join(', ')})`];
  const owners = ['Planning Engineer', 'Project Manager', 'Development Director', 'Resident Engineer', 'Structural Inspector', 'General Manager'];
  const namedOwners = owners.filter((owner) => mentions(answer, owner));
  if (namedOwners.length < 5) problems.push(`only ${namedOwners.length} of 6 owners named`);
  problems.push(...sourceProblem(answer, { document: file }));
  return verdict(problems, `${found} of ${dates.length} due dates and ${namedOwners.length} of 6 owners, minutes cited`);
}

type SpecFact = (typeof expected.specification.facts)[number];

function specFact(key: string): SpecFact {
  const fact = expected.specification.facts.find((candidate) => candidate.key === key);
  if (fact === undefined) throw new Error(`No specification fact ${key}`);
  return fact;
}

/** The fact's value with a source on its own page, not a nearby or decoy page. */
function specCheck(fact: SpecFact, found: (answer: Answer) => boolean): (answer: Answer) => CheckResult {
  return (answer) => {
    const problems = found(answer) ? [] : [`"${fact.answer}" not in the answer`];
    if (!hasSource(answer, { document: expected.specification.file, page: fact.page })) {
      const pages = answer.sources.flatMap((source) => (source.kind === 'pdf' && sameFile(source.document, expected.specification.file) ? [source.page] : []));
      problems.push(`page ${fact.page} not cited${pages.length > 0 ? ` (cited page ${pages.join(', ')})` : ''}`);
    }
    return verdict(problems, `"${fact.answer}" with page ${fact.page}`);
  };
}

const floorSlab = specFact('floorSlab');
const designLife = specFact('designLife');

function quotationsTotal(answer: Answer): CheckResult {
  const totals = expected.quotations.totalsByCurrency;
  const problems = numbersProblem(
    answer,
    totals.map((total) => ({ label: total.currency, amount: total.amount })),
  );
  for (let mask = 3; mask < 1 << totals.length; mask++) {
    const picked = totals.filter((_, index) => mask & (1 << index));
    if (picked.length < 2) continue;
    const sum = picked.reduce((total, item) => total + item.amount, 0);
    if (hasNumber(answer, sum)) problems.push(`adds ${picked.map((item) => item.currency).join(' + ')} together (${formatNumber(sum)})`);
  }
  problems.push(...sourceProblem(answer, { document: expected.quotations.file }));
  return verdict(problems, `one total per currency (${totals.map((total) => total.currency).join(', ')}), never summed`);
}

function deliveryNoteRead(answer: Answer, _usage: Usage, trace: RunTrace): CheckResult {
  const { deliveryNote } = expected;
  const problems = numbersProblem(answer, [{ label: 'tonnes', amount: deliveryNote.item.tonnes }]);
  if (!mentions(answer, 'B500B') && !mentions(answer, '16 mm') && !mentions(answer, '16mm')) problems.push('the bars (16 mm B500B) are not named');
  problems.push(...sourceProblem(answer, { document: deliveryNote.file, page: 1 }));
  if (!trace.steps.some((step) => step.name === 'look_at_page' && step.status === 'ok')) problems.push('never looked at the page (look_at_page)');
  return verdict(problems, `"${deliveryNote.visionFact}" read from the scanned page`);
}

function siteInstructionInArabic(answer: Answer): CheckResult {
  const { siteInstruction } = expected;
  const problems: string[] = [];
  if (answer.language !== 'ar') problems.push(`answer language is ${answer.language}`);
  const arabicLetters = answer.markdown.match(/[ء-ي]/g)?.length ?? 0;
  const latinLetters = answer.markdown.replace(/\S+\.(?:pdf|xlsx)\b/gi, '').match(/[A-Za-z]/g)?.length ?? 0;
  if (arabicLetters <= latinLetters) problems.push('markdown is not mostly Arabic');
  if (!mentions(answer, siteInstruction.warehouse)) problems.push(`warehouse ${siteInstruction.warehouse} not named`);
  problems.push(...numbersProblem(answer, [{ label: 'm3 to replace', amount: siteInstruction.volumeM3 }]));
  // "within 10 days" or the deadline date it works out to: either tells the contractor when.
  if (!hasNumber(answer, siteInstruction.days) && missingDates(answer, [siteInstruction.deadline]).length > 0) {
    problems.push(`neither ${siteInstruction.days} days nor the deadline ${siteInstruction.deadline} is given`);
  }
  problems.push(...sourceProblem(answer, { document: siteInstruction.file }));
  return verdict(problems, `Arabic answer: stop pours in ${siteInstruction.warehouse}, replace ${siteInstruction.volumeM3} m3, deadline given, instruction cited`);
}

function labourOvertime(answer: Answer, _usage: Usage, trace: RunTrace): CheckResult {
  const { labour } = expected;
  const problems = numbersProblem(answer, [
    { label: `entries over ${labour.month.threshold} h`, amount: labour.month.entriesOverThreshold },
    { label: `${labour.month.zone} overtime`, amount: labour.month.zoneOvertimeTotal },
  ]);
  if (!trace.steps.some((step) => step.name === 'query_tables' && step.status === 'ok')) problems.push('no SQL query ran (query_tables)');
  problems.push(...sourceProblem(answer, { document: labour.file }));
  return verdict(problems, `${labour.month.entriesOverThreshold} entries and ${labour.month.zoneOvertimeTotal} h from SQL over ${formatNumber(labour.rows)} rows`);
}

function liquidatedDamages(answer: Answer): CheckResult {
  const problems = numbersProblem(answer, [
    { label: 'main contract per day', amount: contract.liquidatedDamages.perDay },
    { label: 'subcontract per day', amount: expected.subcontract.liquidatedDamages.perDay },
  ]);
  problems.push(...sourceProblem(answer, { document: contract.file }));
  problems.push(...sourceProblem(answer, { document: expected.subcontract.file }));
  return verdict(problems, `SAR ${formatNumber(contract.liquidatedDamages.perDay)} and SAR ${formatNumber(expected.subcontract.liquidatedDamages.perDay)} per day, both documents cited`);
}

function subcontractFacts(answer: Answer): CheckResult {
  const { subcontract } = expected;
  const problems = numbersProblem(answer, [{ label: 'subcontract price', amount: subcontract.price.amount }]);
  if (missingDates(answer, [subcontract.allErectionComplete.date]).length > 0) problems.push(`erection completion ${subcontract.allErectionComplete.date} not given`);
  problems.push(...sourceProblem(answer, { document: subcontract.file }));
  return verdict(problems, `${subcontract.price.text}, erection complete by ${subcontract.allErectionComplete.date}, subcontract cited`);
}

const REASON_WORDS: Record<string, RegExp> = {
  corrupt: /corrupt|damaged|broken|truncated|could not be opened|cannot be opened|invalid|unreadable|not a valid/i,
  encrypted: /password|encrypt|protected|locked/i,
  empty: /empty|0 bytes?|0-byte|zero bytes|no data|no content|blank|nothing/i,
  skipped: /csv|not (?:read|supported)|skipped|unsupported|only pdf|only excel|not a pdf/i,
};

function unreadableFiles(answer: Answer): CheckResult {
  const files = Object.entries(expected.filesStatus).filter(([, file]) => file.status in REASON_WORDS);
  const problems: string[] = [];
  for (const [name, file] of files) {
    const lines = linesNaming(answer, name);
    if (lines.length === 0) problems.push(`${name} not named`);
    else if (!lines.some((line) => REASON_WORDS[file.status]!.test(line))) problems.push(`${name} named without saying it is ${file.status}`);
  }
  return verdict(problems, `all ${files.length} files named with the right reason`);
}

function notInDocuments(answer: Answer): CheckResult {
  return answer.kind === 'not_found' ? { pass: true, reason: 'not_found' } : { pass: false, reason: `kind ${answer.kind}: ${answer.markdown.slice(0, 80)}` };
}

export const questions: EvalQuestion[] = [
  { id: 'items-above-1m', session: 'boq', question: 'List all cost items above SAR 1 million in these BOQs.', check: itemsAboveOneMillion },
  { id: 'export-items', session: 'boq', after: ['items-above-1m'], question: 'Export that list to Excel.', check: exportTable },
  { id: 'scope-of-work', question: 'Summarize the scope of work in this contract.', check: scopeOfWork },
  { id: 'dates-deliverables', question: 'Extract all dates and deliverables from these documents.', check: datesAndDeliverables },
  { id: 'contract-value', question: 'What is the contract price, and does it include VAT?', check: contractValue },
  { id: 'boq-vs-contract', question: 'Do the BOQ totals add up to the contract price? Show the total of each BOQ.', check: boqVsContract },
  { id: 'vo-approved', question: 'What is the total value of the approved variation orders, and which ones are still pending?', check: variationsApproved },
  { id: 'ipc-latest', question: 'How much is due under the latest payment certificate, and by when must it be paid?', check: ipcLatest },
  { id: 'risks-high', question: 'Which risks are rated High, and who owns each one?', check: risksHigh },
  { id: 'schedule-late', question: 'Which activities in the schedule finish after the contract completion date?', check: scheduleLate },
  { id: 'eot-claim', question: 'How many days of extension of time has the contractor claimed, and on what grounds?', check: eotClaim },
  { id: 'meeting-progress', question: 'What progress was reported at the last progress meeting, compared with the plan?', check: meetingProgress },
  { id: 'meeting-actions', question: 'List the actions from the last progress meeting with their owners and due dates.', check: meetingActions },
  { id: 'spec-floor-slab', question: floorSlab.question, check: specCheck(floorSlab, (answer) => mentions(answer, 'C35/45') && hasNumber(answer, 200)) },
  { id: 'spec-design-life', question: designLife.question, check: specCheck(designLife, (answer) => hasNumber(answer, 50)) },
  { id: 'quotations-total', question: 'What is the total value of the supplier quotations?', check: quotationsTotal },
  { id: 'delivery-note', question: expected.deliveryNote.question, check: deliveryNoteRead },
  { id: 'site-instruction-ar', question: expected.siteInstruction.questions.ar, check: siteInstructionInArabic },
  { id: 'labour-overtime', question: expected.labour.question, check: labourOvertime },
  { id: 'ld-compare', question: 'What are the liquidated damages in the main contract and in the steel subcontract?', check: liquidatedDamages },
  {
    id: 'subcontract',
    question: 'How much is the steel subcontract worth, and when must erection of all four warehouses be complete?',
    check: subcontractFacts,
  },
  { id: 'unreadable-files', question: 'Which files could not be read, and why?', check: unreadableFiles },
  { id: 'not-in-documents', question: expected.notFound.question, check: notInDocuments },
];
