import { describe, expect, it, vi } from 'vitest';
import type { DocumentRecord } from '../../../src/application/ports/DocumentIndex';
import type { EmbeddingClient } from '../../../src/application/ports/EmbeddingClient';
import { errors } from '../../../src/application/errors';
import { tools } from '../../../src/application/tools/registry';
import { searchDocuments, type SearchDocumentsOutput } from '../../../src/application/tools/searchDocuments';
import type { ToolContext } from '../../../src/application/tools/Tool';
import { ToolError } from '../../../src/application/tools/Tool';
import { embedText, FakeEmbeddingClient } from '../../fakes/FakeEmbeddingClient';
import { FakeIndex } from '../../fakes/FakeIndex';
import { boqTable, excelRecord, pdfRecord } from '../../fakes/records';
import { makeToolContext } from '../../fakes/toolContext';

const contract = pdfRecord('contracts/Main.pdf', [
  'Retention of five percent is held from each payment',
  'Concrete shall be grade C40',
  'Retention money is released at handover',
]);

/** A FakeIndex holding the records, with every chunk embedded by the word-hash fake. */
async function indexWith(...records: DocumentRecord[]): Promise<FakeIndex> {
  const index = new FakeIndex();
  for (const record of records) index.save(record);
  const pending = index.pendingEmbeddings(10_000);
  const { vectors } = await new FakeEmbeddingClient().embed(pending.map((chunk) => chunk.text));
  index.saveEmbeddings(pending.map((chunk, i) => ({ chunkId: chunk.chunkId, vector: vectors[i] as Float32Array })));
  return index;
}

/** Embeds every query as the given text, so a test decides what the query "means". */
function embedsAs(text: string): EmbeddingClient {
  return { model: 'stub', embed: async () => ({ vectors: [embedText(text)], tokens: 1 }) };
}

function failingEmbeddings(error: Error): EmbeddingClient {
  return {
    model: 'stub',
    embed: async () => {
      throw error;
    },
  };
}

async function search(
  index: FakeIndex,
  args: { query: string; document?: string | null; limit?: number | null },
  overrides: Partial<ToolContext> = {},
) {
  const context = makeToolContext({ index, ...overrides });
  const result = await searchDocuments.run({ document: null, limit: null, ...args }, context);
  return { output: result.output as SearchDocumentsOutput, summary: result.summary };
}

describe('search_documents', () => {
  it('fuses keyword and semantic hits and says which search found each passage', async () => {
    const { output, summary } = await search(await indexWith(contract), { query: 'retention' });

    expect(output.mode).toBe('keyword_and_semantic');
    expect(output.passages.map((passage) => [passage.page, passage.matched])).toEqual([
      [1, 'both'],
      [3, 'both'],
      [2, 'semantic'],
    ]);
    expect(output.passages[0]).toEqual({
      document: 'contracts/Main.pdf',
      page: 1,
      snippet: 'Retention of five percent is held from each payment',
      matched: 'both',
    });
    expect(output.note).toBeNull();
    expect(summary).toBe('3 passages from 1 document');
  });

  it('embeds the query once and passes the stop signal along', async () => {
    const embeddings = new FakeEmbeddingClient();
    const spy = vi.spyOn(embeddings, 'embed');
    const context = makeToolContext({ index: await indexWith(contract), embeddings });

    await searchDocuments.run({ query: '  retention ', document: null, limit: null }, context);

    expect(spy).toHaveBeenCalledOnce();
    expect(spy).toHaveBeenCalledWith(['retention'], context.signal);
  });

  it('finds passages by meaning when no word matches', async () => {
    const index = await indexWith(contract);
    const { output } = await search(index, { query: 'withheld sums', limit: 1 }, { embeddings: embedsAs('released at handover') });

    expect(output.passages).toEqual([
      { document: 'contracts/Main.pdf', page: 3, snippet: 'Retention money is released at handover', matched: 'semantic' },
    ]);
  });

  it('returns 8 passages by default and fetches three times the limit from each search', async () => {
    const index = await indexWith(pdfRecord('spec.pdf', Array.from({ length: 30 }, (_, i) => `clause ${i + 1} retention`)));
    const keyword = vi.spyOn(index, 'keywordSearch');
    const vector = vi.spyOn(index, 'vectorSearch');

    const byDefault = await search(index, { query: 'retention' });
    expect(byDefault.output.passages).toHaveLength(8);
    expect(keyword).toHaveBeenLastCalledWith('retention', { document: null, limit: 24 });
    expect(vector).toHaveBeenLastCalledWith(expect.any(Float32Array), { document: null, limit: 24 });

    const three = await search(index, { query: 'retention', limit: 3 });
    expect(three.output.passages).toHaveLength(3);
    expect(keyword).toHaveBeenLastCalledWith('retention', { document: null, limit: 9 });
  });

  it('searches only the named document, matching its name without regard to case', async () => {
    const other = pdfRecord('specs/Spec.pdf', ['Retention is not covered here']);
    const index = await indexWith(contract, other);
    const keyword = vi.spyOn(index, 'keywordSearch');

    const { output } = await search(index, { query: 'retention', document: 'MAIN.PDF' });

    expect(output.document).toBe('contracts/Main.pdf');
    expect(new Set(output.passages.map((passage) => passage.document))).toEqual(new Set(['contracts/Main.pdf']));
    expect(keyword).toHaveBeenCalledWith('retention', { document: 'contracts/Main.pdf', limit: 24 });
  });

  it('refuses an unknown document and lists the loaded ones', async () => {
    const index = await indexWith(contract, excelRecord('BOQ.xlsx', [boqTable([['A1', 'Piles', 10, 200, 2000]])]));
    const attempt = search(index, { query: 'retention', document: 'Contract.pdf' });

    await expect(attempt).rejects.toBeInstanceOf(ToolError);
    await expect(attempt).rejects.toThrow(
      'No loaded document matches "Contract.pdf". Loaded documents: BOQ.xlsx, contracts/Main.pdf.',
    );
  });

  it('falls back to keyword search when the query cannot be embedded, and says so', async () => {
    const index = await indexWith(contract);
    const vector = vi.spyOn(index, 'vectorSearch');

    const { output, summary } = await search(
      index,
      { query: 'retention' },
      { embeddings: failingEmbeddings(errors.missingApiKey()) },
    );

    expect(output.mode).toBe('keyword_only');
    expect(output.passages.map((passage) => [passage.page, passage.matched])).toEqual([
      [1, 'keyword'],
      [3, 'keyword'],
    ]);
    expect(output.note).toContain('Semantic search was unavailable (no model is set up)');
    expect(summary).toBe('2 passages from 1 document (keyword search only)');
    expect(vector).not.toHaveBeenCalled();
  });

  it('gives a plain reason when the embedding call fails for another cause', async () => {
    const { output } = await search(
      await indexWith(contract),
      { query: 'retention' },
      { embeddings: failingEmbeddings(new Error('socket hang up')) },
    );
    expect(output.note).toContain('(the embedding call failed)');
    expect(output.note).not.toContain('socket');
  });

  it('stops instead of falling back when the question was stopped', async () => {
    const controller = new AbortController();
    controller.abort();
    const attempt = search(
      await indexWith(contract),
      { query: 'retention' },
      { embeddings: failingEmbeddings(new Error('aborted')), signal: controller.signal },
    );
    await expect(attempt).rejects.toThrow('aborted');

    const stopped = search(await indexWith(contract), { query: 'retention' }, { embeddings: failingEmbeddings(errors.stopped()) });
    await expect(stopped).rejects.toThrow('The question was stopped.');
  });

  it('cuts long passages to about 500 characters around the keyword', async () => {
    const words = (from: number) => Array.from({ length: 150 }, (_, i) => `word${from + i}`).join(' ');
    const page = `${words(0)} the retention is released at handover ${words(150)}`;
    const { output } = await search(await indexWith(pdfRecord('long.pdf', [page])), { query: 'retention' });

    const snippet = output.passages[0]?.snippet ?? '';
    expect(snippet).toContain('the retention is released at handover');
    expect(snippet.length).toBeLessThanOrEqual(502);
    expect(snippet.length).toBeGreaterThan(400);
  });

  it('counts passages and documents in the summary', async () => {
    const index = await indexWith(contract, pdfRecord('specs/Spec.pdf', ['Retention bonds']));
    expect((await search(index, { query: 'retention' })).summary).toBe('4 passages from 2 documents');
    expect((await search(index, { query: 'retention', limit: 1 })).summary).toBe('1 passage from 1 document');
  });

  it('explains why nothing was found', async () => {
    const empty = await search(new FakeIndex(), { query: 'retention' });
    expect(empty.output.passages).toEqual([]);
    expect(empty.summary).toBe('No passages found');
    expect(empty.output.note).toContain('No passage matched');

    const index = await indexWith(
      { ...pdfRecord('broken.pdf', []), status: 'corrupt', statusDetail: 'The file is damaged and could not be opened.' },
      excelRecord('BOQ.xlsx', [boqTable([['A1', 'Piles', 10, 200, 2000]])]),
      { ...pdfRecord('scan.pdf', []), status: 'scanned', scannedPages: [1, 2] },
    );
    const broken = await search(index, { query: 'retention', document: 'broken.pdf' });
    expect(broken.summary).toBe('No passages found in broken.pdf');
    expect(broken.output.note).toBe('broken.pdf has no searchable text. The file is damaged and could not be opened.');
    expect((await search(index, { query: 'piles', document: 'BOQ.xlsx' })).output.note).toContain('query_tables');
    expect((await search(index, { query: 'retention', document: 'scan.pdf' })).output.note).toContain('look_at_page');
  });

  it('refuses an empty query', async () => {
    await expect(search(new FakeIndex(), { query: '   ' })).rejects.toBeInstanceOf(ToolError);
  });

  it('accepts a limit from 1 to 20 or null, and every field must be present', () => {
    const parse = (args: unknown) => searchDocuments.parameters.safeParse(args).success;
    expect(parse({ query: 'x', document: null, limit: null })).toBe(true);
    expect(parse({ query: 'x', document: 'a.pdf', limit: 20 })).toBe(true);
    expect(parse({ query: 'x', document: null, limit: 21 })).toBe(false);
    expect(parse({ query: 'x', document: null, limit: 0 })).toBe(false);
    expect(parse({ query: 'x', document: null, limit: 2.5 })).toBe(false);
    expect(parse({ query: 'x' })).toBe(false);
    expect(parse({ query: 'x', document: null, limit: null, page: 1 })).toBe(false);
  });

  it('is registered under its name', () => {
    expect(tools.filter((tool) => tool.name === 'search_documents')).toEqual([searchDocuments]);
  });
});
