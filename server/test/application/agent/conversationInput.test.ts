import { describe, expect, it } from 'vitest';
import type { Answer, Usage } from '@atlas/shared';
import { conversationInput, describeAnswer, MEMORY_TURNS } from '../../../src/application/agent/conversationInput';
import { Session } from '../../../src/application/session/Session';

const usage: Usage = {
  model: 'frontier-model',
  inputTokens: 1,
  cachedInputTokens: 0,
  outputTokens: 1,
  reasoningTokens: 0,
  costUsd: 0,
  durationMs: 1,
};

function answer(markdown: string, overrides: Partial<Answer> = {}): Answer {
  return { kind: 'answer', language: 'en', markdown, table: null, sources: [], unreadableFiles: [], warnings: [], ...overrides };
}

describe('conversationInput', () => {
  it('is just the question in a new chat', () => {
    expect(conversationInput(new Session('s'), 'What is the contract value?')).toEqual([
      { type: 'message', role: 'user', content: 'What is the contract value?' },
    ]);
  });

  it('replays the last six turns as question and answer, then the new question', () => {
    const session = new Session('s');
    for (let i = 1; i <= 8; i++) session.addTurn({ question: `Question ${i}`, answer: answer(`Answer ${i}`) }, usage);

    const input = conversationInput(session, 'Question 9');
    expect(input).toHaveLength(2 * MEMORY_TURNS + 1);
    expect(input[0]).toEqual({ type: 'message', role: 'user', content: 'Question 3' });
    expect(input[1]).toEqual({ type: 'message', role: 'assistant', content: 'Answer 3' });
    expect(input.at(-2)).toEqual({ type: 'message', role: 'assistant', content: 'Answer 8' });
    expect(input.at(-1)).toEqual({ type: 'message', role: 'user', content: 'Question 9' });
  });
});

describe('describeAnswer', () => {
  it('adds the first rows of the table under its result id, then the sources', () => {
    const rows = Array.from({ length: 42 }, (_, i) => [`A${i + 1}`, 'Concrete | C40\nworks', 1000 * (i + 1), null]);
    const text = describeAnswer(
      answer('There are **42** concrete items.', {
        table: { resultId: 'r3', title: 'Concrete items', columns: ['item_code', 'description', 'amount', 'note'], rows, totalRows: 42 },
        sources: [
          { kind: 'excel', document: 'BOQ.xlsx', sheet: 'Bill 1', rowFrom: 5, rowTo: 46 },
          { kind: 'excel', document: 'BOQ.xlsx', sheet: 'Bill 2', rowFrom: 7, rowTo: 7 },
          { kind: 'pdf', document: 'Main.pdf', page: 3, quote: 'C40 concrete' },
        ],
      }),
    );
    expect(text).toBe(
      [
        'There are **42** concrete items.',
        '',
        'Result r3 "Concrete items" (first 5 of 42 rows):',
        'item_code | description | amount | note',
        'A1 | Concrete / C40 works | 1000 | ',
        'A2 | Concrete / C40 works | 2000 | ',
        'A3 | Concrete / C40 works | 3000 | ',
        'A4 | Concrete / C40 works | 4000 | ',
        'A5 | Concrete / C40 works | 5000 | ',
        '',
        'Sources: BOQ.xlsx, sheet Bill 1, rows 5-46; BOQ.xlsx, sheet Bill 2, row 7; Main.pdf, page 3.',
      ].join('\n'),
    );
  });

  it('counts small and empty results in full', () => {
    const table = { resultId: 'r1', title: null, columns: ['currency', 'total'], rows: [['SAR', 1250000]], totalRows: 1 };
    expect(describeAnswer(answer('Total.', { table }))).toBe('Total.\n\nResult r1 (1 row):\ncurrency | total\nSAR | 1250000');
    const empty = { ...table, rows: [], totalRows: 0 };
    expect(describeAnswer(answer('None.', { table: empty }))).toBe('None.\n\nResult r1 (no rows).');
  });

  it('caps a long source list', () => {
    const sources = Array.from({ length: 13 }, (_, i) => ({ kind: 'pdf' as const, document: 'Spec.pdf', page: i + 1, quote: null }));
    expect(describeAnswer(answer('Found.', { sources }))).toMatch(/Spec\.pdf, page 10; and 3 more\.$/);
  });
});
