import { day } from './lib/dates';
import { PdfWriter } from './lib/PdfWriter';
import { Random } from './lib/random';
import { contract, parties, project } from './project';

/** Drawing_Register.pdf: a real drawing register cut off after its first bytes and padded with noise, as a broken download would be. */
export const drawingRegister = {
  fileName: 'Drawing_Register.pdf',
  issueDate: '2026-09-01',
  keptBytes: 1_500,
  garbageBytes: 2_048,
};

const DRAWINGS: [string, string, string][] = [
  ['NGT-ARC-GA-001', 'General arrangement, basement level B3', 'C'],
  ['NGT-ARC-GA-002', 'General arrangement, ground floor and podium', 'C'],
  ['NGT-ARC-GA-010', 'Typical office floor, Levels 5 to 16', 'B'],
  ['NGT-ARC-GA-020', 'Typical serviced apartment floor, Levels 17 to 28', 'B'],
  ['NGT-ARC-EL-001', 'North and east elevations', 'B'],
  ['NGT-ARC-EL-002', 'South and west elevations', 'B'],
  ['NGT-STR-PL-001', 'Piling layout', 'D'],
  ['NGT-STR-RF-001', 'Raft foundation reinforcement', 'C'],
  ['NGT-STR-TR-005', 'Level 5 transfer slab', 'B'],
  ['NGT-FAC-CW-001', 'Curtain wall unit types and setting out', 'A'],
  ['NGT-MEP-SC-001', 'Combined services, typical office floor', 'A'],
];

/** The register as it was before it was damaged. */
export async function writeIntactDrawingRegister(): Promise<Uint8Array> {
  const pdf = await PdfWriter.create({
    title: `${project.name} - Drawing Register`,
    subject: 'Register of issued drawings',
    runningHeader: `${project.name}  |  Drawing Register  |  Contract No. ${contract.number}`,
    issued: day(drawingRegister.issueDate),
  });
  pdf.heading('Drawing Register');
  pdf.paragraph(`Issued by ${parties.engineer.name}. Drawings listed at their latest revision.`);
  pdf.table(
    [
      { header: 'Drawing No.', share: 0.3 },
      { header: 'Title', share: 0.58 },
      { header: 'Rev.', share: 0.12 },
    ],
    DRAWINGS.map((row) => [...row]),
  );
  return (await pdf.finish()).bytes;
}

/** The damaged file: the first bytes of the register followed by seeded random bytes. */
export async function buildDrawingRegister(): Promise<Uint8Array> {
  const intact = await writeIntactDrawingRegister();
  const random = new Random(1_500);
  const garbage = Uint8Array.from({ length: drawingRegister.garbageBytes }, () => random.int(0, 255));
  const out = new Uint8Array(drawingRegister.keptBytes + garbage.length);
  out.set(intact.subarray(0, drawingRegister.keptBytes));
  out.set(garbage, drawingRegister.keptBytes);
  return out;
}
