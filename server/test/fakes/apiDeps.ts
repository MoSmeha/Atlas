import type { ApiDeps } from '../../src/api/app';
import { AskQuestion, type AskQuestionDeps } from '../../src/application/AskQuestion';
import { ExportResult } from '../../src/application/ExportResult';
import { IndexFolder } from '../../src/application/indexing/IndexFolder';
import { SessionStore } from '../../src/application/session/SessionStore';
import { TranscribeSpeech, type TranscribeSpeechDeps } from '../../src/application/voice/TranscribeSpeech';
import { VoiceCalls, type VoiceCallsDeps } from '../../src/application/voice/VoiceCalls';
import { Workspace } from '../../src/application/workspace/Workspace';
import { FakeClock } from './FakeClock';
import { FakeEmbeddingClient } from './FakeEmbeddingClient';
import { FakeFileSystem } from './FakeFileSystem';
import { FakeIndex } from './FakeIndex';
import { FakeModelClient } from './FakeModelClient';
import { FakeExporter, FakePageRenderer } from './FakeOutputs';
import { FakeTranscriber } from './FakeTranscriber';
import { FakeVoiceClient } from './FakeVoiceClient';
import { testLineup } from './lineup';
import { MemoryRunLogger } from './MemoryRunLogger';
import { testVoiceCatalog } from './voiceCatalog';

/** VoiceCalls made of fakes: the test catalog and a voice client that records its calls. */
export function makeVoiceCalls(deps: Partial<VoiceCallsDeps> = {}): VoiceCalls {
  return new VoiceCalls({
    voiceClient: new FakeVoiceClient(),
    available: true,
    catalog: testVoiceCatalog,
    workspace: new Workspace(),
    sessions: new SessionStore(),
    logger: new MemoryRunLogger(),
    ...deps,
  });
}

/** TranscribeSpeech made of fakes, at the test catalog's dictation price. */
export function makeTranscribeSpeech(deps: Partial<TranscribeSpeechDeps> = {}): TranscribeSpeech {
  return new TranscribeSpeech({
    transcriber: new FakeTranscriber(),
    workspace: new Workspace(),
    sessions: new SessionStore(),
    logger: new MemoryRunLogger(),
    pricePerMinute: testVoiceCatalog.dictation.pricePerMinute,
    ...deps,
  });
}

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
    voice: {
      catalog: testVoiceCatalog,
      calls: makeVoiceCalls({ workspace, sessions }),
      transcribe: makeTranscribeSpeech({ workspace, sessions }),
      callsAvailable: false,
      dictationAvailable: false,
    },
    ...overrides,
  };
}
