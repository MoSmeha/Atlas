import type { ModelChoices } from '../../src/application/models/modelChoices';
import type { Lineup } from '../../src/application/models/pickLineup';

/** A lineup whose IDs match FakeModelClient's model list. */
export const testLineup: Lineup = {
  frontier: { id: 'frontier-model', provider: 'openai', tier: 'frontier', label: 'Frontier', inputPrice: 10, cachedInputPrice: 1, outputPrice: 50 },
  balanced: { id: 'balanced-model', provider: 'openai', tier: 'balanced', label: 'Balanced', inputPrice: 2, cachedInputPrice: 0.1, outputPrice: 10 },
  small: { id: 'small-model', provider: 'openai', tier: 'small', label: 'Small', inputPrice: 0.1, cachedInputPrice: 0.01, outputPrice: 0.5 },
};

/** The test lineup as the only provider's choices, frontier by default. */
export const testChoices: ModelChoices = {
  options: [testLineup.frontier, testLineup.balanced, testLineup.small],
  defaultModel: testLineup.frontier,
  reasoningEffort: { openai: null },
};
