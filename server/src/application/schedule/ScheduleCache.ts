import type { Candidate, DocumentCandidates } from './collectCandidates';
import type { Verdict } from './confirmInBatches';

/** The verdict for a candidate the check left out; it never happens with confirmInBatches. */
const unchecked: Promise<Verdict> = Promise.resolve({ status: 'failed', reason: 'the model call failed' });

/** A candidate with the key it is remembered by: its document's version, its place and its text. */
export interface KeyedCandidate {
  candidate: Candidate;
  key: string;
}

/**
 * What extract_schedule learned in one chat, so the same work is never done twice: each document's candidates, the
 * model's verdict on each candidate, and the saved result of each scope. Every key holds the version of the files
 * it depends on, so a changed file is read and checked again. Verdicts still being checked are shared, so calls
 * running at the same time ask the model once. Failed checks are forgotten, so the next call tries again.
 */
export class ScheduleCache {
  private readonly documents = new Map<string, DocumentCandidates>();
  private readonly verdicts = new Map<string, Promise<Verdict>>();
  private readonly results = new Map<string, string>();

  /** The candidates of one version of a document, collected once. */
  candidates(version: string, collect: () => DocumentCandidates): DocumentCandidates {
    const known = this.documents.get(version);
    if (known !== undefined) return known;
    const collected = collect();
    this.documents.set(version, collected);
    return collected;
  }

  /**
   * One verdict per candidate, in order. Candidates checked before, or being checked, reuse that verdict; the rest
   * go to `check` in one call, which returns a verdict per candidate id. `fresh` counts the candidates sent.
   */
  async check(
    candidates: readonly KeyedCandidate[],
    check: (fresh: Candidate[]) => Promise<Map<string, Verdict>>,
  ): Promise<{ verdicts: Verdict[]; fresh: number }> {
    const fresh = candidates.filter(({ key }) => !this.verdicts.has(key));
    if (fresh.length > 0) {
      const running = check(fresh.map(({ candidate }) => candidate));
      for (const { candidate, key } of fresh) {
        const verdict = running.then(async (verdicts) => verdicts.get(candidate.id) ?? unchecked);
        this.verdicts.set(key, verdict);
        verdict.then(
          (settled) => settled.status === 'failed' && this.forget(key, verdict),
          () => this.forget(key, verdict),
        );
      }
    }
    const verdicts = await Promise.all(candidates.map(({ key }) => this.verdicts.get(key) ?? unchecked));
    return { verdicts, fresh: fresh.length };
  }

  /** The id of the result saved for this scope and these file versions, if every candidate in it was checked. */
  result(scope: string): string | null {
    return this.results.get(scope) ?? null;
  }

  rememberResult(scope: string, resultId: string): void {
    this.results.set(scope, resultId);
  }

  private forget(key: string, verdict: Promise<Verdict>): void {
    if (this.verdicts.get(key) === verdict) this.verdicts.delete(key);
  }
}
