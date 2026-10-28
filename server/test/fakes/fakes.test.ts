import { describe, expect, it } from 'vitest';
import { Session } from '../../src/application/session/Session';
import { Workspace } from '../../src/application/workspace/Workspace';
import { FakeEmbeddingClient } from './FakeEmbeddingClient';
import { FakeFileSystem } from './FakeFileSystem';
import { FakeIndex } from './FakeIndex';
import { boqTable, excelRecord, pdfRecord } from './records';

describe('FakeIndex', () => {
  it('stores documents and finds them by name', () => {
    const index = new FakeIndex();
    index.save(pdfRecord('contracts/Main.pdf', ['Scope of works', 'Payment terms']));
    expect(index.find('main.pdf')?.path).toBe('contracts/Main.pdf');
    expect(index.readPages('contracts/Main.pdf', 2, 2)).toEqual([{ number: 2, text: 'Payment terms' }]);
  });

  it('searches by keyword and by vector', async () => {
    const index = new FakeIndex();
    index.save(pdfRecord('a.pdf', ['concrete works', 'electrical works']));
    const embeddings = new FakeEmbeddingClient();
    const pending = index.pendingEmbeddings(10);
    const { vectors } = await embeddings.embed(pending.map((chunk) => chunk.text));
    index.saveEmbeddings(pending.map((chunk, i) => ({ chunkId: chunk.chunkId, vector: vectors[i] as Float32Array })));
    expect(index.keywordSearch('electrical', { document: null, limit: 5 })[0]?.page).toBe(2);
    const [query] = (await embeddings.embed(['electrical'])).vectors;
    expect(index.vectorSearch(query as Float32Array, { document: null, limit: 1 })[0]?.page).toBe(2);
  });

  it('exposes tables with their rows', () => {
    const index = new FakeIndex();
    index.save(excelRecord('BOQ.xlsx', [boqTable([['A1', 'Piles', 10, 200000, 2000000]])]));
    const [table] = index.tables();
    expect(table?.name).toBe('boq_1');
    expect(index.tableRows('boq_1')[0]?.values.amount).toBe(2000000);
  });
});

describe('FakeFileSystem', () => {
  it('lists files recursively and skips hidden ones', async () => {
    const fs = new FakeFileSystem();
    fs.addFile('/f/a.pdf');
    fs.addFile('/f/sub/b.xlsx');
    fs.addFile('/f/.hidden/c.pdf');
    const files = await fs.listFiles('/f');
    expect(files.map((file) => file.relativePath)).toEqual(['a.pdf', 'sub/b.xlsx']);
    expect(await fs.isDirectory('/f/sub')).toBe(true);
  });
});

describe('Session and Workspace', () => {
  it('numbers saved results per session', () => {
    const session = new Session('s');
    const first = session.saveResult({ title: null, columns: ['a'], rows: [[1]], sources: [], tool: 'query_tables', detail: null });
    expect(first.id).toBe('r1');
    expect(session.result('r1')?.rows).toEqual([[1]]);
  });

  it('refuses work before a folder is loaded', () => {
    expect(() => new Workspace().require()).toThrow(/Load a folder/);
  });
});
