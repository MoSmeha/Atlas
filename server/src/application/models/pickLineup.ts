import type { ModelTier } from '@atlas/shared';

export interface CatalogModel {
  id: string;
  tier: ModelTier;
  label: string;
  inputPrice: number;
  cachedInputPrice: number;
  outputPrice: number;
}

export type Lineup = Record<ModelTier, CatalogModel>;

const tiers: ModelTier[] = ['frontier', 'balanced', 'small'];

/**
 * Picks one model per tier: the first catalog entry the account can see.
 * With no list (no key yet, or offline) it trusts the catalog order.
 */
export function pickLineup(catalog: CatalogModel[], visibleIds: string[] | null): Lineup {
  const visible = visibleIds === null ? null : new Set(visibleIds);
  const entries = tiers.map((tier) => {
    const candidates = catalog.filter((model) => model.tier === tier);
    const pick = candidates.find((model) => visible === null || visible.has(model.id)) ?? candidates[0];
    if (!pick) throw new Error(`The model catalog has no ${tier} model.`);
    return [tier, pick] as const;
  });
  return Object.fromEntries(entries) as Lineup;
}

/** The lineup's models from frontier to small, each once: a local provider puts one model in every tier. */
export function lineupModels(lineup: Lineup): CatalogModel[] {
  const models = tiers.map((tier) => lineup[tier]);
  return models.filter((model, i) => models.findIndex((other) => other.id === model.id) === i);
}
