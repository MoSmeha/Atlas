import type { Lineup } from '../../src/application/models/pickLineup';

/** A lineup whose IDs match FakeModelClient's model list. */
export const testLineup: Lineup = {
  frontier: { id: 'frontier-model', tier: 'frontier', label: 'Frontier', inputPrice: 10, cachedInputPrice: 1, outputPrice: 50 },
  balanced: { id: 'balanced-model', tier: 'balanced', label: 'Balanced', inputPrice: 2, cachedInputPrice: 0.1, outputPrice: 10 },
  small: { id: 'small-model', tier: 'small', label: 'Small', inputPrice: 0.1, cachedInputPrice: 0.01, outputPrice: 0.5 },
};
