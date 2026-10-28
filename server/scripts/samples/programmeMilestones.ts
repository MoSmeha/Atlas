import { day, longDate } from './lib/dates';
import { placeTable, writeTable, writeTitleBlock, type Column, type TableRows } from './lib/tableSheet';
import { addSheet, createWorkbook, DATE, saveWorkbook, WHOLE, writeFooter } from './lib/workbook';
import { parties, project } from './project';

export interface ProgrammeMilestone {
  id: string;
  milestone: string;
  /** YYYY-MM-DD. */
  plannedStart: string;
  plannedFinish: string;
  responsible: string;
  deliverable: string;
}

const CONTRACTOR = parties.contractor.name;
const ENGINEER = parties.engineer.name;
const EMPLOYER = parties.employer.name;
export const FACADE_SUBCONTRACTOR = 'Rawasi Facade Systems Co. (facade subcontractor)';

const milestone = (
  id: string,
  name: string,
  plannedStart: string,
  plannedFinish: string,
  responsible: string,
  deliverable: string,
): ProgrammeMilestone => ({ id, milestone: name, plannedStart, plannedFinish, responsible, deliverable });

/**
 * Programme_Milestones.xlsx. IDs M1 to M9 are the contract milestones; P2 rows are Phase 2 facade activities.
 * Planted problem: M6 (topping out) finishes on 29 December 2027, 14 days after the contract date.
 */
export const programme = {
  fileName: 'Programme_Milestones.xlsx',
  sheet: 'Programme',
  revision: 'Revision 2',
  dataDate: '2026-10-01',
  milestones: [
    milestone('M1', 'Baseline Programme accepted by the Engineer', '2026-02-01', '2026-03-01', CONTRACTOR, 'Baseline Programme in Primavera P6 format'),
    milestone('M2', 'Design Submission 1 (shoring, piling and substructure)', '2026-02-15', '2026-04-15', CONTRACTOR, 'Design Submission 1 drawings and calculations'),
    milestone('M3', 'Design Submission 2 (superstructure, facade and MEP)', '2026-04-16', '2026-08-31', CONTRACTOR, 'Design Submission 2 drawings, calculations and specifications'),
    milestone('P2-01', 'Phase 2 facade package Bill of Quantities issued', '2026-09-01', '2026-09-14', ENGINEER, 'Bill of Quantities - Phase 2, Bill No. 4 Facade Package'),
    milestone('M4', 'Facade visual mock-up completed and approved', '2026-09-01', '2026-11-30', FACADE_SUBCONTRACTOR, 'Facade Mock-up Test Report'),
    milestone('M5', 'Basement raft foundation completed', '2026-06-01', '2027-03-31', CONTRACTOR, 'Raft pour records and concrete test certificates'),
    milestone('P2-02', 'Podium granite cladding and GRC screens installed', '2027-05-02', '2027-11-30', FACADE_SUBCONTRACTOR, 'Installation inspection records, podium'),
    milestone('M6', 'Topping out: Level 28 roof slab cast', '2027-04-01', '2027-12-29', CONTRACTOR, 'Structural frame completion record'),
    milestone('M7', 'MEP testing and commissioning started', '2028-03-01', '2028-03-01', CONTRACTOR, 'MEP Testing and Commissioning Plan'),
    milestone('P2-03', 'Tower crown steelwork and glass fins installed', '2028-01-05', '2028-04-30', FACADE_SUBCONTRACTOR, 'Installation inspection records, crown'),
    milestone('M8', 'MEP testing and commissioning completed', '2028-03-01', '2028-05-31', CONTRACTOR, 'Commissioning reports witnessed by the Engineer'),
    milestone('M9', 'Handover: Taking-Over of the Works', '2028-07-01', '2028-07-31', EMPLOYER, 'As-built Drawings; Operation and Maintenance Manuals'),
  ] satisfies ProgrammeMilestone[],
};

/** Calendar days from start to finish, counting both days, as the sheet states. */
export function durationDays(item: ProgrammeMilestone): number {
  return Math.round((day(item.plannedFinish).getTime() - day(item.plannedStart).getTime()) / 86_400_000) + 1;
}

export interface ProgrammeLayout {
  fileName: string;
  sheet: string;
  rows: TableRows;
  footerRow: number;
}

export function layoutProgramme(): ProgrammeLayout {
  const rows = placeTable(5, programme.milestones.length, { title: false, total: false });
  return { fileName: programme.fileName, sheet: programme.sheet, rows, footerRow: rows.end + 1 };
}

const COLUMNS: Column<ProgrammeMilestone>[] = [
  { header: 'ID', width: 8, value: (item) => item.id },
  { header: 'Milestone', width: 50, value: (item) => item.milestone },
  { header: 'Planned Start', width: 14, value: (item) => day(item.plannedStart), numFmt: DATE },
  { header: 'Planned Finish', width: 14, value: (item) => day(item.plannedFinish), numFmt: DATE },
  { header: 'Duration (days)', width: 11, value: (item) => durationDays(item), numFmt: WHOLE },
  { header: 'Responsible Party', width: 44, value: (item) => item.responsible },
  { header: 'Deliverable', width: 52, value: (item) => item.deliverable },
];

/** A milestone programme with real Excel dates and calendar-day durations. */
export async function writeProgrammeMilestones(layout: ProgrammeLayout): Promise<Uint8Array> {
  const issued = day(programme.dataDate);
  const workbook = createWorkbook(`${project.name} - Contract Programme - Key Milestones`, issued);
  const sheet = addSheet(workbook, layout.sheet, COLUMNS.map((column) => column.width), 'landscape');
  writeTitleBlock(sheet, [
    project.name,
    `Contract Programme - Key Milestones (${programme.revision})`,
    `Data date: ${longDate(issued)}. Durations are calendar days, counting the start and finish days.`,
  ]);
  writeTable(sheet, layout.rows, COLUMNS, programme.milestones);
  sheet.views = [{ state: 'frozen', ySplit: layout.rows.headerRow }];
  writeFooter(sheet, layout.footerRow);
  return saveWorkbook(workbook, issued);
}
