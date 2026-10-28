import type { Classification, DocumentSummary } from '@atlas/shared';
import { AppError, errors } from '../errors';
import type { Clock } from '../ports/Clock';
import type { DocumentIndex } from '../ports/DocumentIndex';
import type { RunLogger } from '../ports/RunLogger';
import type { IndexStep, IndexStepContext } from './IndexFolder';

/** What the step needs from ClassifyDocument. */
export interface DocumentClassifier {
  classify(document: DocumentSummary, index: DocumentIndex, signal?: AbortSignal): Promise<Classification | null>;
}

export interface ClassificationStepDeps {
  /** Null without an API key; the step then does nothing. */
  classifier: DocumentClassifier | null;
  logger: RunLogger;
  clock: Clock;
  /** Documents classified at the same time. */
  concurrency?: number;
}

type Outcome = 'done' | 'failed' | 'no_key' | 'stopped';

const NO_KEY_DETAIL = 'The API key is missing or was rejected; documents are not classified.';

/**
 * The indexing step that classifies documents: every readable one saved in this pass, and any other with no
 * classification that this server has not classified yet, a few at a time. A document that fails is logged and
 * skipped; a missing or rejected API key ends the step quietly.
 */
export function classificationStep(deps: ClassificationStepDeps): IndexStep {
  const concurrency = Math.max(1, Math.floor(deps.concurrency ?? 4));
  // Paths classified per folder, so a document left unclassified for low confidence is not sent again on every update.
  const classified = new Map<string, Set<string>>();

  async function classifyOne(
    classifier: DocumentClassifier,
    context: IndexStepContext,
    document: DocumentSummary,
    done: Set<string>,
  ): Promise<Outcome> {
    const { folder, index, signal } = context;
    const started = deps.clock.now().getTime();
    const log = (status: string, detail: string) =>
      deps.logger.indexing({ folder, file: document.path, status, durationMs: deps.clock.now().getTime() - started, detail });
    try {
      const classification = await classifier.classify(document, index, signal);
      if (signal.aborted) return 'stopped';
      index.setClassification(document.path, classification);
      done.add(document.path);
      context.documentChanged(document.path);
      log('classified', classification === null ? 'Not confident enough to classify.' : `${classification.type}, confidence ${classification.confidence}`);
      return 'done';
    } catch (error) {
      if (signal.aborted) return 'stopped';
      if (error instanceof AppError && error.code === 'missing_api_key') return 'no_key';
      log('classification_failed', logText(error));
      return 'failed';
    }
  }

  return {
    phase: 'classifying',
    async run(context) {
      const { classifier } = deps;
      if (classifier === null) return;
      const done = classified.get(context.folder) ?? new Set<string>();
      classified.set(context.folder, done);
      const changed = new Set(context.changedPaths);
      const queue = context.index
        .documents()
        .filter((document) => isReadable(document) && (changed.has(document.path) || (document.classification === null && !done.has(document.path))));

      let next = 0;
      let noKey = false;
      const worker = async () => {
        while (!noKey && !context.signal.aborted && next < queue.length) {
          const document = queue[next++] as DocumentSummary;
          context.report({ current: next, total: queue.length, file: document.name, message: `Classifying ${next} of ${queue.length}` });
          if ((await classifyOne(classifier, context, document, done)) === 'no_key') noKey = true;
        }
      };
      await Promise.all(Array.from({ length: Math.min(concurrency, queue.length) }, worker));
      if (context.signal.aborted) throw errors.stopped();
      if (noKey) deps.logger.indexing({ folder: context.folder, file: '', status: 'classification_skipped', durationMs: 0, detail: NO_KEY_DETAIL });
    },
  };
}

function isReadable(document: DocumentSummary): boolean {
  return document.status === 'ok' && document.kind !== 'other';
}

function logText(error: unknown): string {
  if (error instanceof AppError) return `${error.code}: ${error.message}`;
  return error instanceof Error ? (error.stack ?? error.message) : String(error);
}
