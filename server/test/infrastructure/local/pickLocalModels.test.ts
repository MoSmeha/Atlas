import { describe, expect, it } from 'vitest';
import type { LocalModel } from '../../../src/infrastructure/local/listOllamaModels';
import { memoryBudget, pickLocalModels } from '../../../src/infrastructure/local/pickLocalModels';
import type { Machine } from '../../../src/infrastructure/local/scanMachine';

const GIB = 1024 ** 3;
const gpu16: Machine = { ramBytes: 32 * GIB, gpuBytes: 16 * GIB, unifiedMemory: false };
const noGpu: Machine = { ramBytes: 32 * GIB, gpuBytes: null, unifiedMemory: false };
const options = { minChatBillions: 7, allowCpu: false };

function model(name: string, capabilities: string[], parameterBillions: number | null, sizeGib: number): LocalModel {
  return { name, capabilities, parameterBillions, sizeBytes: sizeGib * GIB };
}

const bge = model('bge-m3:latest', ['embedding'], 0.567, 1.2);
const nomic = model('nomic-embed-text:latest', ['embedding'], 0.137, 0.3);
const qwen8 = model('qwen3:8b', ['completion', 'tools', 'thinking'], 8.2, 5.2);
const qwen14 = model('qwen3:14b', ['completion', 'tools', 'thinking'], 14.8, 9.3);
const qwen32 = model('qwen3:32b', ['completion', 'tools', 'thinking'], 32.8, 20);
const tiny = model('llama3.2:3b', ['completion', 'tools'], 3.2, 2);
const noTools = model('gemma3:12b', ['completion', 'vision'], 12.2, 8.1);

describe('pickLocalModels', () => {
  it('takes the largest chat model with tools that fits the graphics memory, and the largest embedding model', () => {
    const pick = pickLocalModels({ machine: gpu16, models: [qwen8, qwen32, qwen14, noTools, nomic, bge] }, options);
    expect(pick).toMatchObject({ chat: qwen14, embedding: bge, problem: null });
  });

  it('skips chat models under the minimum size and says so when nothing else is left', () => {
    const pick = pickLocalModels({ machine: gpu16, models: [tiny, bge] }, options);
    expect(pick.chat).toBeNull();
    expect(pick.problem).toMatch(/^Ollama's chat models with tool support are all under 7 billion parameters/);
  });

  it('says when no chat model has tool support, or every one is too big', () => {
    expect(pickLocalModels({ machine: gpu16, models: [noTools, bge] }, options).problem).toMatch(/^Ollama has no chat model with tool support/);
    expect(pickLocalModels({ machine: gpu16, models: [qwen32, bge] }, options).problem).toMatch(/too big for this machine/);
  });

  it('asks for an embedding model when there is none', () => {
    const pick = pickLocalModels({ machine: gpu16, models: [qwen14] }, options);
    expect(pick.chat).toEqual(qwen14);
    expect(pick.problem).toContain('`ollama pull bge-m3`');
  });

  it('tells how to start when Ollama is not running, with a model sized for the machine', () => {
    const pick = pickLocalModels({ machine: gpu16, models: null }, options);
    expect(pick.problem).toBe(
      'Ollama is not running; this machine can run a model of about 19 billion parameters. Install it from ollama.com, then pull a chat model with tool support, such as `ollama pull qwen3:14b`, and `ollama pull bge-m3` for search.',
    );
    const small = pickLocalModels({ machine: { ...gpu16, gpuBytes: 8 * GIB }, models: null }, options);
    expect(small.problem).toContain('`ollama pull qwen3:8b`');
  });

  it('does not try without a graphics card unless Ollama was asked for, and then uses half the RAM', () => {
    const refused = pickLocalModels({ machine: noGpu, models: [qwen14, bge] }, options);
    expect(refused).toMatchObject({ chat: null, budgetBytes: null });
    expect(refused.problem).toMatch(/no graphics card with 6 GB of memory or more.*ATLAS_PROVIDER=ollama/);

    const allowed = pickLocalModels({ machine: noGpu, models: [qwen14, bge] }, { ...options, allowCpu: true });
    expect(allowed).toMatchObject({ chat: qwen14, embedding: bge, problem: null });
  });
});

describe('memoryBudget', () => {
  it('uses most of the graphics memory, two thirds of shared memory, or nothing for a small card', () => {
    expect(memoryBudget(gpu16, false)).toBeCloseTo(16 * GIB * 0.9);
    expect(memoryBudget({ ramBytes: 24 * GIB, gpuBytes: null, unifiedMemory: true }, false)).toBeCloseTo(24 * GIB * 0.66);
    expect(memoryBudget({ ...gpu16, gpuBytes: 4 * GIB }, false)).toBeNull();
    expect(memoryBudget({ ...gpu16, gpuBytes: 4 * GIB }, true)).toBe(16 * GIB);
  });
});
