import { boqPhase1Rev0 } from './boqPhase1Rev0';
import type { BoqChanges } from './lib/boqTypes';
import { reviseBoq } from './lib/reviseBoq';

/**
 * BOQ_Phase1_Rev1.xlsx after re-measurement: four quantities and three rates change, two items are added,
 * one is removed and the typed amount on 2.3.02 is corrected. The other planted errors stay.
 */
export const boqPhase1Rev1Changes: BoqChanges = {
  fileName: 'BOQ_Phase1_Rev1.xlsx',
  revision: 1,
  issueDate: '2026-04-12',
  quantities: {
    '1.1.02': 101_500,
    '1.3.07': 15_350,
    '2.2.02': 13_150,
    '3.1.04': 812,
  },
  rates: {
    '1.3.03': 3_610,
    '2.3.01': 1_395,
    '3.2.02': 1_720_000,
  },
  added: [
    {
      after: '2.3.06',
      item: { code: '2.3.07', description: 'Bird deterrent mesh and spikes to facade ledges', unit: 'm', quantity: 1_150, rate: 64 },
    },
    {
      after: '3.2.06',
      item: {
        code: '3.2.07',
        description: 'Electric vehicle charging points, 22 kW, in the basement car park',
        unit: 'nr',
        quantity: 40,
        rate: 14_500,
      },
    },
  ],
  removed: ['3.4.02'],
  corrected: ['2.3.02'],
};

export const boqPhase1Rev1 = reviseBoq(boqPhase1Rev0, boqPhase1Rev1Changes);
