import type { ScheduleKind } from '../../domain/schedule';
import { AppError } from '../errors';
import type { ModelClient } from '../ports/ModelClient';
import type { Candidate } from './collectCandidates';
import { confirmCandidates } from './confirmCandidates';

/** Most candidates in one model call. */
export const MAX_BATCH = 150;
/** At most this many calls run at the same time. */
export const MAX_BATCHES = 3;
/** A split never makes calls smaller than this: below it, an extra call saves no time. */
const MIN_BATCH = 30;

/** The model's word on one candidate: kept with its kind and label, dropped as no schedule item, or not checked. */
export type Verdict =
  | { status: 'kept'; kind: ScheduleKind; label: string | null }
  | { status: 'dropped' }
  | { status: 'failed'; reason: string };

export interface ConfirmOptions {
  model: ModelClient;
  modelId: string;
  signal: AbortSignal;
}

/**
 * Splits items, in order, into nearly equal batches that run at the same time: up to MAX_BATCHES of at least
 * MIN_BATCH each, and more only when a batch would pass MAX_BATCH.
 */
export function splitBatches<T>(items: readonly T[]): T[][] {
  if (items.length === 0) return [];
  const count = Math.max(Math.ceil(items.length / MAX_BATCH), Math.min(MAX_BATCHES, Math.floor(items.length / MIN_BATCH)));
  const size = Math.ceil(items.length / count);
  return Array.from({ length: Math.ceil(items.length / size) }, (_, i) => items.slice(i * size, (i + 1) * size));
}

/**
 * Asks the small model about the candidates, in up to three calls at the same time, and returns a verdict per
 * candidate id. A call that fails marks its own candidates as failed, with the reason; the other calls still count.
 * A stopped question throws.
 */
export async function confirmInBatches(candidates: readonly Candidate[], options: ConfirmOptions): Promise<Map<string, Verdict>> {
  const results = await Promise.all(splitBatches(candidates).map((batch) => confirmBatch(batch, options)));
  return new Map(results.flat());
}

async function confirmBatch(batch: Candidate[], options: ConfirmOptions): Promise<[string, Verdict][]> {
  try {
    const { items } = await confirmCandidates(batch, options);
    const kept = new Map(items.map((item) => [item.candidate.id, item]));
    return batch.map((candidate): [string, Verdict] => {
      const item = kept.get(candidate.id);
      return [candidate.id, item === undefined ? { status: 'dropped' } : { status: 'kept', kind: item.kind, label: item.label }];
    });
  } catch (error) {
    if (options.signal.aborted || (error instanceof AppError && error.code === 'stopped')) throw error;
    const reason = failureReason(error);
    return batch.map((candidate): [string, Verdict] => [candidate.id, { status: 'failed', reason }]);
  }
}

function failureReason(error: unknown): string {
  if (error instanceof AppError && error.code === 'missing_api_key') return 'no model is set up';
  if (error instanceof AppError && error.code === 'rate_limited') return "the model's rate limit was reached";
  return 'the model call failed';
}
