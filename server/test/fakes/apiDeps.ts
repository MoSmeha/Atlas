import type { ApiDeps } from '../../src/api/app';
import { ExportResult } from '../../src/application/ExportResult';
import { IndexFolder } from '../../src/application/indexing/IndexFolder';
import { SessionStore } from '../../src/application/session/SessionStore';
import { Workspace } from '../../src/application/workspace/Workspace';
import { FakeClock } from './FakeClock';
import { FakeFileSystem } from './FakeFileSystem';
import { FakeIndex } from './FakeIndex';
import { FakeExporter } from './FakeOutputs';
import { MemoryRunLogger } from './MemoryRunLogger';

/** ApiDeps made of fakes; pass overrides for the features a test cares about. */
export function makeApiDeps(overrides: Partial<ApiDeps> = {}): ApiDeps {
  const workspace = new Workspace();
  const indexFolder = new IndexFolder({
    fs: new FakeFileSystem(),
    readers: [],
    indexes: { open: () => new FakeIndex() },
    embeddings: null,
    workspace,
    logger: new MemoryRunLogger(),
    clock: new FakeClock(),
    maxFileBytes: 10 * 1024 * 1024,
  });
  return {
    health: { version: 'test', apiKeyPresent: false },
    exports: {
      sessions: new SessionStore(),
      exportResult: new ExportResult(new FakeExporter(), new FakeClock()),
      exportsDir: '/exports',
    },
    folder: { indexFolder, workspace, repoRoot: '/repo' },
    documents: { workspace },
    uploads: { indexFolder, uploadsDir: '/data/uploads', maxFileBytes: 10 * 1024 * 1024 },
    ...overrides,
  };
}
