import type { ModelProvider } from '@atlas/shared';
import type { ReasoningEffort } from '../ports/ModelClient';
import type { CatalogModel } from './pickLineup';

/** Every model a question may use, from every provider that is set up, and the one it gets by default. */
export interface ModelChoices {
  /** Provider by provider, each from frontier to small. Their catalog prices give the cost. */
  options: CatalogModel[];
  defaultModel: CatalogModel;
  /** How hard each provider's models think when they answer; null or missing leaves the model's default. */
  reasoningEffort: Partial<Record<ModelProvider, ReasoningEffort | null>>;
}

/**
 * The small model of the given model's provider, for a question's side jobs (describing a page, confirming
 * dates), so they go where the answer goes. The model itself when its provider offers no small one.
 */
export function smallModelFor(choices: ModelChoices, model: CatalogModel): CatalogModel {
  return choices.options.find((option) => option.provider === model.provider && option.tier === 'small') ?? model;
}
