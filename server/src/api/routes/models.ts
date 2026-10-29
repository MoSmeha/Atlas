import { type ModelOption, ModelsResponse, routes } from '@atlas/shared';
import type { ModelChoices } from '../../application/models/modelChoices';
import type { CatalogModel } from '../../application/models/pickLineup';
import type { RoutePlugin } from '../zod';

export interface ModelsDeps {
  /** Every model a question may use, from every provider set up, and the default. */
  choices: ModelChoices;
}

export const modelsRoutes: RoutePlugin<{ deps: ModelsDeps }> = async (app, { deps }) => {
  app.get(routes.models, { schema: { response: { 200: ModelsResponse } } }, async () => ({
    models: deps.choices.options.map(modelOption),
    defaultModel: deps.choices.defaultModel.id,
  }));
};

function modelOption({ id, provider, tier, label, inputPrice, outputPrice }: CatalogModel): ModelOption {
  return { id, provider, tier, label, inputPrice, outputPrice };
}
