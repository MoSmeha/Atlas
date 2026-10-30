import type { ModelProvider } from '@atlas/shared';
import type { LocalPick } from '../local/pickLocalModels';
import type { ProviderSetting } from '../settings';

export type ProviderId = ModelProvider;

/** The order providers are offered in the model picker. */
const OFFER_ORDER: ProviderId[] = ['openai', 'gemini', 'ollama'];

export interface ProviderInputs {
  setting: ProviderSetting;
  hasOpenAiKey: boolean;
  hasGeminiKey: boolean;
  /** What the local scan found; null when it was not run. */
  local: LocalPick | null;
}

export interface ProviderChoice {
  id: ProviderId | null;
  /** Why this provider, or why none, for the start-up log. */
  reason: string;
}

/**
 * Picks the default provider: it answers when no model is chosen, and its embeddings search the documents. `auto`
 * prefers what costs nothing: Ollama when this machine can run its models, then Gemini's free tier, then OpenAI.
 * A provider named in ATLAS_PROVIDER is used only if it can be; nothing else stands in. Pure.
 */
export function chooseProvider({ setting, hasOpenAiKey, hasGeminiKey, local }: ProviderInputs): ProviderChoice {
  const localProblem = local === null ? 'the machine was not scanned.' : local.problem;
  switch (setting) {
    case 'openai':
      return hasOpenAiKey ? named('openai') : { id: null, reason: 'ATLAS_PROVIDER is openai, but OPENAI_API_KEY is not set.' };
    case 'gemini':
      return hasGeminiKey ? named('gemini') : { id: null, reason: 'ATLAS_PROVIDER is gemini, but GEMINI_API_KEY is not set.' };
    case 'ollama':
      return localProblem === null ? named('ollama') : { id: null, reason: `ATLAS_PROVIDER is ollama, but ${localProblem}` };
    case 'auto':
      if (localProblem === null) return { id: 'ollama', reason: 'Ollama is running with models that fit this machine.' };
      if (hasGeminiKey) return { id: 'gemini', reason: 'GEMINI_API_KEY is set.' };
      if (hasOpenAiKey) return { id: 'openai', reason: 'OPENAI_API_KEY is set.' };
      return {
        id: null,
        reason: 'No model is set up: add OPENAI_API_KEY or GEMINI_API_KEY to .env, or start Ollama, then restart Atlas.',
      };
  }
}

/**
 * Every provider that is set up, offered side by side in the model picker, in a fixed order. None when there is
 * no default provider, since nothing then answers. Pure.
 */
export function offeredProviders({ hasOpenAiKey, hasGeminiKey, local }: ProviderInputs, choice: ProviderChoice): ProviderId[] {
  if (choice.id === null) return [];
  const ready: Record<ProviderId, boolean> = { openai: hasOpenAiKey, gemini: hasGeminiKey, ollama: local !== null && local.problem === null };
  return OFFER_ORDER.filter((id) => id === choice.id || ready[id]);
}

function named(id: ProviderId): ProviderChoice {
  return { id, reason: `ATLAS_PROVIDER is ${id}.` };
}
