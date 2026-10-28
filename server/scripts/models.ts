/**
 * Prints which catalog models this OpenAI account can see and the lineup Atlas will use.
 * Run with `pnpm models`.
 */
import OpenAI from 'openai';
import { pickLineup } from '../src/application/models/pickLineup';
import { loadModelConfig } from '../src/infrastructure/config/modelConfig';
import { loadSettings } from '../src/infrastructure/settings';

const settings = loadSettings();
if (!settings.openAiApiKey) {
  console.error('OPENAI_API_KEY is not set. Add it to .env first.');
  process.exit(1);
}

const config = loadModelConfig();
const client = new OpenAI({ apiKey: settings.openAiApiKey });
const visible: string[] = [];
for await (const model of client.models.list()) visible.push(model.id);

for (const model of config.catalog) {
  console.log(`${visible.includes(model.id) ? 'visible ' : 'missing '} ${model.tier.padEnd(8)} ${model.id}`);
}
console.log(`${visible.includes(config.embedding.id) ? 'visible ' : 'missing '} embedding ${config.embedding.id}`);

const lineup = pickLineup(config.catalog, visible);
console.log(`\nLineup: frontier ${lineup.frontier.id}, balanced ${lineup.balanced.id}, small ${lineup.small.id}`);
