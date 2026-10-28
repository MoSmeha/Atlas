import { addDays, day, isoDate } from './lib/dates';
import { Random } from './lib/random';
import { placeTable, writeTable, type Column, type TableRows } from './lib/tableSheet';
import { addSheet, createWorkbook, DATE, MONEY, saveWorkbook } from './lib/workbook';
import { project } from './project';

export interface LedgerEntry {
  /** Excel row, 2 to 10001. */
  row: number;
  /** YYYY-MM-DD. */
  date: string;
  costCode: string;
  description: string;
  vendor: string;
  amount: number;
}

interface CostCode {
  code: string;
  vendors: readonly string[];
  items: readonly string[];
  /** Typical invoice range in SAR. */
  range: readonly [number, number];
  /** Whether interim and progress payments (up to SAR 3,200,000) can fall on this code. */
  large: boolean;
}

const costCode = (code: string, vendors: string[], items: string[], range: [number, number], large: boolean): CostCode => ({
  code,
  vendors,
  items,
  range,
  large,
});

const COST_CODES: readonly CostCode[] = [
  costCode('NGT-01-100', ['Diwan Site Services', 'Haras Security Services'], ['Site office rental', 'Security guarding', 'Temporary power and water', 'Site cleaning'], [60, 4_800], false),
  costCode('NGT-02-210', ['Raml Earthworks Est.', 'Jabal Plant Hire'], ['Excavation and disposal', 'Dewatering pump hire', 'Shoring monitoring'], [200, 19_000], true),
  costCode('NGT-02-220', ['Asas Piling Contractors'], ['Bored piles, progress claim', 'Pile testing', 'Pile cap breaking'], [450, 26_000], true),
  costCode('NGT-03-310', ['Al Wadi Ready Mix Co.', 'Sakhr Concrete Products'], ['Ready-mix concrete C50', 'Ready-mix concrete C60', 'Concrete pumping', 'Blinding concrete C15'], [300, 23_000], true),
  costCode('NGT-03-320', ['Najm Steel Trading', 'Hadid Rebar Fabrication'], ['Reinforcement steel, cut and bent', 'Couplers and tie wire', 'Post-tensioning tendons'], [400, 29_000], true),
  costCode('NGT-03-330', ['Sahra Formwork Systems'], ['Formwork hire', 'Slip-form equipment', 'Formwork labour'], [150, 10_500], false),
  costCode('NGT-04-410', ['Rawasi Facade Systems Co.', 'Zujaj Glass Processing'], ['Curtain wall units', 'Granite cladding panels', 'Facade brackets and fixings'], [350, 24_500], true),
  costCode('NGT-05-510', ['Thalj Cooling Solutions', 'Hawaa Duct Manufacturing'], ['Chilled water pipework', 'Ductwork supply', 'Air handling unit delivery'], [250, 18_000], true),
  costCode('NGT-05-520', ['Barq Electrical Supplies', 'Noor Cable Industries'], ['Cabling and containment', 'Lighting fittings', 'Switchboard delivery'], [125, 13_500], true),
  costCode('NGT-05-530', ['Nahr Plumbing Supplies'], ['Water supply pipework', 'Drainage pipework', 'Sprinkler heads'], [75, 7_000], false),
  costCode('NGT-06-610', ['Jabal Plant Hire', 'Rafi Crane Services'], ['Tower crane hire', 'Mobile crane hire', 'Hoist hire'], [300, 12_000], false),
  costCode('NGT-07-710', ['Ufuq Testing Laboratories', 'Dune Line Engineering Consultants'], ['Concrete cube testing', 'Survey services', 'Design review fees'], [90, 5_750], false),
];

export const costLedger = {
  fileName: 'Cost_Ledger_10k.xlsx',
  sheet: 'Ledger',
  dataRows: 10_000,
  seed: 20_260_201,
  from: '2026-02-01',
  to: '2026-10-15',
  /** The one payment of exactly SAR 1,000,000.00: at the threshold, so not above it. */
  atThresholdRow: 6_002,
  /** Shares of rows that are progress payments above SAR 1,000,000, interim payments below it, and credit notes. */
  largeShare: 0.002,
  mediumShare: 0.006,
  creditShare: 0.01,
};

type EntryKind = 'threshold' | 'large' | 'medium' | 'credit' | 'normal';

function kindOf(row: number, roll: number): EntryKind {
  const { largeShare, mediumShare, creditShare } = costLedger;
  if (row === costLedger.atThresholdRow) return 'threshold';
  if (roll < largeShare) return 'large';
  if (roll < largeShare + mediumShare) return 'medium';
  return roll < largeShare + mediumShare + creditShare ? 'credit' : 'normal';
}

/** The ledger rows, generated from a fixed seed in date order. */
export function buildLedger(): LedgerEntry[] {
  const random = new Random(costLedger.seed);
  const start = day(costLedger.from);
  const span = Math.round((day(costLedger.to).getTime() - start.getTime()) / 86_400_000) + 1;
  const largeCodes = COST_CODES.filter((code) => code.large);
  return Array.from({ length: costLedger.dataRows }, (_, index): LedgerEntry => {
    const row = index + 2;
    const date = isoDate(addDays(start, Math.floor((index * span) / costLedger.dataRows)));
    const kind = kindOf(row, random.next());
    const code = kind === 'normal' || kind === 'credit' ? random.pick(COST_CODES) : random.pick(largeCodes);
    const vendor = random.pick(code.vendors);
    const item = random.pick(code.items);
    const invoice = `${vendor.slice(0, 3).toUpperCase()}-${random.int(10_000, 99_999)}`;
    const entry = { row, date, costCode: code.code, vendor };
    switch (kind) {
      case 'threshold':
        return { ...entry, description: `Progress payment: milestone release, invoice ${invoice}`, amount: 1_000_000 };
      case 'large':
        return { ...entry, description: `Progress payment: ${item}, invoice ${invoice}`, amount: random.amount(1_000_000.01, 3_200_000) };
      case 'medium':
        return { ...entry, description: `Interim payment: ${item}, invoice ${invoice}`, amount: random.amount(60_000, 950_000) };
      case 'credit':
        return { ...entry, description: `Credit note: ${item}, against invoice ${invoice}`, amount: -random.amount(250, 45_000) };
      case 'normal':
        return { ...entry, description: `${item}, invoice ${invoice}`, amount: random.amount(code.range[0], code.range[1]) };
    }
  });
}

export interface LedgerLayout {
  fileName: string;
  sheet: string;
  rows: TableRows;
  entries: LedgerEntry[];
}

export function layoutLedger(): LedgerLayout {
  const entries = buildLedger();
  const rows = placeTable(1, entries.length, { title: false, total: false });
  return { fileName: costLedger.fileName, sheet: costLedger.sheet, rows, entries };
}

const COLUMNS: Column<LedgerEntry>[] = [
  { header: 'Date', width: 12, value: (entry) => day(entry.date), numFmt: DATE },
  { header: 'Cost Code', width: 13, value: (entry) => entry.costCode },
  { header: 'Description', width: 58, value: (entry) => entry.description },
  { header: 'Vendor', width: 34, value: (entry) => entry.vendor },
  { header: 'Amount (SAR)', width: 16, value: (entry) => entry.amount, numFmt: MONEY },
];

/** Cost_Ledger_10k.xlsx: a raw export with the header in row 1 and nothing but data below it. */
export async function writeCostLedger(layout: LedgerLayout): Promise<Uint8Array> {
  const issued = addDays(day(costLedger.to), 1);
  const workbook = createWorkbook(`${project.name} - Cost Ledger Export`, issued);
  const sheet = addSheet(workbook, layout.sheet, COLUMNS.map((column) => column.width), 'landscape');
  writeTable(sheet, layout.rows, COLUMNS, layout.entries, { plain: true });
  sheet.views = [{ state: 'frozen', ySplit: 1 }];
  sheet.autoFilter = `A1:E${layout.rows.lastRow}`;
  return saveWorkbook(workbook, issued);
}
