import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { z } from 'zod';
import { ModelTier } from '@atlas/shared';
import { repoRoot } from '../settings';

const ModelConfigSchema = z.object({
  catalog: z
    .array(
      z.object({
        id: z.string().min(1),
        tier: ModelTier,
        label: z.string().min(1),
        inputPrice: z.number().nonnegative(),
        cachedInputPrice: z.number().nonnegative(),
        outputPrice: z.number().nonnegative(),
      }),
    )
    .min(3),
  answerTier: ModelTier,
  reasoningEffort: z.enum(['none', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max']),
  embedding: z.object({ id: z.string().min(1), price: z.number().nonnegative(), dimensions: z.number().int().positive() }),
});

export type ModelConfig = z.infer<typeof ModelConfigSchema>;

export const modelConfigPath = resolve(repoRoot, 'server', 'config', 'models.json');

export function loadModelConfig(path: string = modelConfigPath): ModelConfig {
  return ModelConfigSchema.parse(JSON.parse(readFileSync(path, 'utf8')));
}
