/**
 * The invented project behind the interview rehearsal folder (samples/khobar-park): a second set of documents, in
 * other styles than samples/riyadh-tower, for questions Atlas has not seen. Everything is fictional. The BOQs decide
 * the contract price (boqs.ts); the contract carries their totals plus the provisional sums.
 */
import { dueDate as dueOn, dueText } from '../samples/lib/due';
import type { Due } from '../samples/project';

export const OUT_FOLDER = 'samples/khobar-park';
export const EXPECTED_FILE = 'samples/khobar-park-expected.json';
export const CORRESPONDENCE_FOLDER = 'Correspondence';

export type { Due };

export const project = {
  name: 'Al Khobar Coastal Logistics Park - Package 2',
  code: 'KLP-P2',
  location: 'Plot 12, Al Khobar Industrial Zone, Eastern Province, Kingdom of Saudi Arabia',
  description:
    'four steel-framed warehouses (W1 to W4) of about 18,000 m2 each with office pods, internal roads and truck courts, storm and foul drainage, fire water and potable water systems, a 13.8 kV substation and landscaping, on a plot of 184,000 m2',
};

export interface Party {
  role: string;
  name: string;
  address: string;
  representative: string;
}

export const parties = {
  employer: {
    role: 'Employer',
    name: 'Bahr Line Industrial Development Company',
    address: 'Prince Turki Street, Al Khobar, Kingdom of Saudi Arabia',
    representative: 'Eng. Khalid Al-Dossary, Development Director',
  },
  contractor: {
    role: 'Contractor',
    name: 'Thuraya Build Contracting Company',
    address: 'Dammam Second Industrial City, Kingdom of Saudi Arabia',
    representative: 'Eng. Rami Haddad, Project Manager',
  },
  engineer: {
    role: 'Engineer',
    name: 'Rakeen Consulting Engineers',
    address: 'King Fahd Road, Al Khobar, Kingdom of Saudi Arabia',
    representative: 'Eng. Noura Al-Shehri, Resident Engineer',
  },
  steel: {
    role: 'Subcontractor',
    name: 'Sahel Steel Structures Factory',
    address: 'Jubail Industrial City 2, Kingdom of Saudi Arabia',
    representative: 'Mr. Tariq Mansour, General Manager',
  },
} satisfies Record<string, Party>;

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
  fileName: 'Contract Agreement - Package 2.pdf',
  number: 'KLP-P2-2026-007',
  title: 'Contract Agreement for Package 2: Warehouses W1 to W4 and Infrastructure',
  letterOfAcceptance: '2026-02-22',
  agreementDate: '2026-03-05',
  commencement: '2026-03-15',
  timeForCompletionDays: 548,
  /** Commencement plus 548 days; index.ts checks the arithmetic. */
  completion: '2027-09-14',
  /** Added to the BOQ totals to make the Contract Price. */
  provisionalSums: 3_500_000,
  vatPercent: 15,
  advancePayment: { percent: 15, recoveryPercent: 20 },
  retention: { percent: 10, limitPercent: 5, releasedAtTakingOverPercent: 50 },
  performanceSecurityPercent: 10,
  liquidatedDamages: { perDay: 48_000, limitPercent: 10 },
  defectsNotificationDays: 365,
  payment: { statementDay: 28, certifyWithinDays: 21, payWithinDays: 42 },
  scope: [
    'Site preparation, grading, dewatering and ground improvement by dynamic compaction across the whole Package 2 area.',
    'Reinforced concrete pad foundations, tie beams and ground-bearing floor slabs for Warehouses W1 to W4.',
    "Structural steel portal frames, purlins and roof bracing for the four warehouses, through the Contractor's steel subcontractor.",
    'Insulated metal roof and wall cladding, roof lights, smoke vents and rainwater goods.',
    'Dock levellers, 48 sectional loading doors with shelters, and the loading canopies.',
    'Internal roads, truck courts, hardstandings, car parking and the gatehouse.',
    'Storm water drainage, foul drainage, two lifting stations and the outfall to the Park network.',
    'Potable water network, fire water tanks and pump house, and ESFR sprinkler systems to the warehouses.',
    '13.8 kV substation with two transformers, LV distribution, lighting, lightning protection and earthing.',
    'VRF air conditioning to the office pods, warehouse ventilation and the building management system.',
    'Fire alarm, voice evacuation, CCTV, access control and structured cabling.',
    'Perimeter fence and gates, landscaping and irrigation, testing, commissioning and handover documentation.',
  ],
  exclusions: [
    'Racking, conveyors and warehouse management systems, which the tenants install.',
    'Fit-out of the office pods beyond the shell, services and finishes described in the Specification.',
    'The 33 kV supply to the Package 2 substation and the utility connection fees, which the Employer pays.',
  ],
  milestones: [
    { id: 'M1', title: 'Mobilisation complete and site established', due: { kind: 'afterCommencement', days: 28 } },
    { id: 'M2', title: 'Ground improvement complete in all zones', due: { kind: 'date', date: '2026-07-31' } },
    { id: 'M3', title: 'Steel erection complete, Warehouse W1', due: { kind: 'date', date: '2026-11-30' } },
    { id: 'M4', title: 'Roof and wall cladding complete, all four warehouses', due: { kind: 'date', date: '2027-04-30' } },
    { id: 'M5', title: 'Substation energised', due: { kind: 'date', date: '2027-06-15' } },
    { id: 'M6', title: 'Taking-Over of the Works', due: { kind: 'date', date: '2027-09-14' } },
  ] satisfies Milestone[],
  deliverables: [
    { id: 'D1', name: 'Baseline Programme in Primavera P6 format', due: { kind: 'afterCommencement', days: 21 } },
    { id: 'D2', name: 'Health, Safety and Environment Plan', due: { kind: 'afterCommencement', days: 14 } },
    { id: 'D3', name: 'Quality Plan and Inspection and Test Plans', due: { kind: 'afterCommencement', days: 28 } },
    { id: 'D4', name: 'Monthly Progress Report', due: { kind: 'recurring', text: 'by the 5th day of each month' } },
    { id: 'D5', name: 'Structural steel shop drawings, Warehouse W1', due: { kind: 'date', date: '2026-06-30' } },
    { id: 'D6', name: 'ESFR sprinkler design for Civil Defence approval', due: { kind: 'date', date: '2026-09-30' } },
    { id: 'D7', name: 'Testing and Commissioning Plan', due: { kind: 'date', date: '2027-05-31' } },
    { id: 'D8', name: 'As-built drawings and operation and maintenance manuals', due: { kind: 'date', date: '2027-09-14' } },
  ] satisfies Deliverable[],
};

/** The calendar date a due falls on, counted from the Commencement Date; null for a recurring one. */
export function dueDate(due: Due): string | null {
  return dueOn(due, contract.commencement);
}

export { dueText };
