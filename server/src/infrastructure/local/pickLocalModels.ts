import type { LocalModel } from './listOllamaModels';
import type { Machine } from './scanMachine';

const GIB = 1024 ** 3;
/** Below this a graphics card cannot hold a model big enough for the tool loop. */
const MIN_GPU_BYTES = 6 * GIB;
/** Room left beside the weights for a context of about 16,000 tokens, which Atlas's prompts need. */
const CONTEXT_HEADROOM = 1.3;
/** Bytes per parameter at the 4-bit quantisation Ollama pulls by default. */
const BYTES_PER_PARAMETER = 0.6;

export interface LocalScan {
  machine: Machine;
  /** What Ollama has pulled; null when no Ollama server answered. */
  models: LocalModel[] | null;
}

export interface LocalPick {
  /** The largest chat model with tool support that fits; null when none does. */
  chat: LocalModel | null;
  embedding: LocalModel | null;
  /** Memory a model may fill: the graphics card's, or part of RAM; null when the machine is too weak to try. */
  budgetBytes: number | null;
  /** Why local models cannot be used, with what to do about it; null when they can. */
  problem: string | null;
}

export interface PickOptions {
  minChatBillions: number;
  /** Use RAM when there is no graphics card big enough; much slower, so only when Ollama was asked for. */
  allowCpu: boolean;
}

/** Chooses the local chat and embedding models this machine can run, or says why it cannot. Pure. */
export function pickLocalModels({ machine, models }: LocalScan, { minChatBillions, allowCpu }: PickOptions): LocalPick {
  const budgetBytes = memoryBudget(machine, allowCpu);
  if (budgetBytes === null) {
    return {
      chat: null,
      embedding: null,
      budgetBytes,
      problem: `this machine has no graphics card with ${gib(MIN_GPU_BYTES)} of memory or more, so local models would be too slow. Set ATLAS_PROVIDER=ollama to use them anyway.`,
    };
  }
  const fits = `this machine can run a model of about ${billionsFor(budgetBytes)} billion parameters`;
  if (models === null) {
    return { chat: null, embedding: null, budgetBytes, problem: `Ollama is not running; ${fits}. ${setup(budgetBytes)}` };
  }

  const embedding = largest(models.filter((model) => model.capabilities.includes('embedding'))) ?? null;
  const withTools = models.filter((model) => model.capabilities.includes('tools') && !model.capabilities.includes('embedding'));
  const bigEnough = withTools.filter((model) => (model.parameterBillions ?? 0) >= minChatBillions);
  const chat = largest(bigEnough.filter((model) => model.sizeBytes * CONTEXT_HEADROOM <= budgetBytes)) ?? null;

  const problems: string[] = [];
  if (chat === null) problems.push(chatProblem(withTools, bigEnough, minChatBillions, fits));
  if (embedding === null) problems.push('Ollama has no embedding model: run `ollama pull bge-m3`, which reads Arabic as well as English.');
  return { chat, embedding, budgetBytes, problem: problems.length > 0 ? problems.join(' ') : null };
}

/** The graphics card's memory, about two thirds of shared memory on Apple silicon, or half the RAM when allowed. */
export function memoryBudget(machine: Machine, allowCpu: boolean): number | null {
  if (machine.unifiedMemory) return machine.ramBytes * 0.66;
  if (machine.gpuBytes !== null && machine.gpuBytes >= MIN_GPU_BYTES) return machine.gpuBytes * 0.9;
  return allowCpu ? machine.ramBytes * 0.5 : null;
}

function chatProblem(withTools: LocalModel[], bigEnough: LocalModel[], minChatBillions: number, fits: string): string {
  if (withTools.length === 0) return `Ollama has no chat model with tool support; ${fits}.`;
  if (bigEnough.length === 0) {
    return `Ollama's chat models with tool support are all under ${minChatBillions} billion parameters, too small for Atlas; ${fits}.`;
  }
  return `Ollama's chat models with tool support are too big for this machine; ${fits}.`;
}

function setup(budgetBytes: number): string {
  const example = billionsFor(budgetBytes) >= 14 ? 'qwen3:14b' : 'qwen3:8b';
  return `Install it from ollama.com, then pull a chat model with tool support, such as \`ollama pull ${example}\`, and \`ollama pull bge-m3\` for search.`;
}

function largest(models: LocalModel[]): LocalModel | undefined {
  return models.toSorted((a, b) => (b.parameterBillions ?? 0) - (a.parameterBillions ?? 0) || b.sizeBytes - a.sizeBytes)[0];
}

function billionsFor(budgetBytes: number): number {
  return Math.floor(budgetBytes / CONTEXT_HEADROOM / BYTES_PER_PARAMETER / 1e9);
}

function gib(bytes: number): string {
  return `${Math.round(bytes / GIB)} GB`;
}
