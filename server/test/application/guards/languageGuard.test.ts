import { describe, expect, it } from 'vitest';
import { checkLanguage } from '../../../src/application/guards/languageGuard';

function inner() {
  const seen: unknown[] = [];
  const next = async (args: unknown) => {
    seen.push(args);
    return { accepted: true as const, value: 'ok' };
  };
  return { seen, next };
}

describe('checkLanguage', () => {
  it('passes an answer in the question language on', async () => {
    const { seen, next } = inner();
    const verdict = await checkLanguage('ar', next)({ language: 'ar', markdown: 'x' });
    expect(verdict).toEqual({ accepted: true, value: 'ok' });
    expect(seen).toHaveLength(1);
  });

  it('sends the first answer in the other language back, then passes the next one on', async () => {
    const { seen, next } = inner();
    const check = checkLanguage('ar', next);

    const first = await check({ language: 'en', markdown: 'The total is SAR 10.' });
    expect(first.accepted).toBe(false);
    const feedback = JSON.parse(first.accepted ? '' : first.feedback) as { problems: string[] };
    expect(feedback.problems[0]).toContain('written in Arabic');
    expect(feedback.problems[0]).toContain('"ar"');
    expect(seen).toHaveLength(0);

    expect(await check({ language: 'en', markdown: 'Still English.' })).toEqual({ accepted: true, value: 'ok' });
  });

  it('leaves arguments without a language to the inner check', async () => {
    const { seen, next } = inner();
    await checkLanguage('en', next)({ markdown: 'x' });
    expect(seen).toEqual([{ markdown: 'x' }]);
  });
});
