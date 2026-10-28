import { pickLineup, type Lineup } from '../../application/models/pickLineup';
import type { ModelClient } from '../../application/ports/ModelClient';
import { loadModelConfig, type ModelConfig } from '../config/modelConfig';

const LIST_TIMEOUT_MS = 8_000;

/**
 * Picks the model per tier from the catalog, preferring models the account can see.
 * Without a client, or when listing fails or takes too long, it trusts the catalog order.
 */
export async function resolveLineup(
  modelClient: ModelClient | null,
  config: ModelConfig = loadModelConfig(),
  timeoutMs: number = LIST_TIMEOUT_MS,
): Promise<Lineup> {
  const visible = modelClient === null ? null : await visibleModels(modelClient, timeoutMs);
  return pickLineup(config.catalog, visible);
}

async function visibleModels(modelClient: ModelClient, timeoutMs: number): Promise<string[] | null> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<null>((resolve) => {
    timer = setTimeout(() => resolve(null), timeoutMs);
    timer.unref();
  });
  try {
    return await Promise.race([modelClient.listModels(), timeout]);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
