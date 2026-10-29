import type { ModelChoices } from './modelChoices';
import type { CatalogModel } from './pickLineup';

/** The requested model when it is one of the choices, otherwise the default one. */
export function chooseModel(choices: ModelChoices, requested: string | null | undefined): CatalogModel {
  return choices.options.find((model) => model.id === requested) ?? choices.defaultModel;
}
