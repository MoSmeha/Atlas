import { describe, expect, it } from 'vitest';
import { Answer, ChatEvent, Source } from '../src/index';

describe('shared schemas', () => {
  it('parses a PDF source and an Excel source', () => {
    expect(Source.parse({ kind: 'pdf', document: 'Contract.pdf', page: 4, quote: null }).kind).toBe('pdf');
    expect(Source.parse({ kind: 'excel', document: 'BOQ.xlsx', sheet: 'Bill 2', rowFrom: 12, rowTo: 18 }).kind).toBe('excel');
  });

  it('rejects a source with page 0', () => {
    expect(Source.safeParse({ kind: 'pdf', document: 'a.pdf', page: 0, quote: null }).success).toBe(false);
  });

  it('parses a final answer event', () => {
    const answer: Answer = {
      kind: 'answer',
      language: 'en',
      markdown: 'Two items are above SAR 1,000,000.',
      table: { resultId: 'r1', title: null, columns: ['item', 'amount'], rows: [['A-01', 1250000]], totalRows: 1 },
      sources: [{ kind: 'excel', document: 'BOQ.xlsx', sheet: 'Bill 1', rowFrom: 5, rowTo: 5 }],
      unreadableFiles: [],
      warnings: [],
    };
    const usage = {
      model: 'm',
      inputTokens: 10,
      cachedInputTokens: 0,
      outputTokens: 5,
      reasoningTokens: 0,
      costUsd: 0.001,
      durationMs: 900,
    };
    const event = ChatEvent.parse({ type: 'answer', answer, usage });
    expect(event.type).toBe('answer');
  });
});
