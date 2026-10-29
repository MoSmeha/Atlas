import { describe, expect, it } from 'vitest';
import { Answer, ChatEvent, ChatRequest, EndCallRequest, routes, Source, StartCallRequest, VoiceOption } from '../src/index';

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

  it('marks a spoken question and parses the text a call reads aloud', () => {
    expect(ChatRequest.parse({ sessionId: 's1', question: 'What is the contract value?', spoken: true }).spoken).toBe(true);
    expect(ChatRequest.parse({ sessionId: 's1', question: 'What is the contract value?' }).spoken).toBeUndefined();
    expect(ChatEvent.parse({ type: 'speech', text: 'The contract value is SAR 12,500,000.' })).toEqual({
      type: 'speech',
      text: 'The contract value is SAR 12,500,000.',
    });
  });

  it('parses an Arabic dialect voice and rejects a dialect Atlas does not offer', () => {
    const gulf = { id: 'gulf-female', label: 'Gulf Arabic', nativeLabel: 'خليجي', language: 'ar', dialect: 'gulf', gender: 'female' };
    expect(VoiceOption.parse(gulf).dialect).toBe('gulf');
    expect(VoiceOption.safeParse({ ...gulf, dialect: 'iraqi' }).success).toBe(false);
  });

  it('bounds a call start and a call end', () => {
    expect(StartCallRequest.safeParse({ sessionId: 's1', voiceId: 'gulf-female', sdp: 'v=0' }).success).toBe(true);
    expect(StartCallRequest.safeParse({ sessionId: 's1', voiceId: 'gulf-female', sdp: '' }).success).toBe(false);
    expect(EndCallRequest.safeParse({ sessionId: 's1', seconds: 75.5, hangUp: false }).success).toBe(true);
    expect(EndCallRequest.safeParse({ sessionId: 's1', seconds: -1, hangUp: false }).success).toBe(false);
  });

  it('escapes a call id in the end route', () => {
    expect(routes.voiceCallEnd('live_1/2')).toBe('/api/voice/calls/live_1%2F2/end');
  });
});
