import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { buildApp, type ApiDeps } from './api/app';
import { AskQuestion } from './application/AskQuestion';
import { ExportResult } from './application/ExportResult';
import { classificationStep } from './application/indexing/classificationStep';
import { ClassifyDocument } from './application/indexing/ClassifyDocument';
import { IndexFolder } from './application/indexing/IndexFolder';
import { suggestionsStep } from './application/indexing/suggestionsStep';
import { WatchFolder } from './application/indexing/WatchFolder';
import type { Lineup } from './application/models/pickLineup';
import type { Clock } from './application/ports/Clock';
import type { EmbeddingClient } from './application/ports/EmbeddingClient';
import type { FileSystem } from './application/ports/FileSystem';
import type { ModelClient } from './application/ports/ModelClient';
import type { RunLogger } from './application/ports/RunLogger';
import { SessionStore } from './application/session/SessionStore';
import { TranscribeSpeech } from './application/voice/TranscribeSpeech';
import type { VoiceCatalog } from './application/voice/VoiceCatalog';
import { VoiceCalls } from './application/voice/VoiceCalls';
import { Workspace } from './application/workspace/Workspace';
import { loadModelConfig, type ModelConfig } from './infrastructure/config/modelConfig';
import { loadVoiceConfig } from './infrastructure/config/voiceConfig';
import { XlsxExporter } from './infrastructure/export/XlsxExporter';
import { NodeFileSystem } from './infrastructure/fs/NodeFileSystem';
import { SqliteIndexFactory } from './infrastructure/index/SqliteIndexFactory';
import { JsonlRunLogger } from './infrastructure/logging/JsonlRunLogger';
import { createOpenAiClient } from './infrastructure/openai/createOpenAiClient';
import { OpenAiEmbeddingClient } from './infrastructure/openai/OpenAiEmbeddingClient';
import { OpenAiModelClient } from './infrastructure/openai/OpenAiModelClient';
import { OpenAiTranscriber } from './infrastructure/openai/OpenAiTranscriber';
import { OpenAiVoiceClient } from './infrastructure/openai/OpenAiVoiceClient';
import { resolveModels } from './infrastructure/openai/resolveLineup';
import { ExcelJsReader } from './infrastructure/readers/ExcelJsReader';
import { MupdfPageRenderer } from './infrastructure/readers/MupdfPageRenderer';
import { MupdfReader } from './infrastructure/readers/MupdfReader';
import { loadSettings, repoRoot, type Settings } from './infrastructure/settings';
import { SystemClock } from './infrastructure/SystemClock';
import { ChokidarWatcher } from './infrastructure/watch/ChokidarWatcher';

const VERSION = '0.1.0';
/** How long shutdown waits for open requests, such as event streams, before the process exits anyway. */
const SHUTDOWN_GRACE_MS = 3_000;

/** Everything the server and the CLI share, built once by compose(). */
export interface Container {
  settings: Settings;
  modelConfig: ModelConfig;
  /** One model per tier; the default answer model is `lineup[modelConfig.answerTier]`. */
  lineup: Lineup;
  /** Null while OPENAI_API_KEY is unset; use cases then throw missing_api_key. */
  modelClient: ModelClient | null;
  /** Null while OPENAI_API_KEY is unset; search then works by keyword only. */
  embeddings: EmbeddingClient | null;
  clock: Clock;
  logger: RunLogger;
  fs: FileSystem;
  /** The loaded folder, its index and its status. */
  workspace: Workspace;
  indexFolder: IndexFolder;
  /** Watches each folder the indexer loads; stop it before exiting. */
  watchFolder: WatchFolder;
  /** Chats by session id: turns, saved results and spend. */
  sessions: SessionStore;
  askQuestion: AskQuestion;
  voiceCatalog: VoiceCatalog;
  /** Voice calls still open; hang them up before exiting. */
  voiceCalls: VoiceCalls;
  api: ApiDeps;
}

/** The composition root: wires concrete adapters into use cases. The CLI reuses it. */
export async function compose(settings: Settings = loadSettings()): Promise<Container> {
  const clock = new SystemClock();
  const logger = new JsonlRunLogger(settings.logDir, clock);
  const fs = new NodeFileSystem();
  const sessions = new SessionStore();
  const exporter = new XlsxExporter();
  const modelConfig = loadModelConfig();
  const voiceCatalog = loadVoiceConfig();
  const openAi = settings.openAiApiKey === null ? null : createOpenAiClient(settings.openAiApiKey);
  const modelClient = openAi === null ? null : new OpenAiModelClient(openAi);
  const embeddings = openAi === null ? null : new OpenAiEmbeddingClient(openAi, modelConfig.embedding);
  const voiceClient = openAi === null ? null : new OpenAiVoiceClient(openAi, join(settings.dataDir, 'voices.json'));
  const transcriber = openAi === null ? null : new OpenAiTranscriber(openAi, voiceCatalog.dictation.model);
  const { lineup, visible } = await resolveModels(modelClient, modelConfig);
  // When the list could not be read, trust the config, as the lineup does.
  const canUse = (model: string) => visible === null || visible.includes(model);
  const workspace = new Workspace();
  const classifier = modelClient === null ? null : new ClassifyDocument(modelClient, lineup.small.id);
  const indexFolder = new IndexFolder({
    fs,
    readers: [new MupdfReader(), new ExcelJsReader()],
    indexes: new SqliteIndexFactory(settings.dataDir),
    embeddings,
    workspace,
    logger,
    clock,
    maxFileBytes: settings.maxFileBytes,
    steps: [classificationStep({ classifier, logger, clock }), suggestionsStep(workspace)],
    onFolderActivated: (folder) => watchFolder.start(folder),
  });
  const watchFolder = new WatchFolder({ watcher: new ChokidarWatcher(), updates: indexFolder, logger });
  const askQuestion = new AskQuestion({
    workspace,
    sessions,
    modelClient,
    embeddings,
    renderer: new MupdfPageRenderer(),
    exporter,
    clock,
    logger,
    lineup,
    answerTier: modelConfig.answerTier,
    reasoningEffort: modelConfig.reasoningEffort,
    maxRounds: settings.maxRounds,
    exportsDir: settings.exportsDir,
  });
  const callsAvailable = voiceClient !== null && canUse(voiceCatalog.call.model);
  const dictationAvailable = transcriber !== null && canUse(voiceCatalog.dictation.model);
  const voiceCalls = new VoiceCalls({ voiceClient, available: callsAvailable, catalog: voiceCatalog, workspace, sessions, logger, clock });
  const transcribeSpeech = new TranscribeSpeech({
    transcriber: dictationAvailable ? transcriber : null,
    workspace,
    sessions,
    logger,
    pricePerMinute: voiceCatalog.dictation.pricePerMinute,
  });
  const apiKeyPresent = settings.openAiApiKey !== null;
  return {
    settings,
    modelConfig,
    lineup,
    modelClient,
    embeddings,
    clock,
    logger,
    fs,
    workspace,
    indexFolder,
    watchFolder,
    sessions,
    askQuestion,
    voiceCatalog,
    voiceCalls,
    api: {
      health: { version: VERSION, apiKeyPresent },
      exports: { sessions, exportResult: new ExportResult(exporter, clock), exportsDir: settings.exportsDir },
      folder: { indexFolder, workspace, repoRoot },
      documents: { workspace },
      uploads: { indexFolder, uploadsDir: join(settings.dataDir, 'uploads'), maxFileBytes: settings.maxFileBytes },
      chat: { askQuestion, sessions, workspace, apiKeyPresent },
      models: { lineup, answerTier: modelConfig.answerTier },
      usage: { sessions },
      voice: { catalog: voiceCatalog, calls: voiceCalls, transcribe: transcribeSpeech, callsAvailable, dictationAvailable },
    },
  };
}

async function start(): Promise<void> {
  const settings = loadSettings();
  const container = await compose(settings);
  const app = buildApp(container.api);
  app.addHook('onClose', () => container.watchFolder.stop());
  // An open call bills by the second, so stopping the server hangs up every call it started.
  app.addHook('onClose', () => container.voiceCalls.hangUpAll());
  for (const signal of ['SIGINT', 'SIGTERM'] as const) process.once(signal, () => void shutdown(app));
  await app.listen({ port: settings.port, host: settings.host });
  const { frontier, balanced, small } = container.lineup;
  console.log(`Atlas server listening on http://${settings.host}:${settings.port}`);
  console.log(`Models: frontier ${frontier.id}, balanced ${balanced.id}, small ${small.id}`);
  // Each designed voice is made once, in the background, so no call waits for its voice; later starts skip them.
  void container.voiceCalls.prepareVoices();
  if (settings.startFolder !== null) await loadStartFolder(container, settings.startFolder);
}

/** Closes the server, which stops the folder watch, and exits; open event streams get a short grace period. */
async function shutdown(app: ReturnType<typeof buildApp>): Promise<void> {
  const grace = new Promise<void>((resolve) => setTimeout(resolve, SHUTDOWN_GRACE_MS).unref());
  try {
    await Promise.race([app.close(), grace]);
  } catch (error) {
    console.error(error);
  }
  process.exit(0);
}

/** Loads ATLAS_FOLDER; a folder that cannot be loaded is reported and the server keeps running. */
async function loadStartFolder(container: Container, folder: string): Promise<void> {
  try {
    await container.indexFolder.load(folder);
    console.log(`Loading ${folder}`);
  } catch (error) {
    console.warn(`Could not load ${folder}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  start().catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  });
}
