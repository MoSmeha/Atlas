import type { ModelChoices } from '../../application/models/modelChoices';
import { lineupModels, pickLineup } from '../../application/models/pickLineup';
import type { ProviderModels } from '../config/modelConfig';
import { resolveModels } from '../openai/resolveLineup';
import type { Provider } from './connectProvider';

export interface ResolvedChoices {
  choices: ModelChoices;
  /** The model IDs each provider's account can see; null when that list could not be read. */
  visible: ReadonlyMap<Provider['id'], string[] | null>;
}

/**
 * Picks each provider's lineup from the models its account can see, all side by side, with the default provider's
 * answer tier as the default model. With no provider set up it offers `fallback`'s catalog as it stands, so the
 * picker still shows what a key would unlock.
 */
export async function resolveChoices(providers: Provider[], defaultProvider: Provider | null, fallback: ProviderModels): Promise<ResolvedChoices> {
  if (defaultProvider === null || providers.length === 0) {
    const lineup = pickLineup(fallback.catalog, null);
    return { choices: { options: lineupModels(lineup), defaultModel: lineup[fallback.answerTier], reasoningEffort: {} }, visible: new Map() };
  }
  const resolved = await Promise.all(providers.map(async (provider) => ({ provider, ...(await resolveModels(provider.modelClient, provider.models)) })));
  const own = resolved.find((entry) => entry.provider.id === defaultProvider.id);
  if (!own) throw new Error(`The default provider ${defaultProvider.id} is not among the providers offered.`);
  return {
    choices: {
      options: resolved.flatMap((entry) => lineupModels(entry.lineup)),
      defaultModel: own.lineup[defaultProvider.models.answerTier],
      reasoningEffort: Object.fromEntries(providers.map((provider) => [provider.id, provider.models.reasoningEffort])),
    },
    visible: new Map(resolved.map((entry) => [entry.provider.id, entry.visible])),
  };
}
