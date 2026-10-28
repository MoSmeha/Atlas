import type { CellValue, ExcelSource } from '@atlas/shared';
import { type Bill, FIRST_ITEM_ROW, billSheet, boqItems, boqPath, round2 } from './boq';
import { type Script, type ScriptContext, listStep, sar, toolInput } from './script';
import { ledgerPath, quotes, sheetGrid } from './sheets';

const tableTokens = { input: 18_430, cached: 12_288, output: 940, reasoning: 512 };

function sqlStep(sql: string, rows: number) {
  return { name: 'query_tables', inputSummary: toolInput({ sql }), resultSummary: `${rows} row${rows === 1 ? '' : 's'}`, durationMs: 22 };
}

/** "Which items in Bill 2 are over SAR 500,000?" The threshold runs over every row, in code. */
export function itemsOverAnswer(context: ScriptContext): Script {
  const threshold = thresholdIn(context.question) ?? 500_000;
  const bill: Bill = /bill\s*1|substructure/i.test(context.question) ? 1 : 2;
  const items = boqItems('rev3', bill);
  const over = items.filter((item) => item.amount > threshold).sort((a, b) => b.amount - a.amount);
  const total = round2(over.reduce((sum, item) => sum + item.amount, 0));
  const table = `boq_rev3_bill_${bill}`;
  const source: ExcelSource = {
    kind: 'excel',
    document: boqPath('rev3'),
    sheet: billSheet(bill),
    rowFrom: FIRST_ITEM_ROW,
    rowTo: FIRST_ITEM_ROW + items.length - 1,
  };
  const top = over[0];
  return {
    steps: [
      listStep(context.documents),
      {
        ...sqlStep(`SELECT item_code, amount_sar FROM ${table} WHERE amount_sar > ${threshold}`, 0),
        failure: { status: 'error', error: `no such column: amount_sar. Columns of ${table}: item_code, description, unit, quantity, rate, amount` },
      },
      sqlStep(`SELECT item_code, description, unit, quantity, rate, amount FROM ${table} WHERE amount > ${threshold} ORDER BY amount DESC`, over.length),
      sqlStep(`SELECT SUM(amount) FROM ${table} WHERE amount > ${threshold}`, 1),
    ],
    draft: null,
    chunkMs: 35,
    tokens: tableTokens,
    outcome: {
      type: 'answer',
      table: {
        title: `${billSheet(bill)} items over ${sar(threshold)}`,
        columns: ['Item', 'Description', 'Unit', 'Qty', 'Rate (SAR)', 'Amount (SAR)'],
        rows: over.map((item) => [item.code, item.description, item.unit, item.quantity, item.rate, item.amount]),
        totalRows: over.length,
      },
      answer: {
        kind: 'answer',
        language: 'en',
        markdown:
          `**${over.length} of ${items.length} items** in ${billSheet(bill)} of BOQ_Phase2_Rev3.xlsx are over ${sar(threshold)}, ` +
          `together **${sar(total)}**.` +
          (top ? ` The largest is ${top.code} (${top.description}) at ${sar(top.amount)}.` : ''),
        sources: [source],
        unreadableFiles: [],
        warnings: [],
      },
    },
  };
}

/** Rev 2 against Rev 3, line by line, with a first draft that a guard withdraws. */
export function revisionsAnswer(context: ScriptContext): Script {
  const rows: CellValue[][] = [];
  const sources: ExcelSource[] = [];
  let net = 0;
  for (const bill of [1, 2] as const) {
    const before = new Map(boqItems('rev2', bill).map((item) => [item.code, item]));
    const after = boqItems('rev3', bill);
    for (const item of after) {
      const old = before.get(item.code);
      if (old && old.amount === item.amount) continue;
      const change = !old ? 'Added' : old.quantity !== item.quantity ? 'Quantity changed' : 'Rate changed';
      const difference = round2(item.amount - (old?.amount ?? 0));
      net = round2(net + difference);
      rows.push([`Bill ${bill}`, item.code, item.description, change, old?.amount ?? null, item.amount, difference]);
    }
    for (const revision of ['rev2', 'rev3'] as const) {
      const count = boqItems(revision, bill).length;
      sources.push({ kind: 'excel', document: boqPath(revision), sheet: billSheet(bill), rowFrom: FIRST_ITEM_ROW, rowTo: FIRST_ITEM_ROW + count - 1 });
    }
  }
  return {
    steps: [
      listStep(context.documents),
      {
        name: 'compare_revisions',
        inputSummary: toolInput({ document_a: boqPath('rev2'), document_b: boqPath('rev3') }),
        resultSummary: `${rows.length} changed lines`,
        durationMs: 140,
      },
    ],
    draft: 'Revision 3 adds about SAR 2.4 million compared with Revision 2, mostly from',
    chunkMs: 35,
    tokens: { ...tableTokens, input: 26_870, output: 1_180 },
    outcome: {
      type: 'answer',
      table: {
        title: 'Changes from Rev 2 to Rev 3',
        columns: ['Bill', 'Item', 'Description', 'Change', 'Rev 2 amount (SAR)', 'Rev 3 amount (SAR)', 'Difference (SAR)'],
        rows,
        totalRows: rows.length,
      },
      answer: {
        kind: 'answer',
        language: 'en',
        markdown:
          `**${rows.length} lines** changed between BOQ_Phase2_Rev2.xlsx and BOQ_Phase2_Rev3.xlsx. ` +
          `Together they change the Bills 1 and 2 total by **${sar(net)}**. Item 2.13 is new in Rev 3; the other lines changed a quantity or a rate.`,
        sources,
        unreadableFiles: [],
        warnings: ['The first draft gave a total that no tool returned, so Atlas rewrote the answer with the computed figure.'],
      },
    },
  };
}

/** Totals per currency, never added across currencies. */
export function quotesAnswer(context: ScriptContext): Script {
  const totals = new Map<string, { count: number; amount: number }>();
  for (const quote of quotes) {
    const entry = totals.get(quote.currency) ?? { count: 0, amount: 0 };
    totals.set(quote.currency, { count: entry.count + 1, amount: round2(entry.amount + quote.amount) });
  }
  const rows = [...totals].map(([currency, { count, amount }]) => [currency, count, amount]);
  const listed = [...totals].map(([currency, { amount }]) => `**${currency} ${amount.toLocaleString('en-US')}**`).join(', ');
  const first = quotes[0]?.row ?? 3;
  const perCurrency = sqlStep('SELECT currency, COUNT(*), SUM(amount) FROM supplier_quotes GROUP BY currency ORDER BY SUM(amount) DESC', rows.length);
  return {
    steps: [
      listStep(context.documents),
      perCurrency,
      // The model asks for the same rows again; the server refuses a repeated call without running it.
      { ...perCurrency, durationMs: 0, failure: { status: 'refused', error: 'Skipped: the same request as an earlier step.' } },
    ],
    draft: null,
    chunkMs: 35,
    tokens: tableTokens,
    outcome: {
      type: 'answer',
      table: { title: 'Supplier quotations per currency', columns: ['Currency', 'Quotations', 'Total'], rows, totalRows: rows.length },
      answer: {
        kind: 'answer',
        language: 'en',
        markdown: `The quotations are in ${totals.size} currencies, so each is totalled on its own and they are not added together: ${listed}.`,
        sources: [{ kind: 'excel', document: '05 Commercial/Supplier_Quotations.xlsx', sheet: 'Quotes', rowFrom: first, rowTo: first + quotes.length - 1 }],
        unreadableFiles: [],
        warnings: [],
      },
    },
  };
}

/**
 * Ledger debits over a threshold. The query runs over all 10,000 postings and matches more rows
 * than an answer carries, so the table shows the first rows and the export has them all.
 */
export function ledgerAnswer(context: ScriptContext): Script {
  const threshold = thresholdIn(context.question) ?? 240_000;
  const grid = sheetGrid(ledgerPath, 'Ledger') ?? [];
  const matches: { cells: CellValue[]; row: number; debit: number }[] = [];
  for (const [index, cells] of grid.entries()) {
    const debit = cells[4];
    if (index > 0 && typeof debit === 'number' && debit > threshold) matches.push({ cells, row: index + 1, debit });
  }
  matches.sort((a, b) => b.debit - a.debit);
  const total = round2(matches.reduce((sum, posting) => sum + posting.debit, 0));
  const largest = matches[0];
  const sources: ExcelSource[] = [{ kind: 'excel', document: ledgerPath, sheet: 'Ledger', rowFrom: 2, rowTo: grid.length }];
  if (largest) sources.push({ kind: 'excel', document: ledgerPath, sheet: 'Ledger', rowFrom: largest.row, rowTo: largest.row });
  return {
    steps: [
      listStep(context.documents),
      sqlStep(`SELECT entry_no, date, account, description, debit FROM general_ledger WHERE debit > ${threshold} ORDER BY debit DESC`, matches.length),
      sqlStep(`SELECT COUNT(*), SUM(debit) FROM general_ledger WHERE debit > ${threshold}`, 1),
    ],
    draft: null,
    chunkMs: 35,
    tokens: tableTokens,
    outcome: {
      type: 'answer',
      table: {
        title: `Ledger debits over ${sar(threshold)}`,
        columns: ['Entry', 'Date', 'Account', 'Description', 'Debit (SAR)'],
        rows: matches.map((posting) => posting.cells.slice(0, 5)),
        totalRows: matches.length,
      },
      answer: {
        kind: 'answer',
        language: 'en',
        markdown:
          `**${matches.length} of ${(grid.length - 1).toLocaleString('en-US')} postings** in General_Ledger_FY2026.xlsx ` +
          `are debits over ${sar(threshold)}, together **${sar(total)}**.` +
          (largest ? ` The largest is entry ${String(largest.cells[0])} at ${sar(largest.debit)}.` : ''),
        sources,
        unreadableFiles: [],
        warnings: [],
      },
    },
  };
}

/** Reads "over SAR 500,000", "above 1.2 million" or "more than 250000" from a question. */
function thresholdIn(question: string): number | null {
  const match = /(?:over|above|more than|greater than|exceed(?:s|ing)?)\s*(?:SAR|SR)?\s*([\d,.]+)\s*(million|m\b|k\b)?/i.exec(question);
  if (!match?.[1]) return null;
  const value = Number(match[1].replace(/,/g, ''));
  if (!Number.isFinite(value)) return null;
  const unit = match[2]?.toLowerCase();
  return unit === 'million' || unit === 'm' ? value * 1_000_000 : unit === 'k' ? value * 1_000 : value;
}
