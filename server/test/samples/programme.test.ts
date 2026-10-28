import ExcelJS from 'exceljs';
import { beforeAll, describe, expect, it } from 'vitest';
import { buildContractMainWorks } from '../../scripts/samples/contractMainWorks';
import { programmeFacts } from '../../scripts/samples/expectedTables';
import { day } from '../../scripts/samples/lib/dates';
import { layoutProgramme, writeProgrammeMilestones } from '../../scripts/samples/programmeMilestones';

const layout = layoutProgramme();
let facts: ReturnType<typeof programmeFacts>;
let sheet: ExcelJS.Worksheet;

beforeAll(async () => {
  facts = programmeFacts(layout, await buildContractMainWorks());
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load((await writeProgrammeMilestones(layout)) as unknown as ExcelJS.Buffer);
  sheet = workbook.getWorksheet('Programme')!;
});

describe('Programme_Milestones.xlsx', () => {
  it('has the programme header with milestone, dates, duration, responsible party and deliverable', () => {
    expect((sheet.getRow(facts.headerRow).values as unknown[]).slice(1)).toEqual([
      'ID',
      'Milestone',
      'Planned Start',
      'Planned Finish',
      'Duration (days)',
      'Responsible Party',
      'Deliverable',
    ]);
  });

  it('stores planned dates as real Excel dates and durations as numbers', () => {
    expect(facts.milestones.length).toBeGreaterThanOrEqual(10);
    for (const m of facts.milestones) {
      const row = m.source.rowFrom;
      expect(sheet.getCell(`A${row}`).value).toBe(m.id);
      expect(sheet.getCell(`C${row}`).value).toEqual(day(m.plannedStart));
      expect(sheet.getCell(`D${row}`).value).toEqual(day(m.plannedFinish));
      expect(sheet.getCell(`C${row}`).numFmt).toBe('dd-mmm-yyyy');
      expect(sheet.getCell(`E${row}`).value).toBe(m.durationDays);
      expect(m.durationDays).toBe((day(m.plannedFinish).getTime() - day(m.plannedStart).getTime()) / 86_400_000 + 1);
      expect(sheet.getCell(`F${row}`).value).toBe(m.responsibleParty);
      expect(sheet.getCell(`G${row}`).value).toBe(m.deliverable);
    }
  });

  it('matches every contract milestone date except the planted M6 slip of 14 days', () => {
    expect(facts.againstContract.map((m) => m.id)).toEqual(['M1', 'M2', 'M3', 'M4', 'M5', 'M6', 'M7', 'M8', 'M9']);
    const late = facts.againstContract.filter((m) => m.status === 'late');
    expect(late.map((m) => [m.id, m.daysAfterContractDate])).toEqual([['M6', 14]]);
    expect(facts.againstContract.filter((m) => m.id !== 'M6').every((m) => m.daysAfterContractDate === 0)).toBe(true);
  });
});
