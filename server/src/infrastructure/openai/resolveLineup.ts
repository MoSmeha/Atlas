import { pickLineup, type Lineup } from '../../application/models/pickLineup';
import type { ModelClient } from '../../application/ports/ModelClient';
import { loadModelConfig, type ProviderModels } from '../config/modelConfig';

const LIST_TIMEOUT_MS = 8_000;

export interface ResolvedModels {
  lineup: Lineup;
  /** The model IDs the account can see; null without a client, or when listing failed or took too long. */
  visible: string[] | null;
}

/**
 * Picks the model per tier from the catalog, preferring models the account can see.
 * Without a client, or when listing fails or takes too long, it trusts the catalog order.
 */
export async function resolveLineup(
  modelClient: ModelClient | null,
  config: ProviderModels = loadModelConfig().openai,
  timeoutMs: number = LIST_TIMEOUT_MS,
): Promise<Lineup> {
  return (await resolveModels(modelClient, config, timeoutMs)).lineup;
}

/** resolveLineup, and the list of models it was picked from, which also tells whether voice models are on. */
export async function resolveModels(
  modelClient: ModelClient | null,
  config: ProviderModels = loadModelConfig().openai,
  timeoutMs: number = LIST_TIMEOUT_MS,
): Promise<ResolvedModels> {
  const visible = modelClient === null ? null : await visibleModels(modelClient, timeoutMs);
  return { lineup: pickLineup(config.catalog, visible), visible };
}

/** The model IDs the client's account can see; null when listing fails or takes too long. */
export async function visibleModels(modelClient: ModelClient, timeoutMs: number = LIST_TIMEOUT_MS): Promise<string[] | null> {
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
