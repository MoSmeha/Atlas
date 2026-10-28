import { boqPhase2 } from './boqPhase2Facade';
import type { GeneratedPdf } from './contractMainWorks';
import type { LedgerLayout } from './costLedger';
import { totalLabel, type EquipmentLayout } from './equipmentImports';
import type { BoqLayout } from './lib/boqLayout';
import { day } from './lib/dates';
import { dueDate } from './lib/due';
import { formatAmount, sumAmounts } from './lib/money';
import { TOTAL_TEXT } from './lib/pdfBoqLayout';
import type { GeneratedPdfBoq } from './lib/pdfBoqWriter';
import { excelRows, pdfPage } from './lib/sources';
import { durationDays, programme, type ProgrammeLayout } from './programmeMilestones';
import { contract } from './project';
import { provisionalSums, type ProvisionalSumsLayout } from './provisionalSums';

/** The "above SAR 1M" threshold. Rows exactly at it are not above it. */
export const THRESHOLD = 1_000_000;
const ARABIC = /\p{Script=Arabic}/u;

function totalsByCurrency(amounts: readonly { currency: string; amount: number }[]) {
  const currencies = [...new Set(amounts.map((entry) => entry.currency))];
  return currencies.map((currency) => ({
    currency,
    amount: sumAmounts(amounts.filter((entry) => entry.currency === currency).map((entry) => entry.amount)),
  }));
}

function daysBetween(from: string, to: string): number {
  return Math.round((day(to).getTime() - day(from).getTime()) / 86_400_000);
}

/** BOQ_Phase2_Facade.pdf: every item with its page, the page carries and the total. Quotes are amounts as printed. */
export function phase2BoqFacts(pdf: GeneratedPdfBoq) {
  const { layout, fileName } = pdf;
  const currency = boqPhase2.currency;
  const at = (page: number, amount: number) => pdfPage(fileName, page, formatAmount(amount));
  const items = layout.items.map((placed) => ({
    page: placed.page,
    item: placed.item.code,
    section: placed.section.code,
    description: placed.item.description,
    unit: placed.item.unit,
    quantity: placed.item.quantity,
    rate: placed.item.rate,
    amount: placed.amount,
    descriptionLines: placed.descriptionLines,
  }));
  const listed = (item: (typeof items)[number]) => ({
    file: fileName,
    page: item.page,
    item: item.item,
    description: item.description,
    amount: item.amount,
    currency,
    source: at(item.page, item.amount),
  });
  return {
    file: fileName,
    pages: pdf.pageCount,
    currency,
    basis:
      'Sum of the Amount column over item rows only; section headings, "Carried forward", "Brought forward" and the total line are excluded.',
    itemRows: items.length,
    totals: [{ currency, amount: sumAmounts(items.map((item) => item.amount)) }],
    statedTotal: { currency, amount: layout.total.amount, label: TOTAL_TEXT, source: at(layout.total.page, layout.total.amount) },
    headerRepeatedOnPages: Array.from({ length: pdf.pageCount }, (_, i) => i + 1),
    carriedForward: layout.carriedForward.map(({ page, amount }) => ({ page, amount, source: at(page, amount) })),
    broughtForward: layout.broughtForward.map(({ page, amount }) => ({ page, amount, source: at(page, amount) })),
    multiLineItems: items.filter((item) => item.descriptionLines > 1).map((item) => item.item),
    rowsAboveSar1m: items.filter((item) => item.amount > THRESHOLD).map(listed),
    rowsAtExactlySar1m: items.filter((item) => item.amount === THRESHOLD).map(listed),
    items,
  };
}

/** Equipment_Imports.xlsx: one total per table and per currency, never a mixed total. */
export function equipmentFacts(layout: EquipmentLayout) {
  const file = layout.fileName;
  const tables = layout.tables.map(({ table, rows, items, total }) => ({
    table: table.title.split(' - ')[0],
    title: table.title,
    sheet: table.sheet,
    currency: table.currency,
    titleRow: rows.titleRow,
    headerRow: rows.headerRow,
    itemRows: table.lines.length,
    total: { currency: table.currency, amount: total },
    statedTotal: {
      currency: table.currency,
      amount: total,
      label: totalLabel(table),
      source: excelRows(file, table.sheet, rows.totalRow ?? rows.lastRow),
    },
    source: excelRows(file, table.sheet, rows.firstRow, rows.lastRow),
    items: items.map(({ line, amount, row }) => ({
      ref: line.ref,
      equipment: line.equipment,
      supplier: line.supplier,
      origin: line.origin,
      quantity: line.quantity,
      unit: line.unit,
      unitPrice: line.unitPrice,
      amount,
      currency: table.currency,
      row,
    })),
  }));
  return {
    file,
    sheets: layout.sheets,
    rule: 'Each table is in its own currency. Totals are per currency; they are never added together or converted.',
    totalsByCurrency: totalsByCurrency(tables.map((table) => table.total)),
    tables,
    notes: [
      'Tables A and B share the sheet "Imported Equipment", separated by empty rows, each with its own title, header and total row.',
      'IE-B01 is above one million in euros, but it is not an SAR amount and must not appear in an "above SAR 1M" list.',
    ],
  };
}

/** Programme_Milestones.xlsx, and how its planned finish dates compare with the contract milestone dates. */
export function programmeFacts(layout: ProgrammeLayout, contractPdf: GeneratedPdf) {
  const file = layout.fileName;
  const rowOf = (id: string) => layout.rows.firstRow + programme.milestones.findIndex((m) => m.id === id);
  return {
    file,
    sheet: layout.sheet,
    headerRow: layout.rows.headerRow,
    dataDate: programme.dataDate,
    durationRule: 'Calendar days from Planned Start to Planned Finish, counting both days.',
    milestones: programme.milestones.map((m) => ({
      id: m.id,
      milestone: m.milestone,
      plannedStart: m.plannedStart,
      plannedFinish: m.plannedFinish,
      durationDays: durationDays(m),
      responsibleParty: m.responsible,
      deliverable: m.deliverable,
      source: excelRows(file, layout.sheet, rowOf(m.id)),
    })),
    againstContract: contract.milestones.map((m) => {
      const planned = programme.milestones.find((p) => p.id === m.id);
      const contractDate = dueDate(m.due, contract.commencement.date);
      const contractPage = contractPdf.pages[`milestone.${m.id}`];
      if (!planned || contractDate === null || contractPage === undefined) {
        throw new Error(`Milestone ${m.id} is missing from the programme or the contract`);
      }
      const daysAfter = daysBetween(contractDate, planned.plannedFinish);
      return {
        id: m.id,
        title: m.title,
        contractDate,
        plannedFinish: planned.plannedFinish,
        daysAfterContractDate: daysAfter,
        status: daysAfter > 0 ? 'late' : 'on time',
        contractSource: pdfPage(contractPdf.fileName, contractPage),
        programmeSource: excelRows(file, layout.sheet, rowOf(m.id)),
      };
    }),
  };
}

/** Provisional_Sums.xlsx: text amounts and what they mean. */
export function provisionalSumsFacts(layout: ProvisionalSumsLayout) {
  const file = layout.fileName;
  const items = provisionalSums.items.map((item, index) => ({
    ref: item.ref,
    description: item.description,
    text: item.text,
    amount: item.amount,
    currency: provisionalSums.currency,
    row: layout.rows.firstRow + index,
    source: excelRows(file, layout.sheet, layout.rows.firstRow + index),
  }));
  return {
    file,
    sheet: layout.sheet,
    headerRow: layout.rows.headerRow,
    amountsAreText: true,
    items,
    totals: [{ currency: provisionalSums.currency, amount: layout.total }],
    aboveSar1m: items.filter((item) => item.amount > THRESHOLD).map(({ ref, text, amount, row }) => ({ ref, text, amount, row })),
    arabicDescriptions: items.filter((item) => ARABIC.test(item.description)).map((item) => item.ref),
    source: excelRows(file, layout.sheet, layout.rows.firstRow, layout.rows.lastRow),
  };
}

/** Cost_Ledger_10k.xlsx: counts and totals over every row, as a threshold question needs. */
export function ledgerFacts(layout: LedgerLayout) {
  const { entries, rows } = layout;
  const file = layout.fileName;
  const amounts = (list: typeof entries) => sumAmounts(list.map((entry) => entry.amount));
  const above = entries.filter((entry) => entry.amount > THRESHOLD);
  const credits = entries.filter((entry) => entry.amount < 0);
  const codes = [...new Set(entries.map((entry) => entry.costCode))].sort();
  const largest = entries.reduce((best, entry) => (entry.amount > best.amount ? entry : best));
  return {
    file,
    sheet: layout.sheet,
    headerRow: rows.headerRow,
    firstDataRow: rows.firstRow,
    lastDataRow: rows.lastRow,
    dataRows: entries.length,
    columns: ['Date', 'Cost Code', 'Description', 'Vendor', 'Amount (SAR)'],
    dateRange: { from: entries[0]!.date, to: entries.at(-1)!.date },
    totals: [{ currency: 'SAR', amount: amounts(entries) }],
    rowsAboveSar1m: { count: above.length, total: amounts(above), rows: above },
    rowsAtExactlySar1m: entries.filter((entry) => entry.amount === THRESHOLD),
    creditNotes: { count: credits.length, total: amounts(credits) },
    largestEntry: largest,
    byCostCode: codes.map((code) => {
      const list = entries.filter((entry) => entry.costCode === code);
      return { costCode: code, rows: list.length, total: amounts(list) };
    }),
    source: excelRows(file, layout.sheet, rows.headerRow, rows.lastRow),
  };
}

/** Item rows above SAR 1,000,000 in every BOQ file, and in the latest revision of each bill only. */
export function itemsAboveAcrossBoqs(rev0: BoqLayout, rev1: BoqLayout, phase2: GeneratedPdfBoq) {
  const excelItems = (layout: BoqLayout) =>
    layout.bills.flatMap((bill) =>
      bill.items
        .filter((line) => line.amount > THRESHOLD)
        .map((line) => ({
          file: layout.revision.fileName,
          item: line.item.code,
          description: line.item.description,
          amount: line.amount,
          currency: layout.revision.currency,
          source: excelRows(layout.revision.fileName, bill.bill.sheet, line.row),
        })),
    );
  const pdfItems = phase2.layout.items
    .filter((placed) => placed.amount > THRESHOLD)
    .map((placed) => ({
      file: phase2.fileName,
      item: placed.item.code,
      description: placed.item.description,
      amount: placed.amount,
      currency: boqPhase2.currency,
      source: pdfPage(phase2.fileName, placed.page, formatAmount(placed.amount)),
    }));
  const items = [...excelItems(rev0), ...excelItems(rev1), ...pdfItems];
  const latest = [...excelItems(rev1), ...pdfItems];
  const files = [rev0.revision.fileName, rev1.revision.fileName, phase2.fileName];
  return {
    threshold: THRESHOLD,
    currency: 'SAR',
    rule: 'Item rows strictly above SAR 1,000,000.00, amounts as written in each file; totals, sub-totals and carried-forward lines are excluded.',
    countByFile: Object.fromEntries(files.map((file) => [file, items.filter((item) => item.file === file).length])),
    items,
    latestRevisions: { files: [rev1.revision.fileName, phase2.fileName], count: latest.length, items: latest },
    notes: [
      `${rev0.revision.fileName} and ${rev1.revision.fileName} are two revisions of the same Phase 1 bills, so most Phase 1 items appear in both; latestRevisions lists each bill once.`,
      `Item ${boqPhase2.atThresholdItem} in ${phase2.fileName} is exactly SAR 1,000,000.00, so it is not above the threshold.`,
      'Equipment_Imports.xlsx (USD, EUR, AED), Provisional_Sums.xlsx and Cost_Ledger_10k.xlsx are not BOQs; their large amounts are under their own keys.',
    ],
  };
}
