export type Revision = 'rev2' | 'rev3';
export type Bill = 1 | 2;

export interface BoqItem {
  code: string;
  description: string;
  unit: string;
  quantity: number;
  rate: number;
  amount: number;
  /** Row number in the sheet, as Excel shows it. */
  row: number;
}

type Line = [code: string, description: string, unit: string, quantity: number, rate: number];

const bill1: Line[] = [
  ['1.01', 'Site clearance and removal of topsoil', 'm2', 14_800, 6.5],
  ['1.02', 'Excavation in rock for basement', 'm3', 86_400, 38],
  ['1.03', 'Disposal of excavated material off site', 'm3', 86_400, 14],
  ['1.04', 'Secant pile shoring wall, 900 mm', 'm2', 9_600, 410],
  ['1.05', 'Dewatering during basement works', 'item', 1, 1_250_000],
  ['1.06', 'Blinding concrete C15, 75 mm', 'm2', 13_900, 21],
  ['1.07', 'Raft foundation concrete C40/50', 'm3', 11_200, 505],
  ['1.08', 'Reinforcement to raft, Grade 60', 't', 1_680, 3_050],
  ['1.09', 'Formwork to raft edges', 'm2', 1_450, 82],
  ['1.10', 'Basement retaining wall concrete C40/50', 'm3', 3_600, 525],
  ['1.11', 'Reinforcement to retaining walls, Grade 60', 't', 540, 3_090],
  ['1.12', 'Formwork to retaining walls', 'm2', 14_200, 79],
  ['1.13', 'Membrane tanking to basement', 'm2', 18_400, 96],
  ['1.14', 'Protection board to tanking', 'm2', 18_400, 18],
  ['1.15', 'Bored piles, 1,000 mm diameter', 'm', 7_560, 1_180],
  ['1.16', 'Pile cap concrete C40/50', 'm3', 2_900, 510],
  ['1.17', 'Hardcore filling under ground slab', 'm3', 4_200, 72],
  ['1.18', 'Termite treatment to ground', 'm2', 13_900, 9.5],
];

const bill2: Line[] = [
  ['2.01', 'Concrete C40/50 to columns', 'm3', 1_860, 520],
  ['2.02', 'Concrete C40/50 to core walls', 'm3', 2_240, 515],
  ['2.03', 'Concrete C35/45 to suspended slabs', 'm3', 6_950, 480],
  ['2.04', 'Concrete C35/45 to beams', 'm3', 1_420, 495],
  ['2.05', 'Post-tensioning to slabs', 'm2', 38_600, 42],
  ['2.06', 'Reinforcement to columns, Grade 60', 't', 610, 3_150],
  ['2.07', 'Reinforcement to slabs and beams, Grade 60', 't', 1_240, 3_080],
  ['2.08', 'Formwork to columns', 'm2', 9_800, 68],
  ['2.09', 'Formwork to slab soffits', 'm2', 41_200, 74],
  ['2.10', 'Jump form to core walls', 'm2', 12_600, 96],
  ['2.11', 'Hollow concrete blockwork, 200 mm', 'm2', 22_400, 64],
  ['2.12', 'Concrete blockwork partitions, 100 mm', 'm2', 8_100, 48],
  ['2.13', 'Structural steel to roof canopy', 't', 86, 9_400],
  ['2.14', 'Intumescent coating to steelwork', 'm2', 3_200, 58],
  ['2.15', 'Bituminous membrane to roof slab', 'm2', 2_850, 112],
  ['2.16', 'Expansion joints to slabs', 'm', 640, 185],
  ['2.17', 'Precast concrete stair flights', 'nr', 96, 6_800],
  ['2.18', 'Movement joints to blockwork', 'm', 3_900, 22],
  ['2.19', 'Precast lintels, 200 mm', 'm', 2_100, 75],
  ['2.20', 'Cast-in anchors and inserts', 'item', 1, 145_000],
  ['2.21', 'Core drilling through slabs', 'nr', 420, 260],
  ['2.22', 'Grouting to steel baseplates', 'nr', 140, 380],
  ['2.23', 'Provisional sum: concrete cube testing', 'item', 1, 250_000],
  ['2.24', "Builder's work in connection with services", 'item', 1, 480_000],
];

/** What Rev 2 had differently: changed quantity or rate, or a line Rev 3 added. */
const rev2Changes: Record<string, Partial<{ quantity: number; rate: number; absent: true }>> = {
  '1.05': { rate: 1_100_000 },
  '1.15': { quantity: 7_200 },
  '2.03': { quantity: 6_700 },
  '2.07': { rate: 2_960 },
  '2.13': { absent: true },
};

/** First item row on every bill sheet; rows 1 to 4 hold the title block and the header. */
export const FIRST_ITEM_ROW = 5;

export function billSheet(bill: Bill): string {
  return bill === 1 ? 'Bill 1 - Substructure' : 'Bill 2 - Superstructure';
}

export function boqPath(revision: Revision): string {
  return revision === 'rev3' ? '02 BOQ/BOQ_Phase2_Rev3.xlsx' : '02 BOQ/BOQ_Phase2_Rev2.xlsx';
}

export function boqItems(revision: Revision, bill: Bill): BoqItem[] {
  const lines = bill === 1 ? bill1 : bill2;
  const items: BoqItem[] = [];
  for (const [code, description, unit, quantity, rate] of lines) {
    const change = revision === 'rev2' ? rev2Changes[code] : undefined;
    if (change?.absent) continue;
    const q = change?.quantity ?? quantity;
    const r = change?.rate ?? rate;
    items.push({ code, description, unit, quantity: q, rate: r, amount: round2(q * r), row: FIRST_ITEM_ROW + items.length });
  }
  return items;
}

export function billTotal(revision: Revision, bill: Bill): number {
  return round2(boqItems(revision, bill).reduce((sum, item) => sum + item.amount, 0));
}

export function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
