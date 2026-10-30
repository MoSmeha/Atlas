import OpenAI from 'openai';
import type { EmbeddingClient } from '../../application/ports/EmbeddingClient';
import type { ModelClient } from '../../application/ports/ModelClient';
import { ChatModelClient } from '../chat/ChatModelClient';
import type { ModelConfig, ProviderModels } from '../config/modelConfig';
import type { LocalModel } from '../local/listOllamaModels';
import type { LocalPick } from '../local/pickLocalModels';
import { createOpenAiClient } from '../openai/createOpenAiClient';
import type { EmbeddingLimits } from '../openai/embeddingRequests';
import type { Vendor } from '../openai/mapOpenAiError';
import { OpenAiEmbeddingClient } from '../openai/OpenAiEmbeddingClient';
import { OpenAiModelClient } from '../openai/OpenAiModelClient';
import type { Settings } from '../settings';
import type { ProviderId } from './chooseProvider';

const GEMINI: Vendor = { name: 'Gemini', keyVariable: 'GEMINI_API_KEY' };
const OLLAMA: Vendor = { name: 'Ollama', keyVariable: null };

/** Gemini embeds at most 100 texts per request and reads 2,048 tokens of each. */
const GEMINI_EMBEDDING_LIMITS: EmbeddingLimits = { maxInputs: 100, maxRequestTokens: 100_000, maxInputTokens: 2_000 };
/** A local server embeds on this machine, so requests stay small enough to show progress. */
const LOCAL_EMBEDDING_LIMITS: EmbeddingLimits = { maxInputs: 32, maxRequestTokens: 32_000, maxInputTokens: 2_000 };
/** A local model on a modest card can take minutes over a long tool output. */
const LOCAL_TIMEOUT_MS = 600_000;

/** The clients and models of the provider that answers. */
export interface Provider {
  id: ProviderId;
  /** For the start-up log, such as "Gemini (free tier)". */
  label: string;
  /** What the user should know about it, such as where their documents go; null when nothing. */
  notice: string | null;
  modelClient: ModelClient;
  embeddings: EmbeddingClient;
  models: ProviderModels;
  /** Names the vectors the embeddings make, so an index embedded by another model is embedded again. */
  embeddingKey: string;
}

/** Builds the provider chooseProvider picked. Needs its key in the settings, or for Ollama, a pick without a problem. */
export function connectProvider(id: ProviderId, settings: Settings, config: ModelConfig, local: LocalPick | null): Provider {
  switch (id) {
    case 'openai': {
      const client = createOpenAiClient(settings.openAiApiKey);
      return {
        id,
        label: 'OpenAI',
        notice: null,
        modelClient: new OpenAiModelClient(client),
        embeddings: new OpenAiEmbeddingClient(client, config.openai.embedding),
        models: config.openai,
        embeddingKey: embeddingKey(id, config.openai.embedding),
      };
    }
    case 'gemini': {
      const { baseUrl, ...models } = config.gemini;
      const client = new OpenAI({ apiKey: required(settings.geminiApiKey, 'GEMINI_API_KEY'), baseURL: baseUrl, maxRetries: 2, timeout: 120_000 });
      return {
        id,
        label: 'Gemini (free tier)',
        notice: 'Google uses what its free tier is sent to improve its products, so keep confidential files on OpenAI or a local model.',
        modelClient: new ChatModelClient(client, { vendor: GEMINI, sendsReasoning: true }),
        embeddings: new OpenAiEmbeddingClient(client, models.embedding, { vendor: GEMINI, limits: GEMINI_EMBEDDING_LIMITS }),
        models,
        embeddingKey: embeddingKey(id, models.embedding),
      };
    }
    case 'ollama': {
      const chat = local?.chat ?? null;
      const embedding = local?.embedding ?? null;
      if (chat === null || embedding === null) throw new Error('Ollama was chosen without a chat and an embedding model.');
      // Ollama needs no key, but the SDK will not start without one.
      const client = new OpenAI({ apiKey: 'ollama', baseURL: `${settings.ollamaUrl}/v1`, maxRetries: 1, timeout: LOCAL_TIMEOUT_MS });
      const models = localModels(chat, embedding);
      return {
        id,
        label: `Ollama on this machine (${chat.name}, search by ${embedding.name})`,
        notice:
          "Ollama silently cuts prompts longer than its context, and Atlas's grow past the default: start Ollama with OLLAMA_CONTEXT_LENGTH=16384 or more.",
        modelClient: new ChatModelClient(client, { vendor: OLLAMA, sendsReasoning: false }),
        embeddings: new OpenAiEmbeddingClient(client, models.embedding, { vendor: OLLAMA, limits: LOCAL_EMBEDDING_LIMITS }),
        models,
        embeddingKey: embeddingKey(id, models.embedding),
      };
    }
  }
}

/** The one local chat model in every tier, free, with reasoning left at the model's default. */
function localModels(chat: LocalModel, embedding: LocalModel): ProviderModels {
  const free = { inputPrice: 0, cachedInputPrice: 0, outputPrice: 0 };
  const label = `${chat.name} (local)`;
  return {
    catalog: (['frontier', 'balanced', 'small'] as const).map((tier) => ({ id: chat.name, provider: 'ollama' as const, tier, label, ...free })),
    answerTier: 'frontier',
    reasoningEffort: null,
    embedding: { id: embedding.name, price: 0, dimensions: null },
  };
}

function embeddingKey(id: ProviderId, embedding: ProviderModels['embedding']): string {
  return `${id}:${embedding.id}:${embedding.dimensions ?? 'default'}`;
}

function required(key: string | null, variable: string): string {
  if (key === null) throw new Error(`${variable} is not set.`);
  return key;
}
