import { day, longDate } from '../samples/lib/dates';
import { placeTable, writeTable, writeTitleBlock, type Column, type TableRows } from '../samples/lib/tableSheet';
import { addSheet, createWorkbook, DATE, saveWorkbook, WHOLE, writeFooter } from '../samples/lib/workbook';
import { contract, project } from './project';

export interface Activity {
  id: string;
  activity: string;
  zone: string;
  /** YYYY-MM-DD. */
  start: string;
  finish: string;
  /** At the data date, 0 to 100. */
  percentComplete: number;
  predecessors: string;
}

const act = (id: string, activity: string, zone: string, start: string, finish: string, percentComplete: number, predecessors = ''): Activity => ({
  id,
  activity,
  zone,
  start,
  finish,
  percentComplete,
  predecessors,
});

/**
 * Project Schedule - Baseline Rev 1.xlsx. Three activities (A370, A390, A400) finish after the contract completion
 * date of 14 September 2027; the last one matches the 30 October 2027 the EOT letter asks for.
 */
export const schedule = {
  fileName: 'Project Schedule - Baseline Rev 1.xlsx',
  sheet: 'Schedule',
  revision: 'Revision 1',
  dataDate: '2026-09-30',
  activities: [
    act('A010', 'Mobilisation and site establishment', 'Site-wide', '2026-03-15', '2026-04-12', 100),
    act('A020', 'Baseline programme, HSE plan and quality plan', 'Site-wide', '2026-03-15', '2026-04-05', 100),
    act('A030', 'Site clearance and grubbing', 'Site-wide', '2026-03-22', '2026-04-25', 100, 'A010'),
    act('A040', 'Cut to formation, Zones A and B', 'Zone A/B', '2026-04-06', '2026-05-20', 100, 'A030'),
    act('A050', 'Cut to formation, Zone C (after late handover)', 'Zone C', '2026-05-04', '2026-06-15', 100, 'A030'),
    act('A060', 'Engineered fill, Zones A and B', 'Zone A/B', '2026-05-01', '2026-06-30', 100, 'A040'),
    act('A070', 'Engineered fill, Zone C', 'Zone C', '2026-06-08', '2026-07-31', 100, 'A050'),
    act('A080', 'Dynamic compaction, W1 and W2 footprints', 'Zone A', '2026-06-01', '2026-07-15', 100, 'A060'),
    act('A090', 'Dynamic compaction, W3 and W4 footprints', 'Zone B/C', '2026-07-06', '2026-08-31', 100, 'A070'),
    act('A100', 'Zone load tests and CPT verification', 'Site-wide', '2026-07-16', '2026-09-10', 90, 'A080, A090'),
    act('A110', 'Foundations and tie beams, W1', 'W1', '2026-07-20', '2026-09-05', 100, 'A080'),
    act('A120', 'Foundations and tie beams, W2', 'W2', '2026-08-10', '2026-09-30', 80, 'A080'),
    act('A130', 'Foundations and tie beams, W3', 'W3', '2026-09-01', '2026-10-25', 35, 'A090'),
    act('A140', 'Foundations and tie beams, W4', 'W4', '2026-09-21', '2026-11-15', 10, 'A090'),
    act('A150', 'Steel erection, W1', 'W1', '2026-09-07', '2026-11-30', 45, 'A110'),
    act('A160', 'Steel erection, W2', 'W2', '2026-11-02', '2027-01-31', 0, 'A120, A150'),
    act('A170', 'Steel erection, W3', 'W3', '2027-01-04', '2027-03-31', 0, 'A130, A160'),
    act('A180', 'Steel erection, W4', 'W4', '2027-02-15', '2027-04-30', 0, 'A140, A170'),
    act('A190', 'Ground floor slab, W1', 'W1', '2026-10-05', '2026-12-20', 0, 'A150'),
    act('A200', 'Ground floor slab, W2', 'W2', '2026-12-01', '2027-02-15', 0, 'A160'),
    act('A210', 'Ground floor slab, W3', 'W3', '2027-02-01', '2027-04-15', 0, 'A170'),
    act('A220', 'Ground floor slab, W4', 'W4', '2027-03-15', '2027-05-31', 0, 'A180'),
    act('A230', 'Roof and wall cladding, W1', 'W1', '2026-12-01', '2027-02-28', 0, 'A150'),
    act('A240', 'Roof and wall cladding, W2', 'W2', '2027-02-01', '2027-04-15', 0, 'A160'),
    act('A250', 'Roof and wall cladding, W3', 'W3', '2027-03-15', '2027-05-31', 0, 'A170'),
    act('A260', 'Roof and wall cladding, W4', 'W4', '2027-04-20', '2027-06-30', 0, 'A180'),
    act('A270', 'Dock levellers and loading doors, all warehouses', 'W1 to W4', '2027-03-01', '2027-07-15', 0, 'A190, A200, A210, A220'),
    act('A280', 'Office pods: shell, services and finishes', 'W1 to W4', '2027-03-15', '2027-08-15', 0, 'A230, A240, A250, A260'),
    act('A290', 'Storm water and foul drainage', 'External', '2026-08-17', '2027-01-31', 30, 'A060'),
    act('A300', 'Fire water tanks and pump house', 'External', '2026-11-16', '2027-04-30', 0, 'A290'),
    act('A310', 'ESFR sprinkler installation', 'W1 to W4', '2027-01-18', '2027-07-31', 0, 'A230, A300'),
    act('A320', 'Electrical installation, warehouses', 'W1 to W4', '2027-01-04', '2027-08-15', 0, 'A230'),
    act('A330', 'Roads, truck courts and hardstandings', 'External', '2027-02-01', '2027-07-31', 0, 'A290'),
    act('A340', 'Landscaping and irrigation', 'External', '2027-05-03', '2027-08-31', 0, 'A330'),
    act('A350', 'Perimeter fence and gatehouse', 'External', '2027-04-05', '2027-07-15', 0, 'A330'),
    act('A360', 'Substation building and switchgear installation', 'External', '2027-01-11', '2027-07-30', 0, 'A290'),
    act('A370', 'Substation energisation and utility connection', 'External', '2027-08-02', '2027-09-28', 0, 'A360'),
    act('A380', 'Mechanical installation and BMS', 'W1 to W4', '2027-02-15', '2027-08-31', 0, 'A230'),
    act('A390', 'Testing and commissioning, all systems', 'Site-wide', '2027-08-16', '2027-10-20', 0, 'A310, A320, A370, A380'),
    act('A400', 'Snagging, as-built drawings and handover', 'Site-wide', '2027-10-04', '2027-10-30', 0, 'A390'),
    act('M000', 'Contract completion date (milestone)', 'Site-wide', '2027-09-14', '2027-09-14', 0),
  ] satisfies Activity[],
};

/** Calendar days from start to finish, counting both days. */
export function durationDays(activity: Activity): number {
  return Math.round((day(activity.finish).getTime() - day(activity.start).getTime()) / 86_400_000) + 1;
}

export interface LateActivity {
  id: string;
  activity: string;
  finish: string;
  daysLate: number;
  row: number;
}

/** Activities whose finish is after the contract completion date, with their Excel rows. */
export function lateActivities(rows: TableRows): LateActivity[] {
  const completion = day(contract.completion).getTime();
  return schedule.activities.flatMap((activity, index) => {
    const finish = day(activity.finish).getTime();
    if (finish <= completion) return [];
    return [{ id: activity.id, activity: activity.activity, finish: activity.finish, daysLate: Math.round((finish - completion) / 86_400_000), row: rows.firstRow + index }];
  });
}

const COLUMNS: Column<Activity>[] = [
  { header: 'ID', width: 8, value: (item) => item.id },
  { header: 'Activity', width: 48, value: (item) => item.activity },
  { header: 'Zone', width: 11, value: (item) => item.zone },
  { header: 'Start', width: 13, value: (item) => day(item.start), numFmt: DATE },
  { header: 'Finish', width: 13, value: (item) => day(item.finish), numFmt: DATE },
  { header: 'Duration (days)', width: 10, value: (item) => durationDays(item), numFmt: WHOLE },
  { header: '% Complete', width: 10, value: (item) => item.percentComplete, numFmt: WHOLE },
  { header: 'Predecessors', width: 24, value: (item) => item.predecessors },
];

export async function writeSchedule(): Promise<{ bytes: Uint8Array; rows: TableRows }> {
  const issued = day(schedule.dataDate);
  const workbook = createWorkbook(`${project.name} - Project Schedule`, issued);
  const sheet = addSheet(workbook, schedule.sheet, COLUMNS.map((column) => column.width), 'landscape');
  writeTitleBlock(sheet, [
    project.name,
    `Baseline Programme - ${schedule.revision}`,
    `Contract No. ${contract.number}. Data date ${longDate(issued)}. Contract completion date ${longDate(day(contract.completion))}.`,
  ]);
  const rows = placeTable(5, schedule.activities.length, { title: false, total: false });
  writeTable(sheet, rows, COLUMNS, schedule.activities);
  writeFooter(sheet, rows.end + 1);
  return { bytes: await saveWorkbook(workbook, issued), rows };
}
