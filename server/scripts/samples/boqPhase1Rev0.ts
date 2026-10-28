import type { BoqItem, BoqRevision } from './lib/boqTypes';

const item = (code: string, description: string, unit: string, quantity: number, rate: number): BoqItem => ({
  code,
  description,
  unit,
  quantity,
  rate,
});

/** Same as `item`, but the amount cell holds a typed value instead of the formula: a planted arithmetic error. */
const wrongAmount = (base: BoqItem, typedAmount: number): BoqItem => ({ ...base, typedAmount });

/**
 * BOQ_Phase1_Rev0.xlsx, the tender Bill of Quantities. Planted problems: three typed amounts that are not
 * quantity x rate (1.1.05, 2.3.02, 3.1.07) and one sub-total (section 1.2) whose formula misses its last item.
 */
export const boqPhase1Rev0: BoqRevision = {
  fileName: 'BOQ_Phase1_Rev0.xlsx',
  revision: 0,
  issueDate: '2025-12-28',
  currency: 'SAR',
  bills: [
    {
      number: 1,
      sheet: 'Substructure',
      title: 'Substructure',
      sections: [
        {
          code: '1.1',
          title: 'Site Preparation and Earthworks',
          items: [
            item('1.1.01', 'Site clearance, including removal of debris and disposal off Site', 'm2', 8_400, 6.5),
            item('1.1.02', 'Bulk excavation in rock-like ground down to formation level -16.50 m, including disposal off Site', 'm3', 96_000, 42),
            item('1.1.03', 'Excavation for pile caps, lift pits and ground beams', 'm3', 4_850, 58),
            item('1.1.04', 'Dewatering during excavation and substructure works, including monitoring', 'item', 1, 485_000),
            wrongAmount(item('1.1.05', 'Imported selected fill, compacted in 250 mm layers', 'm3', 1_850, 46.5), 80_625),
            item('1.1.06', 'Anti-termite treatment to formation level', 'm2', 6_400, 8.75),
          ],
        },
        {
          code: '1.2',
          title: 'Shoring and Piling',
          subtotalMissesLastItem: true,
          items: [
            item('1.2.01', 'Secant pile shoring wall, 880 mm diameter piles, average 22 m deep', 'm', 980, 2_650),
            item('1.2.02', 'Temporary ground anchors to the shoring wall, three rows', 'nr', 420, 3_850),
            item('1.2.03', 'Bored cast-in-place piles, 1200 mm diameter, 30 m deep', 'nr', 180, 21_400),
            item('1.2.04', 'Sonic integrity testing of working piles', 'nr', 180, 450),
            item('1.2.05', 'Static load tests on preliminary piles', 'nr', 3, 96_000),
            item('1.2.06', 'Cutting down pile heads and disposal', 'nr', 180, 650),
          ],
        },
        {
          code: '1.3',
          title: 'Basement Concrete and Waterproofing',
          items: [
            item('1.3.01', 'Blinding concrete grade C15, 75 mm thick', 'm2', 6_400, 28),
            item('1.3.02', 'Raft foundation concrete grade C50, sulphate resisting, 2.5 m thick', 'm3', 16_000, 735),
            item('1.3.03', 'High-yield steel reinforcement to the raft', 't', 2_400, 3_450),
            item('1.3.04', 'Basement retaining walls, concrete grade C45', 'm3', 2_640, 890),
            item('1.3.05', 'High-yield steel reinforcement to basement walls', 't', 475, 3_450),
            item('1.3.06', 'Formwork to basement walls, both faces', 'm2', 10_560, 88),
            item('1.3.07', 'Bituminous waterproofing membrane, two layers, under the raft and to walls', 'm2', 14_200, 68),
            item('1.3.08', 'Protection board and screed over waterproofing', 'm2', 14_200, 21.5),
          ],
        },
      ],
    },
    {
      number: 2,
      sheet: 'Superstructure',
      title: 'Superstructure',
      sections: [
        {
          code: '2.1',
          title: 'Concrete Frame',
          items: [
            item('2.1.01', 'Reinforced concrete columns, grade C60, ground floor to Level 28', 'm3', 2_900, 980),
            item('2.1.02', 'Core walls, grade C60, slip-formed', 'm3', 4_450, 1_045),
            item('2.1.03', 'Post-tensioned flat slabs, 280 mm thick, grade C45', 'm3', 9_800, 820),
            item('2.1.04', 'High-yield steel reinforcement to columns, walls and slabs', 't', 3_400, 3_520),
            item('2.1.05', 'Post-tensioning tendons, including stressing and grouting', 't', 245, 9_800),
            item('2.1.06', 'Formwork to slab soffits', 'm2', 32_000, 88),
          ],
        },
        {
          code: '2.2',
          title: 'Masonry and Partitions',
          items: [
            item('2.2.01', '200 mm hollow concrete blockwork to external walls', 'm2', 10_400, 92),
            item('2.2.02', '100 mm hollow concrete blockwork to internal partitions', 'm2', 14_600, 74),
            item('2.2.03', 'Acoustic gypsum board partitions, two layers each side', 'm2', 5_900, 165),
            item('2.2.04', 'Concrete lintels and stiffener columns', 'm', 2_600, 115),
          ],
        },
        {
          code: '2.3',
          title: 'Facade and Roofing',
          items: [
            item('2.3.01', 'Unitised curtain wall, double glazed with low-e coating', 'm2', 14_200, 1_450),
            wrongAmount(item('2.3.02', 'Aluminium composite panel cladding to the podium', 'm2', 2_140, 385), 832_900),
            item('2.3.03', 'Visual mock-up of the curtain wall, two-storey bay, including testing', 'item', 1, 640_000),
            item('2.3.04', 'Building maintenance unit (BMU) to the roof', 'item', 1, 2_950_000),
            item('2.3.05', 'Roof waterproofing, insulation and paving tiles', 'm2', 1_450, 285),
            item('2.3.06', 'External aluminium shading fins, powder coated', 'm', 2_250, 420),
          ],
        },
        {
          code: '2.4',
          title: 'Stairs and Metalwork',
          items: [
            item('2.4.01', 'Precast concrete stair flights', 'nr', 112, 4_250),
            item('2.4.02', 'Stainless steel balustrades and handrails', 'm', 1_450, 610),
            item('2.4.03', 'Steel access ladders and roof hatches', 'nr', 12, 6_800),
          ],
        },
      ],
    },
    {
      number: 3,
      sheet: 'MEP',
      title: 'Mechanical, Electrical and Plumbing',
      sections: [
        {
          code: '3.1',
          title: 'Mechanical (HVAC)',
          items: [
            item('3.1.01', 'Air-cooled chillers, 450 TR each, with controls', 'nr', 3, 1_380_000),
            item('3.1.02', 'Chilled water pumps with variable speed drives', 'nr', 6, 96_500),
            item('3.1.03', 'Air handling units, double skin', 'nr', 18, 148_000),
            item('3.1.04', 'Fan coil units, ceiling concealed', 'nr', 760, 4_350),
            item('3.1.05', 'Pre-insulated chilled water pipework', 'm', 3_400, 285),
            item('3.1.06', 'Galvanised steel ductwork with insulation', 'm2', 24_500, 118),
            wrongAmount(item('3.1.07', 'Smoke extract fans rated 300 C for 2 hours', 'nr', 36, 18_750), 67_500),
          ],
        },
        {
          code: '3.2',
          title: 'Electrical',
          items: [
            item('3.2.01', 'Main low voltage switchboards', 'nr', 2, 465_000),
            item('3.2.02', 'Standby diesel generators, 2,000 kVA', 'nr', 2, 1_650_000),
            item('3.2.03', 'Busbar trunking risers', 'm', 420, 2_150),
            item('3.2.04', 'Sub-main and final circuit cabling', 'item', 1, 4_250_000),
            item('3.2.05', 'LED light fittings, including emergency fittings', 'nr', 6_400, 385),
            item('3.2.06', 'Lightning protection and earthing system', 'item', 1, 420_000),
          ],
        },
        {
          code: '3.3',
          title: 'Plumbing and Fire Protection',
          items: [
            item('3.3.01', 'Domestic water booster pump sets', 'nr', 3, 128_000),
            item('3.3.02', 'Copper and PPR water supply pipework', 'm', 9_800, 96),
            item('3.3.03', 'uPVC drainage and vent pipework', 'm', 7_400, 82),
            item('3.3.04', 'Wet pipe sprinkler system, complete with heads', 'm2', 64_000, 42),
            item('3.3.05', 'Fire pump set: electric, diesel and jockey pumps', 'set', 1, 685_000),
            item('3.3.06', 'Addressable fire alarm and voice evacuation system', 'item', 1, 980_000),
          ],
        },
        {
          code: '3.4',
          title: 'Testing and Commissioning',
          items: [
            item('3.4.01', 'Testing and commissioning of all MEP systems', 'item', 1, 950_000),
            item('3.4.02', 'Independent commissioning agent', 'item', 1, 380_000),
          ],
        },
      ],
    },
  ],
};
