/**
 * Prints, for OpenAI and Gemini (each when its key is set), which catalog models the account can see and the lineup
 * Atlas would use, then what the local scan found. Listing models costs nothing. Run with `pnpm models`.
 */
import OpenAI from 'openai';
import { pickLineup } from '../src/application/models/pickLineup';
import { loadModelConfig, type ProviderModels } from '../src/infrastructure/config/modelConfig';
import { pickLocalModels } from '../src/infrastructure/local/pickLocalModels';
import { scanLocal } from '../src/infrastructure/local/scanLocal';
import { loadSettings } from '../src/infrastructure/settings';

const settings = loadSettings();
const config = loadModelConfig();

if (settings.openAiApiKey === null && settings.geminiApiKey === null) {
  console.log('Neither OPENAI_API_KEY nor GEMINI_API_KEY is set.');
}
if (settings.openAiApiKey !== null) {
  await report('OpenAI', new OpenAI({ apiKey: settings.openAiApiKey }), config.openai);
}
if (settings.geminiApiKey !== null) {
  await report('Gemini', new OpenAI({ apiKey: settings.geminiApiKey, baseURL: config.gemini.baseUrl }), config.gemini);
}

const scan = await scanLocal(settings.ollamaUrl);
const local = pickLocalModels(scan, { minChatBillions: config.ollama.minChatBillions, allowCpu: settings.provider === 'ollama' });
const gpu = scan.machine.unifiedMemory ? 'shared memory' : scan.machine.gpuBytes === null ? 'no graphics memory read' : `${gib(scan.machine.gpuBytes)} graphics memory`;
console.log(`\nThis machine: ${gib(scan.machine.ramBytes)} RAM, ${gpu}.`);
console.log(local.problem === null ? `Local: Ollama would answer with ${local.chat?.name}, search by ${local.embedding?.name}.` : `Local: ${local.problem}`);

async function report(name: string, client: OpenAI, models: ProviderModels): Promise<void> {
  const visible: string[] = [];
  try {
    for await (const model of client.models.list()) visible.push(model.id.replace(/^models\//, ''));
  } catch (error) {
    console.log(`\n${name}: could not list models (${error instanceof Error ? error.message : String(error)}).`);
    return;
  }
  console.log(`\n${name}:`);
  for (const model of models.catalog) {
    console.log(`${visible.includes(model.id) ? 'visible ' : 'missing '} ${model.tier.padEnd(8)} ${model.id}`);
  }
  console.log(`${visible.includes(models.embedding.id) ? 'visible ' : 'missing '} embedding ${models.embedding.id}`);
  const lineup = pickLineup(models.catalog, visible);
  console.log(`Lineup: frontier ${lineup.frontier.id}, balanced ${lineup.balanced.id}, small ${lineup.small.id}`);
}

function gib(bytes: number): string {
  return `${Math.round(bytes / 1024 ** 3)} GB`;
}
