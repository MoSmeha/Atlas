import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { JsonlRunLogger } from '../../src/infrastructure/logging/JsonlRunLogger';
import { FakeClock } from '../fakes/FakeClock';

describe('JsonlRunLogger', () => {
  it('appends one JSON line per event to a dated file', () => {
    const dir = join(mkdtempSync(join(tmpdir(), 'atlas-logs-')), '.logs');
    const logger = new JsonlRunLogger(dir, new FakeClock('2026-10-28T09:30:00Z'));
    logger.tool({ questionId: 'q1', tool: 'query_tables', inputSummary: 'SELECT 1', durationMs: 4, resultBytes: 20, error: null });
    logger.indexing({ folder: '/f', file: 'a.pdf', status: 'corrupt', durationMs: 2, detail: 'bad xref' });
    logger.voice({ event: 'call_end', sessionId: 's1', callId: 'live_1', voice: 'gulf-female', seconds: 90, costUsd: 0.075, error: null });

    const lines = readFileSync(join(dir, '2026-10-28.jsonl'), 'utf8').trim().split('\n').map((line) => JSON.parse(line));
    expect(lines).toHaveLength(3);
    expect(lines[0]).toMatchObject({ type: 'tool', tool: 'query_tables', at: '2026-10-28T09:30:00.000Z' });
    expect(lines[1]).toMatchObject({ type: 'indexing', status: 'corrupt' });
    expect(lines[2]).toMatchObject({ type: 'voice', event: 'call_end', voice: 'gulf-female', seconds: 90 });
  });
});
