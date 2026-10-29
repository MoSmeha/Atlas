import type { ModelOption, ModelProvider } from '@atlas/shared';

/** The providers that charge nothing for an answer. */
export type FreeProvider = Exclude<ModelProvider, 'openai'>;

/** The provider when it is a free one, so the top bar can say so; null for OpenAI or none. */
export function freeProvider(provider: ModelProvider | null | undefined): FreeProvider | null {
  return provider === 'gemini' || provider === 'ollama' ? provider : null;
}

/** A model whose tokens cost nothing. */
export function isFreeModel(model: Pick<ModelOption, 'inputPrice' | 'outputPrice'> | undefined): boolean {
  return model !== undefined && model.inputPrice === 0 && model.outputPrice === 0;
}
