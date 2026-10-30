import type { BoqItem, BoqSection } from '../samples/lib/boqTypes';

const item = (code: string, description: string, unit: string, quantity: number, rate: number): BoqItem => ({
  code,
  description,
  unit,
  quantity,
  rate,
});

/** The Civil Works bill (one sheet). Item 1.05 is exactly SAR 1,000,000.00, at the threshold. */
export const civilSections: BoqSection[] = [
  {
    code: '1',
    title: 'PRELIMINARIES AND GENERAL',
    items: [
      item('1.01', 'Mobilisation, site establishment, offices, stores and welfare facilities', 'item', 1, 1_850_000),
      item('1.02', "Contractor's site management, supervision and engineering staff", 'month', 18, 185_000),
      item('1.03', 'Temporary power, water and telecoms for the duration of the Works', 'month', 18, 42_500),
      item('1.04', 'Site security, temporary fencing and gates during construction', 'month', 18, 18_200),
      item('1.05', 'Insurances, performance security and advance payment guarantee', 'item', 1, 1_000_000),
      item('1.06', 'Surveying, setting out and as-built surveys', 'item', 1, 236_000),
      item('1.07', 'Demobilisation and final site clearance on completion', 'item', 1, 148_000),
    ],
  },
  {
    code: '2',
    title: 'EARTHWORKS AND GROUND IMPROVEMENT',
    items: [
      item('2.01', 'Site clearance and grubbing, including disposal off Site', 'm2', 184_000, 2.85),
      item('2.02', 'Cut to formation level and cart away surplus material', 'm3', 96_500, 18.5),
      item('2.03', 'Imported engineered fill, placed and compacted in 300 mm layers', 'm3', 212_000, 38.75),
      item('2.04', 'Dynamic compaction of the warehouse footprints, two passes, including crater backfill', 'm2', 72_000, 46),
      item('2.05', 'Zone load tests and CPT verification after ground improvement', 'nr', 48, 9_800),
      item('2.06', 'Dewatering with wellpoints, including monitoring and discharge', 'item', 1, 684_000),
      item('2.07', 'Sub-base, 300 mm crushed aggregate, under the warehouse floor slabs', 'm2', 72_000, 34),
    ],
  },
  {
    code: '3',
    title: 'CONCRETE WORKS',
    items: [
      item('3.01', 'Blinding concrete grade C15, 75 mm thick', 'm2', 18_600, 29),
      item('3.02', 'Reinforced concrete grade C35/45 in pad foundations and tie beams', 'm3', 6_420, 715),
      item('3.03', 'Ground-bearing floor slabs, concrete grade C35/45, 200 mm thick, steel-fibre reinforced, power-floated finish', 'm2', 72_000, 164),
      item('3.04', 'High-yield steel reinforcement grade B500B, cut, bent and fixed', 't', 1_180, 3_380),
      item('3.05', 'Formwork to foundations, tie beams and slab edges', 'm2', 24_800, 76),
      item('3.06', 'Holding-down bolt assemblies, supplied and cast in', 'nr', 1_920, 318),
      item('3.07', 'Dock pits and loading-door thresholds, concrete grade C35/45', 'nr', 48, 14_500),
      item('3.08', 'Saw-cut joints to floor slabs, sealed', 'm', 21_600, 22.5),
      item('3.09', 'Concrete plinths and bases to the substation and the pump house', 'item', 1, 412_000),
    ],
  },
  {
    code: '4',
    title: 'ROADS, HARDSTANDINGS AND PAVING',
    items: [
      item('4.01', 'Sub-base, 250 mm crushed aggregate, to roads and hardstandings', 'm2', 84_000, 28),
      item('4.02', 'Heavy-duty concrete hardstanding, grade C40/50, 250 mm thick, to truck courts', 'm2', 42_000, 198),
      item('4.03', 'Asphalt base course, 70 mm thick', 'm2', 42_000, 48),
      item('4.04', 'Asphalt wearing course, 50 mm thick', 'm2', 42_000, 36),
      item('4.05', 'Precast concrete kerbs, bedded and haunched', 'm', 9_400, 86),
      item('4.06', 'Interlocking concrete paving to footpaths and car parking', 'm2', 7_800, 92),
      item('4.07', 'Road markings, traffic signs and wheel stops', 'item', 1, 196_000),
    ],
  },
  {
    code: '5',
    title: 'DRAINAGE',
    items: [
      item('5.01', 'Storm water pipes, uPVC, 300 mm to 900 mm diameter, laid and jointed in trenches', 'm', 6_200, 365),
      item('5.02', 'Precast manholes and catch basins, with covers', 'nr', 186, 7_850),
      item('5.03', 'Oil interceptors to the truck courts', 'nr', 6, 68_000),
      item('5.04', 'Foul drainage, uPVC, 160 mm to 300 mm diameter', 'm', 2_400, 285),
      item('5.05', 'Lifting station, complete with duty and standby pumps and controls', 'nr', 2, 486_000),
      item('5.06', 'Connection to the Park drainage network, including the outfall chamber', 'item', 1, 325_000),
    ],
  },
];

export const electricalSections: BoqSection[] = [
  {
    code: 'E',
    title: 'ELECTRICAL WORKS',
    items: [
      item('E.01', '13.8 kV substation: MV switchgear, two 2,500 kVA transformers, protection and civil interface', 'item', 1, 4_850_000),
      item('E.02', 'LV main distribution boards and sub-main panels', 'nr', 6, 215_000),
      item('E.03', 'MV and LV cables, laid in trenches and on cable trays, terminated', 'm', 38_000, 68),
      item('E.04', 'Warehouse high-bay LED luminaires with daylight and occupancy controls', 'nr', 1_840, 1_120),
      item('E.05', 'External lighting on 12 m columns, with feeder pillars', 'nr', 96, 9_400),
      item('E.06', 'Earthing and lightning protection to all buildings', 'item', 1, 386_000),
      item('E.07', 'Standby diesel generator, 1,000 kVA, with ATS and day tank', 'nr', 1, 985_000),
      item('E.08', 'Small power and lighting installations to the office pods', 'nr', 4, 142_000),
    ],
  },
];

export const mechanicalSections: BoqSection[] = [
  {
    code: 'M',
    title: 'MECHANICAL WORKS',
    items: [
      item('M.01', 'Warehouse ventilation: roof-mounted extract fans with weather louvres and controls', 'nr', 64, 24_500),
      item('M.02', 'VRF air conditioning systems to the office pods, complete', 'nr', 4, 318_000),
      item('M.03', 'Potable water network, booster pumps and 200 m3 storage tank', 'item', 1, 764_000),
      item('M.04', 'Plumbing and sanitary installations to the office pods and welfare blocks', 'nr', 4, 96_500),
      item('M.05', 'Building management system, including field devices and head end', 'item', 1, 428_000),
      item('M.06', 'Hydraulic dock levellers, 2.5 m x 2.0 m, 60 kN capacity', 'nr', 48, 38_500),
      item('M.07', 'Insulated sectional overhead loading doors with dock shelters', 'nr', 48, 21_800),
    ],
  },
];

export const fireSections: BoqSection[] = [
  {
    code: 'F',
    title: 'FIRE PROTECTION',
    items: [
      item('F.01', 'Fire water storage tanks, 2 x 900 m3, GRP sectional, on concrete bases', 'item', 1, 1_360_000),
      item('F.02', 'Fire pump house with diesel, electric and jockey pumps, controllers and pipework', 'item', 1, 1_125_000),
      item('F.03', 'ESFR sprinkler installation to the warehouses, including risers and alarm valves', 'm2', 72_000, 58),
      item('F.04', 'Fire hydrant ring main, 250 mm ductile iron, with hydrants and valves', 'm', 3_200, 412),
      item('F.05', 'Fire alarm and voice evacuation system, addressable', 'item', 1, 642_000),
      item('F.06', 'Portable fire extinguishers and hose reel cabinets', 'nr', 240, 1_150),
    ],
  },
];

export const externalSections: BoqSection[] = [
  {
    code: 'X.1',
    title: 'PERIMETER AND SECURITY',
    items: [
      item('X.1.01', 'Perimeter fence, 2.4 m high welded mesh on steel posts, with concrete plinth', 'm', 1_780, 485),
      item('X.1.02', 'Motorised sliding vehicle gates, 12 m clear opening', 'nr', 3, 128_000),
      item('X.1.03', 'Gatehouse, 36 m2, complete with services and finishes', 'item', 1, 465_000),
      item('X.1.04', 'Vehicle barriers, bollards and crash-rated gate at the main entrance', 'item', 1, 118_000),
    ],
  },
  {
    code: 'X.2',
    title: 'LANDSCAPING AND IRRIGATION',
    items: [
      item('X.2.01', 'Imported topsoil, 300 mm deep, to planted areas', 'm2', 14_500, 32),
      item('X.2.02', 'Trees, 3 m to 4 m high, supplied, planted and staked', 'nr', 420, 1_850),
      item('X.2.03', 'Shrubs and ground cover planting, including maintenance for 12 months', 'm2', 11_200, 96),
      item('X.2.04', 'Drip irrigation network with controllers and valves', 'm2', 14_500, 48),
      item('X.2.05', 'Treated sewage effluent connection and irrigation storage tank', 'item', 1, 286_000),
    ],
  },
  {
    code: 'X.3',
    title: 'EXTERNAL UTILITIES',
    items: [
      item('X.3.01', 'Street lighting ducts and draw pits', 'm', 4_600, 118),
      item('X.3.02', 'Telecom ducts and chambers', 'm', 4_600, 96),
      item('X.3.03', 'Irrigation and potable water mains, HDPE, 110 mm to 315 mm', 'm', 3_800, 342),
      item('X.3.04', 'Signage, flagpoles and site furniture', 'item', 1, 164_000),
    ],
  },
];
