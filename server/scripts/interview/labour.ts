import { addDays, day } from '../samples/lib/dates';
import { Random } from '../samples/lib/random';
import { addSheet, BOX, createWorkbook, DATE, HEADER_FILL, saveWorkbook, writeFooter } from '../samples/lib/workbook';
import { contract, project } from './project';

/**
 * Daily Labour Returns.xlsx: one row per date, shift, zone, trade and company from the Commencement Date to the
 * data date, 57,600 rows. Questions about a month must run SQL over every row.
 */
export const labour = {
  fileName: 'Daily Labour Returns.xlsx',
  sheet: 'Labour',
  from: '2026-03-15',
  to: '2026-09-30',
  shifts: ['Day', 'Night'],
  zones: ['W1', 'W2', 'W3', 'W4', 'External', 'Site-wide'],
  trades: ['Steel fixer', 'Carpenter', 'Mason', 'Labourer', 'Electrician', 'Plumber', 'Welder', 'Plant operator'],
  companies: ['Thuraya Build', 'Sahel Steel', 'Al Nakheel Manpower'],
  /** The question asks for entries with more overtime hours than this. */
  overtimeThreshold: 40,
  questionZone: 'W2',
  questionMonth: '2026-09',
};

export interface LabourFacts {
  rows: number;
  headerRow: number;
  firstRow: number;
  lastRow: number;
  month: {
    month: string;
    threshold: number;
    entriesOverThreshold: number;
    zone: string;
    zoneOvertimeTotal: number;
    totalOvertime: number;
    entries: number;
  };
}

const HEADERS = ['Date', 'Shift', 'Zone', 'Trade', 'Company', 'Workers', 'Normal Hours', 'Overtime Hours'];

export async function writeLabour(): Promise<{ bytes: Uint8Array; facts: LabourFacts }> {
  const issued = day(labour.to);
  const workbook = createWorkbook(`${project.name} - Daily Labour Returns`, issued);
  const sheet = addSheet(workbook, labour.sheet, [12, 8, 11, 15, 22, 9, 13, 15], 'landscape');
  sheet.getCell('A1').value = project.name;
  sheet.getCell('A1').font = { bold: true, size: 13 };
  sheet.getCell('A2').value = `Daily labour returns, 15 March to 30 September 2026, exported from the site diary (Contract No. ${contract.number})`;
  const headerRow = 4;
  HEADERS.forEach((label, index) => {
    const cell = sheet.getRow(headerRow).getCell(index + 1);
    cell.value = label;
    cell.font = { bold: true };
    cell.fill = HEADER_FILL;
    cell.border = BOX;
  });
  sheet.getColumn(1).numFmt = DATE;

  const random = new Random(9_031);
  const start = day(labour.from);
  const end = day(labour.to);
  const month = { entriesOverThreshold: 0, zoneOvertimeTotal: 0, totalOvertime: 0, entries: 0 };
  let rows = 0;
  for (let date = start; date.getTime() <= end.getTime(); date = addDays(date, 1)) {
    const inMonth = date.toISOString().startsWith(labour.questionMonth);
    for (const zone of labour.zones) {
      for (const trade of labour.trades) {
        for (const company of labour.companies) {
          for (const shift of labour.shifts) {
            const workers = random.int(2, 36);
            const draw = random.next();
            const perWorker = draw < 0.62 ? 0 : draw < 0.9 ? random.int(1, 8) * 0.5 : random.int(9, 12) * 0.5;
            const overtime = Math.round(workers * perWorker * 2) / 2;
            sheet.addRow([date, shift, zone, trade, company, workers, workers * 8, overtime]);
            rows++;
            if (inMonth) {
              month.entries++;
              month.totalOvertime += overtime;
              if (overtime > labour.overtimeThreshold) month.entriesOverThreshold++;
              if (zone === labour.questionZone) month.zoneOvertimeTotal += overtime;
            }
          }
        }
      }
    }
  }
  const firstRow = headerRow + 1;
  const lastRow = headerRow + rows;
  writeFooter(sheet, lastRow + 2);
  const facts: LabourFacts = {
    rows,
    headerRow,
    firstRow,
    lastRow,
    month: {
      month: labour.questionMonth,
      threshold: labour.overtimeThreshold,
      entriesOverThreshold: month.entriesOverThreshold,
      zone: labour.questionZone,
      zoneOvertimeTotal: Math.round(month.zoneOvertimeTotal * 2) / 2,
      totalOvertime: Math.round(month.totalOvertime * 2) / 2,
      entries: month.entries,
    },
  };
  return { bytes: await saveWorkbook(workbook, issued), facts };
}
