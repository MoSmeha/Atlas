import type { ToolStep } from '@atlas/shared';
import { describe, expect, it } from 'vitest';
import { askReadiness } from '../../src/features/chat/askReadiness';
import { chatCopy } from '../../src/features/chat/chatCopy';
import { describeStepInput } from '../../src/features/chat/stepInput';
import { traceSummary } from '../../src/features/chat/traceSummary';
import { isolate } from '../../src/i18n/bidi';

const step: ToolStep = {
  id: 'q:1',
  name: 'search_documents',
  inputSummary: '',
  status: 'ok',
  durationMs: 10,
  resultSummary: null,
  error: null,
};
const search = '{"query":"retention","document":"Contract.pdf"}';

describe('step input', () => {
  it('says a search in English, with the query and file name isolated', () => {
    expect(describeStepInput('search_documents', search)).toEqual({
      text: `"${isolate('retention')}" in ${isolate('Contract.pdf')}`,
      kind: 'words',
    });
  });

  it('says the same search in Arabic', () => {
    expect(describeStepInput('search_documents', search, 'ar')).toEqual({
      text: `«${isolate('retention')}» في ${isolate('Contract.pdf')}`,
      kind: 'words',
    });
  });

  it('keeps SQL as written in either language', () => {
    const sql = '{"sql":"SELECT SUM(amount) FROM boq"}';
    expect(describeStepInput('query_tables', sql, 'ar')).toEqual({ text: 'SELECT SUM(amount) FROM boq', kind: 'code' });
  });
});

describe('trace summary', () => {
  const steps = [step, step, step];

  it('counts the steps and the time in English', () => {
    expect(traceSummary(steps, false, 8400)).toBe('3 steps, 8.4 s');
    expect(traceSummary([step], true, null)).toBe('1 step so far');
  });

  it('counts them in Arabic with Western digits', () => {
    expect(traceSummary(steps, false, 8400, 'ar')).toBe('3 خطوات، 8.4 ث');
    expect(traceSummary([step], true, null, 'ar')).toBe('خطوة واحدة حتى الآن');
  });
});

describe('result table rows', () => {
  it('counts rows in both languages', () => {
    expect(chatCopy.en.table.rowCount(50, 214)).toBe('Showing 50 of 214 rows');
    expect(chatCopy.en.table.rowCount(1, 1)).toBe('1 row');
    expect(chatCopy.ar.table.rowCount(50, 214)).toBe('يُعرض 50 صفًا من أصل 214');
  });
});

describe('ask readiness', () => {
  it('gives a reason the composer words, not English text', () => {
    expect(askReadiness({ status: undefined, statusError: null, apiKeyPresent: true }).hint).toBe('checking');
  });
});
