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
import { loadModelConfig, type ProviderModels } from './infrastructure/config/modelConfig';
import { loadVoiceConfig } from './infrastructure/config/voiceConfig';
import { XlsxExporter } from './infrastructure/export/XlsxExporter';
import { NodeFileSystem } from './infrastructure/fs/NodeFileSystem';
import { SqliteIndexFactory } from './infrastructure/index/SqliteIndexFactory';
import { pickLocalModels, type LocalScan } from './infrastructure/local/pickLocalModels';
import { scanLocal } from './infrastructure/local/scanLocal';
import { JsonlRunLogger } from './infrastructure/logging/JsonlRunLogger';
import { createOpenAiClient } from './infrastructure/openai/createOpenAiClient';
import { OpenAiModelClient } from './infrastructure/openai/OpenAiModelClient';
import { OpenAiTranscriber } from './infrastructure/openai/OpenAiTranscriber';
import { OpenAiVoiceClient } from './infrastructure/openai/OpenAiVoiceClient';
import { resolveModels, visibleModels } from './infrastructure/openai/resolveLineup';
import { chooseProvider, type ProviderChoice } from './infrastructure/providers/chooseProvider';
import { connectProvider, type Provider } from './infrastructure/providers/connectProvider';
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
  /** The answering provider's models; OpenAI's while no provider is set up. */
  modelConfig: ProviderModels;
  /** One model per tier; the default answer model is `lineup[modelConfig.answerTier]`. */
  lineup: Lineup;
  /** Who answers, and why; a null id means no provider is set up. */
  providerChoice: ProviderChoice;
  /** Null while no provider is set up; use cases then throw missing_api_key. */
  provider: Provider | null;
  /** Why local models are not used, when the machine was scanned and they are not; null otherwise. */
  localProblem: string | null;
  /** Null while no provider is set up; use cases then throw missing_api_key. */
  modelClient: ModelClient | null;
  /** Null while no provider is set up; search then works by keyword only. */
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

/**
 * The composition root: wires concrete adapters into use cases. The CLI reuses it. `scan` reads this machine and
 * its Ollama server when the provider may be local; tests pass a stand-in.
 */
export async function compose(settings: Settings = loadSettings(), scan: (ollamaUrl: string) => Promise<LocalScan> = scanLocal): Promise<Container> {
  const clock = new SystemClock();
  const logger = new JsonlRunLogger(settings.logDir, clock);
  const fs = new NodeFileSystem();
  const sessions = new SessionStore();
  const exporter = new XlsxExporter();
  const config = loadModelConfig();
  const voiceCatalog = loadVoiceConfig();
  const scansLocal = settings.provider === 'auto' || settings.provider === 'ollama';
  const local = scansLocal
    ? pickLocalModels(await scan(settings.ollamaUrl), { minChatBillions: config.ollama.minChatBillions, allowCpu: settings.provider === 'ollama' })
    : null;
  const providerChoice = chooseProvider({
    setting: settings.provider,
    hasOpenAiKey: settings.openAiApiKey !== null,
    hasGeminiKey: settings.geminiApiKey !== null,
    local,
  });
  const provider = providerChoice.id === null ? null : connectProvider(providerChoice.id, settings, config, local);
  const modelConfig = provider?.models ?? config.openai;
  const modelClient = provider?.modelClient ?? null;
  const embeddings = provider?.embeddings ?? null;
  // Voice calls and dictation stay on OpenAI, whichever provider answers.
  const openAi = settings.openAiApiKey === null ? null : createOpenAiClient(settings.openAiApiKey);
  const voiceClient = openAi === null ? null : new OpenAiVoiceClient(openAi, join(settings.dataDir, 'voices.json'));
  const transcriber = openAi === null ? null : new OpenAiTranscriber(openAi, voiceCatalog.dictation.model);
  const { lineup, visible } = await resolveModels(modelClient, modelConfig);
  const openAiVisible = provider?.id === 'openai' ? visible : openAi === null ? null : await visibleModels(new OpenAiModelClient(openAi));
  // When the list could not be read, trust the config, as the lineup does.
  const canUse = (model: string) => openAiVisible === null || openAiVisible.includes(model);
  const workspace = new Workspace();
  const uploadsDir = join(settings.dataDir, 'uploads');
  const classifier = modelClient === null ? null : new ClassifyDocument(modelClient, lineup.small.id);
  const indexFolder = new IndexFolder({
    fs,
    readers: [new MupdfReader(), new ExcelJsReader()],
    indexes: new SqliteIndexFactory(settings.dataDir, provider?.embeddingKey ?? null),
    embeddings,
    workspace,
    logger,
    clock,
    maxFileBytes: settings.maxFileBytes,
    steps: [classificationStep({ classifier, logger, clock }), suggestionsStep(workspace)],
    onFolderActivated: (folder) => watchFolder.start(folder),
    onFolderUnloaded: () => watchFolder.stop(),
    uploadsDir,
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
  const apiKeyPresent = modelClient !== null;
  return {
    settings,
    modelConfig,
    lineup,
    providerChoice,
    provider,
    localProblem: provider?.id === 'ollama' ? null : (local?.problem ?? null),
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
      uploads: { indexFolder, uploadsDir, maxFileBytes: settings.maxFileBytes },
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
  console.log(`Atlas server listening on http://${settings.host}:${settings.port}`);
  for (const line of providerReport(container)) console.log(line);
  // Each designed voice is made once, in the background, so no call waits for its voice; later starts skip them.
  void container.voiceCalls.prepareVoices();
  if (settings.startFolder !== null) await loadStartFolder(container, settings.startFolder);
}

/** Who answers and why, the lineup, and why local models are not used, for the start-up log. */
export function providerReport({ provider, providerChoice, lineup, localProblem }: Container): string[] {
  const { frontier, balanced, small } = lineup;
  const lines =
    provider === null
      ? [`Models: none. ${providerChoice.reason}`]
      : [
          `Models: ${provider.label}. ${providerChoice.reason}`,
          `  Lineup: frontier ${frontier.id}, balanced ${balanced.id}, small ${small.id}`,
          ...(provider.notice === null ? [] : [`  Note: ${provider.notice}`]),
        ];
  if (localProblem !== null) lines.push(`  Local models: ${capitalise(localProblem)}`);
  return lines;
}

function capitalise(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
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
