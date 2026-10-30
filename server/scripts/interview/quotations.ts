import { day, longDate } from '../samples/lib/dates';
import { sumAmounts } from '../samples/lib/money';
import { placeTable, writeTable, writeTitleBlock, type Column, type TableRows } from '../samples/lib/tableSheet';
import { addSheet, createWorkbook, DATE, MONEY, saveWorkbook, writeFooter } from '../samples/lib/workbook';
import { contract, project } from './project';

export interface Quotation {
  ref: string;
  supplier: string;
  package: string;
  currency: 'SAR' | 'USD' | 'EUR';
  amount: number;
  /** YYYY-MM-DD. */
  validUntil: string;
  status: 'Accepted' | 'Under review' | 'Rejected';
}

const quote = (
  ref: string,
  supplier: string,
  pkg: string,
  currency: Quotation['currency'],
  amount: number,
  validUntil: string,
  status: Quotation['status'],
): Quotation => ({ ref, supplier, package: pkg, currency, amount, validUntil, status });

/** Supplier Quotations.xlsx: quotations in three currencies, so a total must be given per currency. */
export const quotations = {
  fileName: 'Supplier Quotations.xlsx',
  sheet: 'Quotations',
  asAt: '2026-09-20',
  items: [
    quote('Q-01', 'Gulf Rebar Mills Co.', 'Reinforcement B500B, 1,180 t', 'SAR', 3_894_000, '2026-12-31', 'Accepted'),
    quote('Q-02', 'Sahel Steel Structures Factory', 'Structural steel frames, W1 to W4', 'SAR', 14_250_000, '2026-06-30', 'Accepted'),
    quote('Q-03', 'Nordic Dock Systems AB', '48 hydraulic dock levellers', 'EUR', 1_296_000, '2026-11-15', 'Under review'),
    quote('Q-04', 'Crane and Hoist Industries Inc.', '2 overhead travelling cranes, 10 t', 'USD', 486_500, '2026-10-31', 'Accepted'),
    quote('Q-05', 'Eastern Cladding Co.', 'Roof and wall cladding, all warehouses', 'SAR', 9_860_000, '2026-11-30', 'Under review'),
    quote('Q-06', 'Fire Flow Systems LLC', 'ESFR sprinkler package', 'USD', 1_120_000, '2026-12-15', 'Under review'),
    quote('Q-07', 'Delta Switchgear GmbH', '13.8 kV switchgear and transformers', 'EUR', 742_500, '2026-10-20', 'Accepted'),
    quote('Q-08', 'Khobar Precast Factory', 'Manholes, catch basins and kerbs', 'SAR', 2_215_000, '2027-03-31', 'Accepted'),
    quote('Q-09', 'Arabian LED Lighting Co.', 'High-bay luminaires and controls', 'SAR', 1_985_000, '2026-09-30', 'Rejected'),
    quote('Q-10', 'Pumps International Corp.', 'Fire pump set, diesel and electric', 'USD', 298_000, '2026-12-31', 'Accepted'),
    quote('Q-11', 'Green Oasis Landscaping', 'Landscaping and irrigation', 'SAR', 2_640_000, '2027-01-31', 'Under review'),
    quote('Q-12', 'Pacific Sectional Doors Ltd.', '48 insulated loading doors', 'USD', 276_000, '2026-10-15', 'Rejected'),
  ] satisfies Quotation[],
};

export interface CurrencyTotal {
  currency: string;
  amount: number;
  count: number;
}

export function quotationTotals(): CurrencyTotal[] {
  const currencies = [...new Set(quotations.items.map((item) => item.currency))];
  return currencies.map((currency) => {
    const matching = quotations.items.filter((item) => item.currency === currency);
    return { currency, amount: sumAmounts(matching.map((item) => item.amount)), count: matching.length };
  });
}

const COLUMNS: Column<Quotation>[] = [
  { header: 'Ref', width: 8, value: (item) => item.ref },
  { header: 'Supplier', width: 34, value: (item) => item.supplier },
  { header: 'Package', width: 42, value: (item) => item.package },
  { header: 'Currency', width: 10, value: (item) => item.currency },
  { header: 'Amount (excl. VAT)', width: 18, value: (item) => item.amount, numFmt: MONEY },
  { header: 'Valid Until', width: 14, value: (item) => day(item.validUntil), numFmt: DATE },
  { header: 'Status', width: 14, value: (item) => item.status },
];

export async function writeQuotations(): Promise<{ bytes: Uint8Array; rows: TableRows }> {
  const issued = day(quotations.asAt);
  const workbook = createWorkbook(`${project.name} - Supplier Quotations`, issued);
  const sheet = addSheet(workbook, quotations.sheet, COLUMNS.map((column) => column.width), 'landscape');
  writeTitleBlock(sheet, [
    project.name,
    'Supplier Quotations Register',
    `Contract No. ${contract.number}. Status as at ${longDate(issued)}. Amounts are as quoted, in the currency of each quotation, excluding VAT and customs duties.`,
  ]);
  const rows = placeTable(5, quotations.items.length, { title: false, total: false });
  writeTable(sheet, rows, COLUMNS, quotations.items);
  writeFooter(sheet, rows.end + 1);
  return { bytes: await saveWorkbook(workbook, issued), rows };
}
