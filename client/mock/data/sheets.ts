import type { CellValue } from '@atlas/shared';
import { type Bill, type Revision, billSheet, billTotal, boqItems, boqPath } from './boq';

export interface Quote {
  supplier: string;
  item: string;
  currency: string;
  amount: number;
  row: number;
}

export const quotes: Quote[] = [
  ['Saudi Readymix Co.', 'Concrete C40/50 supply', 'SAR', 4_860_000],
  ['Al Rajhi Steel', 'Reinforcement Grade 60', 'SAR', 7_412_500],
  ['Zamil Structural Steel', 'Roof canopy steelwork', 'SAR', 795_000],
  ['Otis Elevator Co.', 'Passenger lifts, 8 nr', 'USD', 1_240_000],
  ['Schindler', 'Service lifts, 2 nr', 'EUR', 318_000],
  ['Carrier Middle East', 'Chillers, 3 x 1,200 TR', 'USD', 2_085_000],
  ['Grundfos', 'Booster pump sets', 'EUR', 146_500],
  ['Saudi Cable Company', 'LV cables and containment', 'SAR', 1_930_000],
  ['Hilti Saudi Arabia', 'Fire stopping', 'SAR', 214_800],
].map(([supplier, item, currency, amount], i) => ({
  supplier: String(supplier),
  item: String(item),
  currency: String(currency),
  amount: Number(amount),
  row: 3 + i,
}));

const programme: [string, string, string, string, number][] = [
  ['A1000', 'Mobilisation and site set-up', '2026-02-01', '2026-03-14', 42],
  ['A1010', 'Shoring and piling', '2026-03-01', '2026-06-27', 119],
  ['A1020', 'Basement excavation', '2026-05-10', '2026-08-15', 98],
  ['A1030', 'Raft foundation', '2026-08-02', '2026-10-10', 70],
  ['A1040', 'Basement walls and slabs', '2026-09-20', '2026-11-26', 68],
  ['M1050', 'Milestone: substructure complete', '2026-11-26', '2026-11-26', 0],
  ['A1060', 'Superstructure frame, levels 1 to 20', '2026-11-29', '2027-09-30', 306],
  ['A1070', 'Superstructure frame, levels 21 to 38', '2027-10-03', '2028-02-24', 145],
  ['A1080', 'Facade installation', '2027-06-01', '2028-04-30', 335],
  ['A1090', 'MEP first fix', '2027-03-01', '2028-01-31', 337],
  ['A1100', 'Testing and commissioning', '2028-03-01', '2028-06-30', 122],
  ['M1110', 'Milestone: substantial completion', '2028-07-31', '2028-07-31', 0],
];

const ledgerAccounts = ['5100 Concrete', '5110 Reinforcement', '5200 Formwork', '5300 Labour', '5400 Plant hire', '6100 Site overheads'];

/** Every cell of a sheet, top row first, as the viewer pages through it. Null for an unknown sheet. */
export function sheetGrid(path: string, sheet: string): CellValue[][] | null {
  for (const revision of ['rev2', 'rev3'] as const) {
    if (path !== boqPath(revision)) continue;
    if (sheet === 'Summary') return summaryGrid(revision);
    for (const bill of [1, 2] as const) if (sheet === billSheet(bill)) return billGrid(revision, bill);
    return null;
  }
  if (path === '04 Programme/Baseline_Programme_Rev1.xlsx' && sheet === 'Programme') {
    return [['Activity ID', 'Activity', 'Start', 'Finish', 'Duration (days)'], ...programme];
  }
  if (path === '05 Commercial/Supplier_Quotations.xlsx' && sheet === 'Quotes') {
    return [
      ['Supplier quotations received to 30 September 2026', null, null, null],
      ['Supplier', 'Item', 'Currency', 'Amount'],
      ...quotes.map((q) => [q.supplier, q.item, q.currency, q.amount]),
    ];
  }
  if (path === '05 Commercial/General_Ledger_FY2026.xlsx' && sheet === 'Ledger') return ledgerGrid();
  if (path === '02 BOQ/BOQ_Template_Empty.xlsx' && sheet === 'Sheet1') return [];
  return null;
}

function title(revision: Revision): string {
  return `Al Nakheel Mixed-Use Tower, Riyadh - Phase 2 BOQ (Revision ${revision === 'rev3' ? 3 : 2})`;
}

function billGrid(revision: Revision, bill: Bill): CellValue[][] {
  const items = boqItems(revision, bill);
  return [
    [title(revision), null, null, null, null, null],
    [billSheet(bill), null, null, null, null, null],
    [null, null, null, null, null, null],
    ['Item', 'Description', 'Unit', 'Qty', 'Rate (SAR)', 'Amount (SAR)'],
    ...items.map((item) => [item.code, item.description, item.unit, item.quantity, item.rate, item.amount]),
    [null, 'Total carried to Summary', null, null, null, billTotal(revision, bill)],
  ];
}

function summaryGrid(revision: Revision): CellValue[][] {
  const bill1 = billTotal(revision, 1);
  const bill2 = billTotal(revision, 2);
  return [
    [title(revision), null, null],
    ['Summary of Bills', null, null],
    [null, null, null],
    ['Bill', 'Description', 'Amount (SAR)'],
    ['1', 'Substructure', bill1],
    ['2', 'Superstructure', bill2],
    [null, 'Total', Math.round((bill1 + bill2) * 100) / 100],
  ];
}

let ledger: CellValue[][] | null = null;

/** 10,000 generated postings, the same on every run. */
function ledgerGrid(): CellValue[][] {
  if (ledger) return ledger;
  let seed = 20_260_101;
  const random = () => {
    seed = (Math.imul(seed, 1_103_515_245) + 12_345) >>> 0;
    return seed / 2 ** 32;
  };
  const rows: CellValue[][] = [['Entry', 'Date', 'Account', 'Description', 'Debit (SAR)', 'Credit (SAR)']];
  for (let entry = 1; entry <= 10_000; entry++) {
    const day = new Date(Date.UTC(2026, 0, 1 + Math.floor((entry - 1) / 28)));
    const account = ledgerAccounts[Math.floor(random() * ledgerAccounts.length)] ?? '6100 Site overheads';
    const amount = Math.round(random() * 250_000 * 100) / 100;
    const isDebit = random() < 0.8;
    rows.push([
      entry,
      day.toISOString().slice(0, 10),
      account,
      `${isDebit ? 'Invoice' : 'Credit note'} ${String(40_000 + entry)}`,
      isDebit ? amount : null,
      isDebit ? null : amount,
    ]);
  }
  ledger = rows;
  return rows;
}
