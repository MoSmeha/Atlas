import { day, longDate } from '../samples/lib/dates';
import { sumAmounts } from '../samples/lib/money';
import { placeTable, writeTable, writeTitleBlock, type Column, type TableRows } from '../samples/lib/tableSheet';
import { addSheet, createWorkbook, DATE, MONEY, saveWorkbook, writeFooter } from '../samples/lib/workbook';
import { contract, project } from './project';

export type VoStatus = 'Approved' | 'Pending' | 'Rejected';

export interface VariationOrder {
  id: string;
  /** YYYY-MM-DD. */
  raised: string;
  description: string;
  origin: string;
  /** Negative for an omission. */
  amount: number;
  status: VoStatus;
  /** YYYY-MM-DD when approved or rejected, otherwise null. */
  decided: string | null;
}

const vo = (
  id: string,
  raised: string,
  description: string,
  origin: string,
  amount: number,
  status: VoStatus,
  decided: string | null,
): VariationOrder => ({ id, raised, description, origin, amount, status, decided });

/** Variation Orders Log.xlsx: fourteen orders, approved, pending and rejected, some negative. */
export const variations = {
  fileName: 'Variation Orders Log.xlsx',
  sheet: 'VO Log',
  asAt: '2026-10-05',
  items: [
    vo('VO-001', '2026-04-02', 'Additional site fencing along the Zone C boundary pending the handover of Zone C', "Employer's instruction", 286_400, 'Approved', '2026-04-20'),
    vo('VO-002', '2026-04-15', 'Omission of the second gatehouse (the Park provides a shared gate)', "Employer's instruction", -142_000, 'Approved', '2026-05-03'),
    vo('VO-003', '2026-05-06', 'Rock excavation in the north-west corner beyond the geotechnical report', 'Site condition', 412_000, 'Pending', null),
    vo('VO-004', '2026-05-20', 'Upgrade of the truck court hardstanding from 220 mm to 250 mm', "Employer's instruction", 1_245_000, 'Approved', '2026-06-11'),
    vo('VO-005', '2026-06-03', 'Relocation of the temporary site offices for the Zone C fence works', 'Site condition', 96_800, 'Approved', '2026-06-18'),
    vo('VO-006', '2026-06-22', 'Change of warehouse floor finish to resin coating', "Contractor's proposal", 318_000, 'Rejected', '2026-07-09'),
    vo('VO-007', '2026-07-01', 'Additional storm water attenuation tank, 600 m3, required by the Park authority', "Employer's instruction", 512_300, 'Approved', '2026-07-21'),
    vo('VO-008', '2026-07-14', 'Two additional loading doors and dock levellers to Warehouse W2', "Employer's instruction", 1_860_000, 'Pending', null),
    vo('VO-009', '2026-07-28', 'Omission of the flagpoles and part of the site furniture', "Employer's instruction", -58_500, 'Approved', '2026-08-12'),
    vo('VO-010', '2026-08-10', 'Night-shift premium for the W1 slab pours', "Contractor's proposal", 84_000, 'Rejected', '2026-08-25'),
    vo('VO-011', '2026-08-19', 'Diversion of the existing 400 mm irrigation main found in Zone B', 'Site condition', 734_000, 'Approved', '2026-09-08'),
    vo('VO-012', '2026-09-02', 'Additional CCTV cameras and access control to the truck gates', "Employer's instruction", 225_500, 'Pending', null),
    vo('VO-013', '2026-09-16', 'Prolongation costs for the late handover of Zone C (Extension of Time Claim No. 2)', "Contractor's claim", 1_118_000, 'Pending', null),
    vo('VO-014', '2026-09-30', 'Additional road markings for the truck marshalling area', "Employer's instruction", 64_300, 'Pending', null),
  ] satisfies VariationOrder[],
};

export interface VoSummary {
  approvedTotal: number;
  pendingTotal: number;
  rejectedTotal: number;
  approved: VariationOrder[];
  pending: VariationOrder[];
  rejected: VariationOrder[];
}

export function variationSummary(): VoSummary {
  const by = (status: VoStatus) => variations.items.filter((item) => item.status === status);
  const total = (items: VariationOrder[]) => sumAmounts(items.map((item) => item.amount));
  const approved = by('Approved');
  const pending = by('Pending');
  const rejected = by('Rejected');
  return { approvedTotal: total(approved), pendingTotal: total(pending), rejectedTotal: total(rejected), approved, pending, rejected };
}

const COLUMNS: Column<VariationOrder>[] = [
  { header: 'VO No.', width: 9, value: (item) => item.id },
  { header: 'Date Raised', width: 13, value: (item) => day(item.raised), numFmt: DATE },
  { header: 'Description', width: 64, value: (item) => item.description },
  { header: 'Origin', width: 22, value: (item) => item.origin },
  { header: 'Amount (SAR)', width: 16, value: (item) => item.amount, numFmt: MONEY },
  { header: 'Status', width: 11, value: (item) => item.status },
  { header: 'Date Decided', width: 13, value: (item) => (item.decided === null ? null : day(item.decided)), numFmt: DATE },
];

export interface VoLayout {
  rows: TableRows;
  summaryRows: { approved: number; pending: number; rejected: number };
}

export async function writeVariations(): Promise<{ bytes: Uint8Array; layout: VoLayout }> {
  const issued = day(variations.asAt);
  const workbook = createWorkbook(`${project.name} - Variation Orders Log`, issued);
  const sheet = addSheet(workbook, variations.sheet, COLUMNS.map((column) => column.width), 'landscape');
  writeTitleBlock(sheet, [
    project.name,
    'Variation Orders Log',
    `Contract No. ${contract.number}. Status as at ${longDate(issued)}. Amounts exclude VAT; negative amounts are omissions.`,
  ]);
  const rows = placeTable(5, variations.items.length, { title: false, total: false });
  writeTable(sheet, rows, COLUMNS, variations.items);
  const summary = variationSummary();
  const range = (column: string) => `${column}${rows.firstRow}:${column}${rows.lastRow}`;
  const lines: [string, VoStatus, number][] = [
    ['Approved total', 'Approved', summary.approvedTotal],
    ['Pending total', 'Pending', summary.pendingTotal],
    ['Rejected total', 'Rejected', summary.rejectedTotal],
  ];
  const first = rows.end + 1;
  lines.forEach(([label, status, value], index) => {
    const row = first + index;
    sheet.getCell(`D${row}`).value = label;
    sheet.getCell(`D${row}`).font = { bold: true };
    sheet.getCell(`E${row}`).value = { formula: `SUMIF(${range('F')},"${status}",${range('E')})`, result: value };
    sheet.getCell(`E${row}`).numFmt = MONEY;
    sheet.getCell(`E${row}`).font = { bold: true };
  });
  writeFooter(sheet, first + lines.length + 1);
  return { bytes: await saveWorkbook(workbook, issued), layout: { rows, summaryRows: { approved: first, pending: first + 1, rejected: first + 2 } } };
}
