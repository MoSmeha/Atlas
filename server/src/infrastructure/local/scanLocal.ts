import { listOllamaModels } from './listOllamaModels';
import type { LocalScan } from './pickLocalModels';
import { scanMachine } from './scanMachine';

/** Reads this machine's memory and asks the Ollama server at the URL what it has pulled. Never throws. */
export async function scanLocal(ollamaUrl: string): Promise<LocalScan> {
  const [machine, models] = await Promise.all([scanMachine(), listOllamaModels(ollamaUrl)]);
  return { machine, models };
}
