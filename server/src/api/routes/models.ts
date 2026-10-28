import { type ModelOption, ModelsResponse, ModelTier, routes } from '@atlas/shared';
import type { CatalogModel, Lineup } from '../../application/models/pickLineup';
import type { RoutePlugin } from '../zod';

export interface ModelsDeps {
  lineup: Lineup;
  /** Tier of the default answer model (`answerTier` of the model config). */
  answerTier: ModelTier;
}

export const modelsRoutes: RoutePlugin<{ deps: ModelsDeps }> = async (app, { deps }) => {
  app.get(routes.models, { schema: { response: { 200: ModelsResponse } } }, async () => ({
    models: ModelTier.options.map((tier) => modelOption(deps.lineup[tier])),
    defaultModel: deps.lineup[deps.answerTier].id,
  }));
};

function modelOption({ id, tier, label, inputPrice, outputPrice }: CatalogModel): ModelOption {
  return { id, tier, label, inputPrice, outputPrice };
}
