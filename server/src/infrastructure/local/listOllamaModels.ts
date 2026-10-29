import { z } from 'zod';

const PROBE_TIMEOUT_MS = 1_500;
const SHOW_TIMEOUT_MS = 5_000;

/** A model Ollama has pulled. */
export interface LocalModel {
  /** As requests name it, such as "qwen3:14b". */
  name: string;
  /** Size on disk, about what its weights take in memory. */
  sizeBytes: number;
  /** From details.parameter_size, such as "14.8B"; null when Ollama does not say. */
  parameterBillions: number | null;
  /** From /api/show: "completion", "tools", "embedding", "vision", "thinking"…; empty when it could not be read. */
  capabilities: string[];
}

const Tags = z.object({
  models: z.array(
    z.object({
      name: z.string().min(1),
      size: z.number().nonnegative().catch(0),
      details: z.object({ parameter_size: z.string().nullish() }).nullish(),
    }),
  ),
});

const Show = z.object({ capabilities: z.array(z.string()).nullish() });

/** The models a local Ollama server has pulled, with what each can do; null when no server answers. */
export async function listOllamaModels(baseUrl: string, fetchJson: FetchJson = fetchWithTimeout): Promise<LocalModel[] | null> {
  const tags = Tags.safeParse(await fetchJson(`${baseUrl}/api/tags`, { method: 'GET' }, PROBE_TIMEOUT_MS));
  if (!tags.success) return null;
  return Promise.all(
    tags.data.models.map(async (model): Promise<LocalModel> => {
      const shown = Show.safeParse(
        await fetchJson(`${baseUrl}/api/show`, { method: 'POST', body: JSON.stringify({ model: model.name }) }, SHOW_TIMEOUT_MS),
      );
      return {
        name: model.name,
        sizeBytes: model.size,
        parameterBillions: parseBillions(model.details?.parameter_size ?? null),
        capabilities: shown.success ? (shown.data.capabilities ?? []) : [],
      };
    }),
  );
}

/** "14.8B" is 14.8, "567M" is 0.567; null for anything else. */
export function parseBillions(size: string | null): number | null {
  const match = /^\s*(\d+(?:\.\d+)?)\s*([KMBT])\s*$/i.exec(size ?? '');
  if (!match) return null;
  const scale: Record<string, number> = { K: 1e-6, M: 1e-3, B: 1, T: 1e3 };
  return Number(match[1]) * (scale[(match[2] ?? 'B').toUpperCase()] ?? 1);
}

/** The parsed JSON body, or null when the request fails, times out or answers with an error. */
export type FetchJson = (url: string, init: { method: string; body?: string }, timeoutMs: number) => Promise<unknown>;

async function fetchWithTimeout(url: string, init: { method: string; body?: string }, timeoutMs: number): Promise<unknown> {
  try {
    const response = await fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
    return response.ok ? await response.json() : null;
  } catch {
    return null;
  }
}
