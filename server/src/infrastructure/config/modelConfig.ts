import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { z } from 'zod';
import { type ModelProvider, ModelTier } from '@atlas/shared';
import { repoRoot } from '../settings';

const ReasoningEffort = z.enum(['none', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max']);

/** One provider's section; each catalog entry is marked with the provider, so a question can be sent to it. */
function providerModels(provider: ModelProvider) {
  return z.object({
    catalog: z
      .array(
        z
          .object({
            id: z.string().min(1),
            tier: ModelTier,
            label: z.string().min(1),
            inputPrice: z.number().nonnegative(),
            cachedInputPrice: z.number().nonnegative(),
            outputPrice: z.number().nonnegative(),
          })
          .transform((model) => ({ ...model, provider })),
      )
      .min(3),
    answerTier: ModelTier,
    /** Null leaves reasoning at each model's default. */
    reasoningEffort: ReasoningEffort.nullable(),
    /** Null dimensions keep the model's default vector size. */
    embedding: z.object({ id: z.string().min(1), price: z.number().nonnegative(), dimensions: z.number().int().positive().nullable() }),
  });
}

const ModelConfigSchema = z.object({
  openai: providerModels('openai'),
  gemini: providerModels('gemini').extend({ baseUrl: z.url() }),
  ollama: z.object({
    /** Smaller chat models are not used: they rarely follow the tool loop. */
    minChatBillions: z.number().positive(),
  }),
});

/** One provider's catalog, default answer tier, reasoning effort and embedding model. */
export type ProviderModels = z.output<ReturnType<typeof providerModels>>;
export type ModelConfig = z.output<typeof ModelConfigSchema>;

export const modelConfigPath = resolve(repoRoot, 'server', 'config', 'models.json');

export function loadModelConfig(path: string = modelConfigPath): ModelConfig {
  return ModelConfigSchema.parse(JSON.parse(readFileSync(path, 'utf8')));
}
