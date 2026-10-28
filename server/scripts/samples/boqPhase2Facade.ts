import type { BoqItem, BoqSection } from './lib/boqTypes';
import { day, longDate } from './lib/dates';
import { writePdfBoq, type GeneratedPdfBoq } from './lib/pdfBoqWriter';
import { contract, parties, project } from './project';

const item = (code: string, description: string, unit: string, quantity: number, rate: number): BoqItem => ({
  code,
  description,
  unit,
  quantity,
  rate,
});

export const boqPhase2 = {
  fileName: 'BOQ_Phase2_Facade.pdf',
  billNumber: 4,
  title: 'Facade Package',
  revision: 0,
  issueDate: '2026-09-14',
  currency: 'SAR',
  /** Exactly SAR 1,000,000.00: at the threshold, so not "above SAR 1M". */
  atThresholdItem: '4.2.05',
};

/** Bill No. 4 of Phase 2, the facade package. Arithmetic is correct throughout; 4.2.05 is exactly SAR 1,000,000.00. */
export const boqPhase2Sections: BoqSection[] = [
  {
    code: '4.1',
    title: 'PODIUM FEATURE FACADE (GROUND TO LEVEL 4)',
    items: [
      item(
        '4.1.01',
        'Natural granite cladding, 40 mm thick, flamed finish, fixed on stainless steel brackets and an aluminium subframe, including anchors, cutting and drilling',
        'm2',
        6_850,
        1_180,
      ),
      item(
        '4.1.02',
        'Glass fibre reinforced concrete (GRC) feature screens, 25 mm thick, geometric pattern inspired by traditional mashrabiya, on galvanised steel frames, including fixings',
        'm2',
        3_240,
        1_465,
      ),
      item(
        '4.1.03',
        'Shopfront glazing to retail units, 12 mm toughened laminated glass in structurally glazed aluminium frames',
        'm2',
        2_180,
        1_320,
      ),
      item('4.1.04', 'Aluminium soffit panels to the podium overhang, 3 mm, powder coated', 'm2', 1_140, 545),
      item(
        '4.1.05',
        'Aluminium louvre screens to the podium car park ventilation openings, powder coated, with insect mesh',
        'm2',
        1_460,
        640,
      ),
      item('4.1.06', 'Stainless steel feature trims to window heads and jambs', 'm', 3_950, 185),
      item('4.1.07', 'Mineral wool insulation, 100 mm thick, behind the cladding', 'm2', 6_850, 48.5),
      item('4.1.08', 'Fire barriers at slab edges and cavity closers at every floor', 'm', 2_240, 96),
      item('4.1.09', 'Breather membrane and vapour control layer behind the cladding', 'm2', 6_850, 22.75),
    ],
  },
  {
    code: '4.2',
    title: 'TOWER CROWN (LEVEL 26 TO ROOF)',
    items: [
      item(
        '4.2.01',
        'Structural steel framing to the crown, grade S355, including connections, shop primer and intumescent coating for 90 minutes fire resistance',
        't',
        418,
        9_850,
      ),
      item(
        '4.2.02',
        'Laminated glass fins, 2 x 12 mm heat-strengthened glass, 6 m high, with stainless steel shoes and silicone joints',
        'nr',
        264,
        4_780,
      ),
      item('4.2.03', 'Perforated aluminium panels to the crown screen, 3 mm, with a backlit pattern', 'm2', 1_920, 495),
      item('4.2.04', 'Crown access walkways, galvanised steel grating with safety rails', 'm', 380, 1_150),
      item(
        '4.2.05',
        'Architectural lighting to the crown: linear LED fittings, DMX controllers, drivers and cabling, complete',
        'item',
        1,
        1_000_000,
      ),
      item('4.2.06', 'Lightning protection bonding to the crown steelwork', 'item', 1, 86_500),
    ],
  },
  {
    code: '4.3',
    title: 'ENTRANCES AND CANOPIES',
    items: [
      item(
        '4.3.01',
        'Main entrance canopy, 18 m x 9 m, cantilevered steel structure with laminated glass roof, including drainage and lighting',
        'item',
        1,
        1_685_000,
      ),
      item('4.3.02', 'Automatic revolving doors, three-wing, 2.4 m diameter, with night shutters', 'nr', 4, 186_500),
      item('4.3.03', 'Automatic sliding doors, frameless glass, with safety sensors', 'nr', 8, 42_800),
      item('4.3.04', 'Secondary entrance canopies, aluminium with polycarbonate roof', 'nr', 3, 128_000),
      item('4.3.05', 'Frameless glass balustrade to podium terraces, 1.1 m high', 'm', 420, 1_240),
      item('4.3.06', 'Entrance matwells with stainless steel frames', 'nr', 12, 6_450),
      item('4.3.07', 'Backing panels for building signage at the entrances', 'm2', 96, 1_350),
    ],
  },
  {
    code: '4.4',
    title: 'EXTERNAL SHADING AND SCREENS',
    items: [
      item(
        '4.4.01',
        'Vertical aluminium fins, 450 mm deep, to the west and south elevations of Levels 5 to 16, including brackets',
        'm',
        4_860,
        395,
      ),
      item('4.4.02', 'Horizontal sunshades to the serviced apartment balconies, Levels 17 to 28', 'm', 2_140, 445),
      item('4.4.03', 'Acoustic louvres to plant rooms, 300 mm deep', 'm2', 640, 980),
      item('4.4.04', 'Perforated metal screening to rooftop plant', 'm2', 860, 610),
      item('4.4.05', 'Bird deterrent spikes and mesh to fins and ledges', 'm', 2_400, 38),
    ],
  },
  {
    code: '4.5',
    title: 'SEALANTS, TESTING AND ACCESS',
    items: [
      item('4.5.01', 'Silicone weather seals to all facade joints', 'm', 18_600, 24.5),
      item(
        '4.5.02',
        'Facade performance testing by an independent laboratory: air, water, structural and seismic tests on a full-size test panel',
        'item',
        1,
        465_000,
      ),
      item('4.5.03', 'Site water tests to installed facade joints, 5% of joints', 'nr', 120, 1_350),
      item('4.5.04', 'Thermal and condensation analysis, with reports', 'item', 1, 95_000),
      item('4.5.05', 'Mast climbing work platforms to the podium facade', 'month', 14, 38_500),
      item('4.5.06', 'Facade cleaning on completion', 'm2', 32_400, 4.25),
    ],
  },
  {
    code: '4.6',
    title: 'DESIGN, MOCK-UP AND SUBMITTALS',
    items: [
      item(
        '4.6.01',
        'Facade design development, shop drawings and structural calculations for every element in this Bill',
        'item',
        1,
        985_000,
      ),
      item('4.6.02', 'Visual mock-up of one podium bay with granite cladding and a GRC screen', 'item', 1, 285_000),
      item('4.6.03', 'Samples, prototypes and material testing', 'item', 1, 64_000),
      item('4.6.04', 'Operation and maintenance manuals and warranties for the facade', 'item', 1, 38_000),
    ],
  },
  {
    code: '4.7',
    title: 'FACADE PRELIMINARIES',
    items: [
      item('4.7.01', 'Facade subcontractor site establishment, offices and stores', 'month', 18, 24_500),
      item('4.7.02', 'Tower crane time allocated to facade installation', 'month', 12, 68_000),
      item('4.7.03', 'Facade engineer and installation supervisor on Site', 'month', 18, 32_000),
      item('4.7.04', 'Protection of the installed facade until handover', 'item', 1, 145_000),
      item('4.7.05', 'Temporary hoarding and protective gantries at street level during facade works', 'month', 16, 18_750),
      item('4.7.06', 'Removal of facade packaging and waste off Site', 'item', 1, 42_500),
    ],
  },
];

/** BOQ_Phase2_Facade.pdf: one bill that runs across three pages with the header, carried and brought forward lines. */
export async function buildBoqPhase2Facade(): Promise<GeneratedPdfBoq> {
  const issued = day(boqPhase2.issueDate);
  const pdf = await writePdfBoq({
    fileName: boqPhase2.fileName,
    title: `${project.name} - Bill of Quantities - Phase 2 - Bill No. ${boqPhase2.billNumber} ${boqPhase2.title}`,
    subject: `Contract No. ${contract.number}`,
    runningHeader: `${project.name}  |  Bill of Quantities - Phase 2  |  Bill No. ${boqPhase2.billNumber} - ${boqPhase2.title}  |  Revision ${boqPhase2.revision}`,
    heading: [
      { text: project.name, size: 15, bold: true },
      { text: 'Bill of Quantities - Phase 2', size: 12, bold: true },
      { text: `Bill No. ${boqPhase2.billNumber} - ${boqPhase2.title}: podium feature facade, tower crown and entrances`, size: 10.5 },
      { text: `Revision ${boqPhase2.revision}  |  Issued ${longDate(issued)}  |  Contract No. ${contract.number}`, size: 9 },
      { text: `Prepared by ${parties.engineer.name} for ${parties.employer.name}`, size: 9 },
    ],
    notes: [
      'All rates and amounts are in Saudi Riyals (SAR) and exclude Value Added Tax.',
      'Rates include supply, fabrication, delivery, installation, fixings, testing and protection. Quantities are measured net from the Drawings.',
      'The total of this Bill is carried to the Phase 2 Summary.',
    ],
    currency: boqPhase2.currency,
    issued,
    sections: boqPhase2Sections,
  });
  if (pdf.pageCount !== 3) throw new Error(`${boqPhase2.fileName} has ${pdf.pageCount} pages, not 3`);
  return pdf;
}
