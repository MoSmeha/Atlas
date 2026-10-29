import type { Answer, Usage } from '@atlas/shared';
import { describe, expect, it } from 'vitest';
import { chatReducer, noTurns } from '../../src/features/chat/chatReducer';

const answer: Answer = {
  kind: 'answer',
  language: 'en',
  markdown: 'The fee is SAR 1,000.',
  table: null,
  sources: [],
  unreadableFiles: [],
  warnings: [],
};
const usage: Usage = { model: 'm', inputTokens: 1, cachedInputTokens: 0, outputTokens: 1, reasoningTokens: 0, costUsd: 0, durationMs: 1 };

describe('chatReducer', () => {
  it('marks a spoken question and keeps what Atlas said aloud after the answer', () => {
    let turns = chatReducer(noTurns, { type: 'asked', turnId: 't1', question: 'What is the fee?', spoken: true });
    turns = chatReducer(turns, { type: 'answered', turnId: 't1', answer, usage });
    turns = chatReducer(turns, { type: 'said', turnId: 't1', text: 'The fee is ' });
    turns = chatReducer(turns, { type: 'said', turnId: 't1', text: 'SAR 1,000.' });
    expect(turns[0]).toMatchObject({ spoken: true, status: 'done', said: 'The fee is SAR 1,000.' });
  });

  it('keeps a retried spoken question spoken, with nothing said yet', () => {
    let turns = chatReducer(noTurns, { type: 'asked', turnId: 't1', question: 'What is the fee?', spoken: true });
    turns = chatReducer(turns, { type: 'said', turnId: 't1', text: 'Checking.' });
    turns = chatReducer(turns, { type: 'retried', turnId: 't1' });
    expect(turns[0]).toMatchObject({ spoken: true, status: 'streaming', said: '' });
  });

  it('starts a typed question unspoken', () => {
    const turns = chatReducer(noTurns, { type: 'asked', turnId: 't1', question: 'What is the fee?', spoken: false });
    expect(turns[0]).toMatchObject({ spoken: false, said: '' });
  });
});
