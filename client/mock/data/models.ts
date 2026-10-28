import type { ModelOption, ModelsResponse, Usage } from '@atlas/shared';
import type { Tokens } from './script';

interface CatalogModel extends ModelOption {
  cachedInputPrice: number;
}

/** The lineup the real server resolves from server/config/models.json, one model per tier. */
const catalog: CatalogModel[] = [
  { id: 'gpt-6-astra', tier: 'frontier', label: 'GPT-6 Astra', inputPrice: 10, cachedInputPrice: 1, outputPrice: 50 },
  { id: 'gpt-6.1-sol', tier: 'balanced', label: 'GPT-6.1 Sol', inputPrice: 2, cachedInputPrice: 0.1, outputPrice: 10 },
  { id: 'gpt-6-luna', tier: 'small', label: 'GPT-6 Luna', inputPrice: 0.1, cachedInputPrice: 0.01, outputPrice: 0.5 },
];

export const modelsResponse: ModelsResponse = {
  models: catalog.map(({ cachedInputPrice: _cached, ...model }) => model),
  defaultModel: 'gpt-6-astra',
};

export function findModel(id: string): CatalogModel | null {
  return catalog.find((model) => model.id === id) ?? null;
}

/** Cheaper tiers think less and answer faster, as they would for real. */
const speed: Record<ModelOption['tier'], number> = { frontier: 1, balanced: 0.6, small: 0.35 };

export function speedOf(model: CatalogModel): number {
  return speed[model.tier];
}

/** Usage with its cost worked out from the model's prices, the way the server does it. */
export function usageFor(model: CatalogModel, tokens: Tokens, durationMs: number): Usage {
  const uncached = Math.max(0, tokens.input - tokens.cached);
  const dollars = uncached * model.inputPrice + tokens.cached * model.cachedInputPrice + tokens.output * model.outputPrice;
  return {
    model: model.id,
    inputTokens: tokens.input,
    cachedInputTokens: tokens.cached,
    outputTokens: tokens.output,
    reasoningTokens: tokens.reasoning,
    costUsd: dollars / 1_000_000,
    durationMs: Math.round(durationMs),
  };
}
