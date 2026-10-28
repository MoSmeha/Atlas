import type { ApiDeps } from '../../src/api/app';
import { AskQuestion, type AskQuestionDeps } from '../../src/application/AskQuestion';
import { ExportResult } from '../../src/application/ExportResult';
import { IndexFolder } from '../../src/application/indexing/IndexFolder';
import { SessionStore } from '../../src/application/session/SessionStore';
import { Workspace } from '../../src/application/workspace/Workspace';
import { FakeClock } from './FakeClock';
import { FakeEmbeddingClient } from './FakeEmbeddingClient';
import { FakeFileSystem } from './FakeFileSystem';
import { FakeIndex } from './FakeIndex';
import { FakeModelClient } from './FakeModelClient';
import { FakeExporter, FakePageRenderer } from './FakeOutputs';
import { testLineup } from './lineup';
import { MemoryRunLogger } from './MemoryRunLogger';

/** AskQuestion made of fakes: an empty model script, the test lineup, six rounds. */
export function makeAskQuestion(deps: Partial<AskQuestionDeps> = {}): AskQuestion {
  return new AskQuestion({
    workspace: new Workspace(),
    sessions: new SessionStore(),
    modelClient: new FakeModelClient(),
    embeddings: new FakeEmbeddingClient(),
    renderer: new FakePageRenderer(),
    exporter: new FakeExporter(),
    clock: new FakeClock(),
    logger: new MemoryRunLogger(),
    lineup: testLineup,
    answerTier: 'frontier',
    reasoningEffort: null,
    maxRounds: 6,
    exportsDir: '/exports',
    ...deps,
  });
}

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
  const sessions = new SessionStore();
  return {
    health: { version: 'test', apiKeyPresent: false },
    exports: {
      sessions,
      exportResult: new ExportResult(new FakeExporter(), new FakeClock()),
      exportsDir: '/exports',
    },
    folder: { indexFolder, workspace, repoRoot: '/repo' },
    documents: { workspace },
    uploads: { indexFolder, uploadsDir: '/data/uploads', maxFileBytes: 10 * 1024 * 1024 },
    chat: { askQuestion: makeAskQuestion({ workspace, sessions }), sessions, workspace, apiKeyPresent: false },
    models: { lineup: testLineup, answerTier: 'frontier' },
    usage: { sessions },
    ...overrides,
  };
}
