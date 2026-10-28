/**
 * The invented project every sample document describes. All names are fictional; no real company
 * document was used. The contract, the BOQs and expected.json all read from here.
 */

export const FOOTER_TEXT = 'Fictional sample document generated for testing Atlas.';

/** Where the generated folder lives, relative to the repo root. */
export const SAMPLE_FOLDER = 'samples/riyadh-tower';

export const project = {
  name: 'Najd Gate Mixed-Use Tower',
  code: 'NGT',
  location: 'Plot 7, Al Malqa District, Riyadh, Kingdom of Saudi Arabia',
  description:
    'a 28-storey mixed-use tower above three basement levels, with a four-storey retail podium, offices on Levels 5 to 16 and serviced apartments on Levels 17 to 28',
};

export interface Party {
  role: string;
  name: string;
  address: string;
  registration: string;
  representative: string;
}

export const parties = {
  employer: {
    role: 'Employer',
    name: 'Sarab Crest Real Estate Development Company',
    address: 'Al Olaya District, Riyadh, Kingdom of Saudi Arabia',
    registration: 'Commercial Registration No. SAMPLE-0001 (fictional)',
    representative: 'Eng. Faisal Al-Harbi, Projects Director',
  },
  contractor: {
    role: 'Contractor',
    name: 'Qimam Ridge Contracting Company',
    address: 'Second Industrial City, Riyadh, Kingdom of Saudi Arabia',
    registration: 'Commercial Registration No. SAMPLE-0002 (fictional)',
    representative: 'Eng. Omar Al-Qahtani, Managing Director',
  },
  engineer: {
    role: 'Engineer',
    name: 'Dune Line Engineering Consultants',
    address: 'King Abdulaziz Road, Riyadh, Kingdom of Saudi Arabia',
    registration: 'Professional Licence No. SAMPLE-0003 (fictional)',
    representative: 'Eng. Lina Al-Mutairi, Resident Engineer',
  },
} satisfies Record<string, Party>;

/** A due date either fixed in the calendar or counted from the Commencement Date. */
export type Due =
  | { kind: 'date'; date: string }
  | { kind: 'afterCommencement'; days: number }
  | { kind: 'recurring'; text: string };

export interface Milestone {
  id: string;
  title: string;
  due: Due;
}

export interface Deliverable {
  id: string;
  name: string;
  due: Due;
}

export const contract = {
  fileName: 'Contract_Main_Works.pdf',
  number: 'NGT-MW-2026-001',
  title: 'Contract Agreement for the Main Works',
  letterOfAcceptance: '2026-01-04',
  contractDate: { date: '2026-01-18', hijri: '29 Rajab 1447 AH' },
  commencement: { date: '2026-02-01', hijri: "13 Sha'ban 1447 AH" },
  price: {
    amount: 187_462_350,
    currency: 'SAR',
    words: 'One Hundred and Eighty-Seven Million, Four Hundred and Sixty-Two Thousand, Three Hundred and Fifty Saudi Riyals',
    shortText: 'SAR 187.5M',
  },
  vatPercent: 15,
  timeForCompletionMonths: 30,
  defectsNotificationMonths: 12,
  performanceSecurityPercent: 10,
  advancePayment: { percent: 10, recoveryPercent: 15, paidWithinDays: 21 },
  payment: { statementDay: 25, certifyWithinDays: 28, payWithinDays: 30, finalPayWithinDays: 56 },
  designReviewDays: 21,
  retention: { percentOfEachPayment: 10, limitPercentOfPrice: 5, releasedAtTakingOverPercent: 50 },
  liquidatedDamages: { perDay: 125_000, limitPercentOfPrice: 10 },
  scope: [
    'Site clearance, hoarding, site offices and enabling works for the whole Site.',
    'Secant pile shoring, temporary ground anchors and dewatering for a three-level basement.',
    'Bulk excavation to formation level and disposal of excavated material off Site.',
    'Bored cast-in-place piles, pile testing, pile caps and the basement raft foundation.',
    'Basement walls, slabs and ramps, including waterproofing and its protection.',
    'Reinforced and post-tensioned concrete superstructure from ground floor to the Level 28 roof.',
    'Unitised curtain wall facade, podium cladding and external shading fins, including a visual mock-up.',
    'Blockwork walls, partitions, stairs, balustrades and metalwork.',
    'Mechanical works: chilled water plant, air handling, ventilation and smoke control.',
    'Electrical works: low voltage switchboards, standby generators, busbar risers, lighting and earthing.',
    'Plumbing, drainage, water storage and fire protection systems.',
    'Vertical transportation: 14 passenger lifts, 2 service lifts and 4 escalators.',
    'Roof works and the building maintenance unit.',
    'Testing, commissioning and handover, including as-built drawings and operation and maintenance manuals.',
  ],
  exclusions: [
    'Fit-out of retail units, offices and serviced apartments, which will be let under separate contracts.',
    'Loose furniture, artwork and IT active equipment.',
    'Utility connection fees payable to the electricity, water and telecom authorities.',
  ],
  milestones: [
    { id: 'M1', title: 'Baseline Programme accepted by the Engineer', due: { kind: 'afterCommencement', days: 28 } },
    { id: 'M2', title: 'Design Submission 1 (shoring, piling and substructure)', due: { kind: 'date', date: '2026-04-15' } },
    { id: 'M3', title: 'Design Submission 2 (superstructure, facade and MEP)', due: { kind: 'date', date: '2026-08-31' } },
    { id: 'M4', title: 'Facade visual mock-up completed and approved', due: { kind: 'date', date: '2026-11-30' } },
    { id: 'M5', title: 'Basement raft foundation completed', due: { kind: 'date', date: '2027-03-31' } },
    { id: 'M6', title: 'Topping out: Level 28 roof slab cast', due: { kind: 'date', date: '2027-12-15' } },
    { id: 'M7', title: 'MEP testing and commissioning started', due: { kind: 'date', date: '2028-03-01' } },
    { id: 'M8', title: 'MEP testing and commissioning completed', due: { kind: 'date', date: '2028-05-31' } },
    { id: 'M9', title: 'Handover: Taking-Over of the Works', due: { kind: 'date', date: '2028-07-31' } },
  ] satisfies Milestone[],
  deliverables: [
    { id: 'D1', name: 'Baseline Programme in Primavera P6 format', due: { kind: 'afterCommencement', days: 28 } },
    { id: 'D2', name: 'Health, Safety and Environment Plan', due: { kind: 'afterCommencement', days: 14 } },
    { id: 'D3', name: 'Quality Management Plan', due: { kind: 'afterCommencement', days: 28 } },
    { id: 'D4', name: 'Monthly Progress Report', due: { kind: 'recurring', text: 'by the 7th day of each month' } },
    { id: 'D5', name: 'Design Submission 1 drawings and calculations', due: { kind: 'date', date: '2026-04-15' } },
    { id: 'D6', name: 'Design Submission 2 drawings, calculations and specifications', due: { kind: 'date', date: '2026-08-31' } },
    { id: 'D7', name: 'Facade Mock-up Test Report', due: { kind: 'date', date: '2026-12-14' } },
    { id: 'D8', name: 'MEP Testing and Commissioning Plan', due: { kind: 'date', date: '2027-12-01' } },
    { id: 'D9', name: 'As-built Drawings', due: { kind: 'date', date: '2028-07-31' } },
    { id: 'D10', name: 'Operation and Maintenance Manuals', due: { kind: 'date', date: '2028-07-31' } },
  ] satisfies Deliverable[],
};
