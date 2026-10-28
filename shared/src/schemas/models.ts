import { z } from 'zod';

export const ModelTier = z.enum(['frontier', 'balanced', 'small']);
export type ModelTier = z.infer<typeof ModelTier>;

export const ModelOption = z.object({
  id: z.string(),
  tier: ModelTier,
  label: z.string(),
  /** US dollars per one million tokens. */
  inputPrice: z.number(),
  outputPrice: z.number(),
});
export type ModelOption = z.infer<typeof ModelOption>;

export const ModelsResponse = z.object({
  models: z.array(ModelOption),
  defaultModel: z.string(),
});
export type ModelsResponse = z.infer<typeof ModelsResponse>;

/** Tokens, cost and time of one answered question. */
export const Usage = z.object({
  model: z.string(),
  inputTokens: z.number().int(),
  cachedInputTokens: z.number().int(),
  outputTokens: z.number().int(),
  reasoningTokens: z.number().int(),
  costUsd: z.number(),
  durationMs: z.number().int(),
});
export type Usage = z.infer<typeof Usage>;

export const UsageResponse = z.object({
  last: Usage.nullable(),
  session: z.object({ questions: z.number().int(), costUsd: z.number() }),
});
export type UsageResponse = z.infer<typeof UsageResponse>;
