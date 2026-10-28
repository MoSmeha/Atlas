import type { ModelTier } from '@atlas/shared';
import type { CatalogModel, Lineup } from './pickLineup';

/** The requested model when it is one of the lineup's three, otherwise the default answer model of the lineup. */
export function chooseModel(lineup: Lineup, answerTier: ModelTier, requested: string | null | undefined): CatalogModel {
  return Object.values(lineup).find((model) => model.id === requested) ?? lineup[answerTier];
}
