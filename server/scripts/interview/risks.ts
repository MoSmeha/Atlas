import { day, longDate } from '../samples/lib/dates';
import { placeTable, writeTable, writeTitleBlock, type Column, type TableRows } from '../samples/lib/tableSheet';
import { addSheet, createWorkbook, saveWorkbook, WHOLE, writeFooter } from '../samples/lib/workbook';
import { contract, project } from './project';

export interface Risk {
  id: string;
  risk: string;
  category: string;
  likelihood: number;
  impact: number;
  owner: string;
  mitigation: string;
  status: string;
}

const risk = (id: string, text: string, category: string, likelihood: number, impact: number, owner: string, mitigation: string, status = 'Open'): Risk => ({
  id,
  risk: text,
  category,
  likelihood,
  impact,
  owner,
  mitigation,
  status,
});

export const HIGH_SCORE = 15;
export const MEDIUM_SCORE = 8;

export function riskScore(item: Risk): number {
  return item.likelihood * item.impact;
}

export function riskRating(score: number): 'High' | 'Medium' | 'Low' {
  return score >= HIGH_SCORE ? 'High' : score >= MEDIUM_SCORE ? 'Medium' : 'Low';
}

/** Risk Register.xlsx: eighteen risks; five score 15 or more and are rated High. */
export const risks = {
  fileName: 'Risk Register.xlsx',
  sheet: 'Risks',
  reviewed: '2026-10-01',
  items: [
    risk('R-01', 'Fuel and bitumen price escalation', 'Commercial', 3, 2, 'Commercial Manager, Thuraya Build', 'Fixed-price supply agreements for asphalt and diesel'),
    risk('R-02', 'Shortage of skilled steel erectors in the Eastern Province', 'Resource', 3, 3, 'General Manager, Sahel Steel', 'Second erection crew mobilised from Jubail'),
    risk('R-03', 'Late handover of Zone C delays ground improvement and Warehouses W3 and W4', 'Employer', 5, 4, 'Development Director, Bahr Line', 'Relocate the neighbouring fence; resequence W1 and W2 first'),
    risk('R-04', 'Groundwater higher than the geotechnical report', 'Ground', 2, 4, 'Construction Manager, Thuraya Build', 'Additional wellpoints on standby; monitoring wells'),
    risk('R-05', 'Rejected concrete because of reinforcement errors', 'Quality', 3, 3, 'Quality Manager, Thuraya Build', 'Pre-pour inspection with the Engineer; rebar fixer training'),
    risk('R-06', 'Customs delay on the imported dock levellers', 'Procurement', 3, 3, 'Procurement Manager, Thuraya Build', 'Order 8 weeks earlier; pre-clearance with the customs broker'),
    risk('R-07', 'Structural steel delivery slips because of mill capacity', 'Procurement', 4, 4, 'General Manager, Sahel Steel', 'Reserve mill slots; split supply between two mills'),
    risk('R-08', 'Design changes to the office pods by the Employer', 'Scope', 3, 2, 'Resident Engineer, Rakeen', 'Freeze the pod layouts by 30 November 2026'),
    risk('R-09', 'Civil Defence approval of the ESFR sprinkler design delayed', 'Approvals', 3, 5, 'MEP Manager, Thuraya Build', 'Pre-submission meeting with Civil Defence; third-party review'),
    risk('R-10', 'Sand storms stop cladding works', 'Weather', 2, 2, 'Site Agent, Thuraya Build', 'Weather allowance in the programme; secure stacked sheets'),
    risk('R-11', 'Cash flow strain from late payment certificates', 'Commercial', 2, 3, 'Commercial Manager, Thuraya Build', 'Statements submitted on the 28th; weekly follow-up'),
    risk('R-12', 'Summer heat limits concrete pouring hours', 'Weather', 5, 3, 'Construction Manager, Thuraya Build', 'Night pours June to September; chilled water and ice in the mix'),
    risk('R-13', '33 kV supply by the Park not ready for energisation', 'Interface', 3, 4, 'Development Director, Bahr Line', 'Monthly interface meeting with the Park operator; generator standby'),
    risk('R-14', 'Fill quantities differ after the re-survey', 'Ground', 2, 3, 'Quantity Surveyor, Rakeen', 'Joint survey before and after cut and fill'),
    risk('R-15', "Dynamic compaction vibration damages the neighbouring plot's fence and services", 'Third party', 4, 4, 'Site Agent, Thuraya Build', 'Vibration monitoring; trial strip at reduced energy near the boundary'),
    risk('R-16', 'Cladding colour and profile not approved in time', 'Approvals', 2, 2, 'Architect, Rakeen', 'Samples submitted with the shop drawings'),
    risk('R-17', "Traffic conflicts on the Park's shared access road", 'Logistics', 3, 2, 'Site Agent, Thuraya Build', 'Traffic management plan agreed with the Park operator'),
    risk('R-18', 'Currency movement on the EUR and USD quotations', 'Commercial', 3, 3, 'Procurement Manager, Thuraya Build', 'Fix the exchange rate at order; hedge the EUR package'),
  ] satisfies Risk[],
};

export interface HighRisk {
  id: string;
  risk: string;
  score: number;
  owner: string;
  row: number;
}

export function highRisks(rows: TableRows): HighRisk[] {
  return risks.items.flatMap((item, index) => {
    const score = riskScore(item);
    return riskRating(score) === 'High' ? [{ id: item.id, risk: item.risk, score, owner: item.owner, row: rows.firstRow + index }] : [];
  });
}

const COLUMNS: Column<Risk>[] = [
  { header: 'ID', width: 7, value: (item) => item.id },
  { header: 'Risk', width: 54, value: (item) => item.risk },
  { header: 'Category', width: 13, value: (item) => item.category },
  { header: 'Likelihood (1-5)', width: 11, value: (item) => item.likelihood, numFmt: WHOLE },
  { header: 'Impact (1-5)', width: 11, value: (item) => item.impact, numFmt: WHOLE },
  { header: 'Score', width: 8, value: (item, row) => ({ formula: `D${row}*E${row}`, result: riskScore(item) }), numFmt: WHOLE },
  {
    header: 'Rating',
    width: 9,
    value: (item, row) => ({ formula: `IF(F${row}>=${HIGH_SCORE},"High",IF(F${row}>=${MEDIUM_SCORE},"Medium","Low"))`, result: riskRating(riskScore(item)) }),
  },
  { header: 'Owner', width: 34, value: (item) => item.owner },
  { header: 'Mitigation', width: 54, value: (item) => item.mitigation },
  { header: 'Status', width: 8, value: (item) => item.status },
];

export async function writeRisks(): Promise<{ bytes: Uint8Array; rows: TableRows }> {
  const issued = day(risks.reviewed);
  const workbook = createWorkbook(`${project.name} - Risk Register`, issued);
  const sheet = addSheet(workbook, risks.sheet, COLUMNS.map((column) => column.width), 'landscape');
  writeTitleBlock(sheet, [
    project.name,
    'Risk Register',
    `Contract No. ${contract.number}. Reviewed ${longDate(issued)}. Score = Likelihood x Impact; High is ${HIGH_SCORE} or more, Medium ${MEDIUM_SCORE} to ${HIGH_SCORE - 1}, Low under ${MEDIUM_SCORE}.`,
  ]);
  const rows = placeTable(5, risks.items.length, { title: false, total: false });
  writeTable(sheet, rows, COLUMNS, risks.items);
  writeFooter(sheet, rows.end + 1);
  return { bytes: await saveWorkbook(workbook, issued), rows };
}
