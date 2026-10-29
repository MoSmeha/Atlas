import { describe, expect, it } from 'vitest';
import {
  type Fragment,
  joinQuestion,
  latestUtterance,
  startsNewTurn,
  wordsBetween,
} from '../../src/features/voice/callTranscript';

const piece = (speaker: Fragment['speaker'], text: string, startMs: number, endMs: number): Fragment => ({
  speaker,
  text,
  startMs,
  endMs,
});

const call: Fragment[] = [
  piece('atlas', 'Hi, ', 0, 400),
  piece('atlas', "I'm Atlas.", 400, 900),
  piece('user', 'Which items ', 2000, 2600),
  piece('user', 'cost  over a million?', 2600, 3500),
  piece('atlas', 'Let me check.', 3700, 4300),
  piece('user', ' And in euros?', 6000, 6900),
];

describe('wordsBetween', () => {
  it("joins the speaker's pieces as sent, between two points on the timeline", () => {
    expect(wordsBetween(call, 'user', 0, 4000)).toBe('Which items cost over a million?');
    expect(wordsBetween(call, 'user', 4000)).toBe('And in euros?');
    expect(wordsBetween(call, 'atlas', 0, 1000)).toBe("Hi, I'm Atlas.");
  });

  it('keeps Arabic as it came', () => {
    const arabic = [piece('user', 'كم قيمة ', 100, 500), piece('user', 'العقد؟', 500, 900)];
    expect(wordsBetween(arabic, 'user', 0)).toBe('كم قيمة العقد؟');
  });
});

describe('latestUtterance', () => {
  it("returns the speaker's words since their last long pause", () => {
    expect(latestUtterance(call, 'user')).toBe('And in euros?');
    expect(latestUtterance(call, 'atlas')).toBe('Let me check.');
    expect(latestUtterance(call.slice(0, 4), 'user')).toBe('Which items cost over a million?');
    expect(latestUtterance([], 'user')).toBe('');
  });
});

describe('startsNewTurn', () => {
  it('tells a new request from a word said over Atlas', () => {
    expect(startsNewTurn(piece('user', 'Okay', 4400, 4600), 4300)).toBe(false);
    expect(startsNewTurn(piece('user', 'And in euros?', 6000, 6900), 4300)).toBe(true);
    expect(startsNewTurn(piece('user', ' ', 9000, 9100), 4300)).toBe(false);
  });
});

describe('joinQuestion', () => {
  it('puts a correction after the request it corrects', () => {
    expect(joinQuestion('Which items cost over a million?', ' Only in euros. ')).toBe('Which items cost over a million? Only in euros.');
    expect(joinQuestion(null, 'What is the fee?')).toBe('What is the fee?');
    expect(joinQuestion(null, '  ')).toBe('');
  });
});
