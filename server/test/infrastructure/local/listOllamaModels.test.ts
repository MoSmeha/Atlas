import { describe, expect, it } from 'vitest';
import { listOllamaModels, parseBillions, type FetchJson } from '../../../src/infrastructure/local/listOllamaModels';

const tags = {
  models: [
    { name: 'qwen3:14b', size: 9_276_198_565, details: { parameter_size: '14.8B', family: 'qwen3' } },
    { name: 'bge-m3:latest', size: 1_157_672_605, details: { parameter_size: '566.70M' } },
  ],
};

describe('listOllamaModels', () => {
  it('lists each pulled model with its size, parameters and capabilities', async () => {
    const requests: string[] = [];
    const fetchJson: FetchJson = async (url, init) => {
      requests.push(`${init.method} ${url} ${init.body ?? ''}`.trim());
      if (url.endsWith('/api/tags')) return tags;
      return { capabilities: JSON.parse(init.body ?? '{}').model === 'qwen3:14b' ? ['completion', 'tools'] : ['embedding'] };
    };

    expect(await listOllamaModels('http://127.0.0.1:11434', fetchJson)).toEqual([
      { name: 'qwen3:14b', sizeBytes: 9_276_198_565, parameterBillions: 14.8, capabilities: ['completion', 'tools'] },
      { name: 'bge-m3:latest', sizeBytes: 1_157_672_605, parameterBillions: expect.closeTo(0.5667), capabilities: ['embedding'] },
    ]);
    expect(requests).toEqual([
      'GET http://127.0.0.1:11434/api/tags',
      'POST http://127.0.0.1:11434/api/show {"model":"qwen3:14b"}',
      'POST http://127.0.0.1:11434/api/show {"model":"bge-m3:latest"}',
    ]);
  });

  it('is null when no server answers, and leaves capabilities empty when /api/show fails', async () => {
    expect(await listOllamaModels('http://127.0.0.1:11434', async () => null)).toBeNull();
    const models = await listOllamaModels('http://x', async (url) => (url.endsWith('/api/tags') ? tags : null));
    expect(models?.map((model) => model.capabilities)).toEqual([[], []]);
  });
});

describe('parseBillions', () => {
  it('reads Ollama parameter sizes', () => {
    expect(parseBillions('8.0B')).toBe(8);
    expect(parseBillions('567M')).toBeCloseTo(0.567);
    expect(parseBillions('')).toBeNull();
    expect(parseBillions(null)).toBeNull();
  });
});
