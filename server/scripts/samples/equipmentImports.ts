import { day, longDate } from './lib/dates';
import { lineAmount, sumAmounts } from './lib/money';
import { columnLetter, placeTable, writeTable, writeTitleBlock, type Column, type TableRows } from './lib/tableSheet';
import { addSheet, createWorkbook, MONEY, saveWorkbook, WHOLE, writeFooter } from './lib/workbook';
import { project } from './project';

export interface EquipmentLine {
  ref: string;
  equipment: string;
  supplier: string;
  origin: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  leadTimeWeeks: number;
}

export interface EquipmentTable {
  sheet: string;
  title: string;
  currency: string;
  lines: EquipmentLine[];
}

const line = (
  ref: string,
  equipment: string,
  supplier: string,
  origin: string,
  quantity: number,
  unit: string,
  unitPrice: number,
  leadTimeWeeks: number,
): EquipmentLine => ({ ref, equipment, supplier, origin, quantity, unit, unitPrice, leadTimeWeeks });

const MAIN_SHEET = 'Imported Equipment';
const REGIONAL_SHEET = 'Regional Supply';
/** Empty rows between the two tables on the main sheet. */
const GAP_ROWS = 2;
const FIRST_TABLE_ROW = 5;

export const equipmentImports = {
  fileName: 'Equipment_Imports.xlsx',
  issueDate: '2026-08-20',
  tables: [
    {
      sheet: MAIN_SHEET,
      title: 'Table A - Equipment priced in US Dollars (USD)',
      currency: 'USD',
      lines: [
        line('IE-A01', 'Medium voltage ring main units, 13.8 kV', 'Westbrook Power Systems Inc.', 'United States', 4, 'nr', 86_500, 22),
        line('IE-A02', 'Cast resin transformers, 2,500 kVA', 'Westbrook Power Systems Inc.', 'United States', 6, 'nr', 64_200, 26),
        line('IE-A03', 'Variable refrigerant flow outdoor units for the retail podium', 'Pacific Climate Corp.', 'Japan', 24, 'nr', 18_750.5, 16),
        line('IE-A04', 'Building management system controllers and software licences', 'Lakeshore Controls LLC', 'United States', 1, 'lot', 412_000, 18),
        line('IE-A05', 'Access control and CCTV head-end equipment', 'Lakeshore Controls LLC', 'United States', 1, 'lot', 268_400, 14),
        line('IE-A06', 'Fire pump controllers, listed for fire service', 'Redline Fire Equipment Inc.', 'United States', 3, 'nr', 21_900, 20),
        line('IE-A07', 'Kitchen exhaust ecology units for food court tenants', 'Pacific Climate Corp.', 'Malaysia', 8, 'nr', 15_640.75, 12),
      ],
    },
    {
      sheet: MAIN_SHEET,
      title: 'Table B - Equipment priced in Euros (EUR)',
      currency: 'EUR',
      lines: [
        line('IE-B01', 'Passenger lifts, 21 persons, 4.0 m/s, machine-room-less', 'Alpenlift GmbH', 'Germany', 14, 'nr', 168_500, 40),
        line('IE-B02', 'Service lifts, 2,000 kg', 'Alpenlift GmbH', 'Germany', 2, 'nr', 142_000, 40),
        line('IE-B03', 'Escalators, 30 degree, 1,000 mm step width', 'Alpenlift GmbH', 'Austria', 4, 'nr', 96_800, 36),
        line('IE-B04', 'Architectural facade lighting controllers and fittings for the crown', 'Lumen Nord S.p.A.', 'Italy', 1, 'lot', 236_000, 24),
        line('IE-B05', 'Heat recovery wheels for fresh air handling units', 'Nordvent AB', 'Sweden', 6, 'nr', 24_350, 18),
        line('IE-B06', 'Acoustic louvres for plant rooms', 'Nordvent AB', 'Denmark', 1, 'lot', 88_400.4, 10),
      ],
    },
    {
      sheet: REGIONAL_SHEET,
      title: 'Table C - Equipment supplied from the UAE, priced in UAE Dirhams (AED)',
      currency: 'AED',
      lines: [
        line('IE-C01', 'Pre-insulated chilled water pipe, factory supply', 'Gulf Coast Pipe Systems FZE', 'United Arab Emirates', 1, 'lot', 640_000, 8),
        line('IE-C02', 'Fire rated ductwork, 2 hours', 'Gulf Coast Pipe Systems FZE', 'United Arab Emirates', 2_400, 'm2', 185.5, 10),
        line('IE-C03', 'Low voltage switchgear panels, assembled under licence', 'Creekside Switchgear LLC', 'United Arab Emirates', 18, 'nr', 42_750, 14),
      ],
    },
  ] satisfies EquipmentTable[],
};

/** One priced line and the amount it shows: quantity x unit price. */
export interface PricedLine {
  line: EquipmentLine;
  amount: number;
  row: number;
}

export interface PlacedEquipmentTable {
  table: EquipmentTable;
  rows: TableRows;
  items: PricedLine[];
  total: number;
}

export interface EquipmentLayout {
  fileName: string;
  sheets: string[];
  tables: PlacedEquipmentTable[];
  footerRows: Record<string, number>;
}

/** Puts tables A and B on the main sheet with empty rows between them, and table C on the second sheet. */
export function layoutEquipment(): EquipmentLayout {
  const next: Record<string, number> = {};
  const tables = equipmentImports.tables.map((table) => {
    const start = next[table.sheet] ?? FIRST_TABLE_ROW;
    const rows = placeTable(start, table.lines.length, { title: true, total: true });
    next[table.sheet] = rows.end + GAP_ROWS;
    const items = table.lines.map((line, index) => ({
      line,
      amount: lineAmount(line.quantity, line.unitPrice),
      row: rows.firstRow + index,
    }));
    return { table, rows, items, total: sumAmounts(items.map((item) => item.amount)) };
  });
  const sheets = [...new Set(tables.map((placed) => placed.table.sheet))];
  const footerRows = Object.fromEntries(sheets.map((sheet) => [sheet, (next[sheet] ?? FIRST_TABLE_ROW) - GAP_ROWS + 1]));
  return { fileName: equipmentImports.fileName, sheets, tables, footerRows };
}

/** "Total Table A (USD)". */
export function totalLabel(table: EquipmentTable): string {
  return `Total ${table.title.split(' - ')[0]} (${table.currency})`;
}

function columns(currency: string): Column<PricedLine>[] {
  const quantity = columnLetter(5);
  const price = columnLetter(7);
  return [
    { header: 'Ref', width: 9, value: (item) => item.line.ref },
    { header: 'Equipment', width: 46, value: (item) => item.line.equipment },
    { header: 'Supplier', width: 28, value: (item) => item.line.supplier },
    { header: 'Country of Origin', width: 18, value: (item) => item.line.origin },
    { header: 'Qty', width: 8, value: (item) => item.line.quantity, numFmt: WHOLE },
    { header: 'Unit', width: 7, value: (item) => item.line.unit },
    { header: `Unit Price (${currency})`, width: 16, value: (item) => item.line.unitPrice, numFmt: MONEY },
    {
      header: `Amount (${currency})`,
      width: 18,
      value: (item, row) => ({ formula: `${quantity}${row}*${price}${row}`, result: item.amount }),
      numFmt: MONEY,
    },
    { header: 'Lead Time (weeks)', width: 12, value: (item) => item.line.leadTimeWeeks },
  ];
}

/** Equipment_Imports.xlsx: supplier prices in their own currencies, one total per table and never a mixed total. */
export async function writeEquipmentImports(layout: EquipmentLayout): Promise<Uint8Array> {
  const issued = day(equipmentImports.issueDate);
  const workbook = createWorkbook(`${project.name} - Imported Equipment Register`, issued);
  const titles = [
    project.name,
    'Imported Equipment Register - long-lead items',
    `Supplier quotations as of ${longDate(issued)}, excluding VAT, customs duty and freight to Site. Each table is in its own currency.`,
  ];
  for (const sheetName of layout.sheets) {
    const placed = layout.tables.filter((item) => item.table.sheet === sheetName);
    const sheet = addSheet(workbook, sheetName, columns('').map((column) => column.width), 'landscape');
    writeTitleBlock(sheet, titles);
    for (const { table, rows, items, total } of placed) {
      writeTable(sheet, rows, columns(table.currency), items, {
        title: table.title,
        total: { label: totalLabel(table), labelColumn: 2, sumColumn: 8, value: total },
      });
    }
    writeFooter(sheet, layout.footerRows[sheetName] ?? 1);
  }
  return saveWorkbook(workbook, issued);
}
