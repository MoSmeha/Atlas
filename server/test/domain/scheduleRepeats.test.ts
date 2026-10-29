import { describe, expect, it } from 'vitest';
import { findScheduleCandidates } from '../../src/domain/schedule';
import { mergeRepeats } from '../../src/domain/scheduleRepeats';

function merged(document: string, ...pages: string[]): [string, number][] {
  const found = findScheduleCandidates(pages.map((text, i) => ({ document, page: i + 1, text })));
  return mergeRepeats(found).map(({ candidate, repeats }) => [candidate.sentence, repeats]);
}

describe('mergeRepeats', () => {
  it('keeps the first of the sentences that repeat one wording, clause numbers and names aside, and counts the rest', () => {
    expect(
      merged(
        'Spec.pdf',
        'A1.1.2 Report any defect found in blockwork to the Engineer within two working days.',
        'B2.3.1 Report any defect found in joinery items to the Engineer within two working days.',
        'C4.5.6 Report any defect found in suspended ceilings to the Engineer within two working days.',
      ),
    ).toEqual([['A1.1.2 Report any defect found in blockwork to the Engineer within two working days.', 2]]);
  });

  it('keeps sentences apart when their date or duration differs, or when they are worded differently', () => {
    expect(
      merged(
        'Contract.pdf',
        'M1 Baseline Programme accepted by the Engineer within 28 days of the Commencement Date',
        'D1 Baseline Programme in Primavera P6 format within 28 days of the Commencement Date',
        'D2 Health, Safety and Environment Plan within 14 days of the Commencement Date',
        'D3 Quality Management Plan within 28 days of the Commencement Date',
        'D9 As-built Drawings 31 July 2028',
        'D10 Operation and Maintenance Manuals 31 July 2028',
        'M7 MEP testing and commissioning started 1 March 2028',
        'M8 MEP testing and commissioning completed 31 May 2028',
      ).map(([sentence, repeats]) => [sentence.slice(0, 3).trim(), repeats]),
    ).toEqual([
      ['M1', 0],
      ['D1', 0],
      ['D2', 0],
      ['D3', 0],
      ['D9', 0],
      ['D10', 0],
      ['M7', 0],
      ['M8', 0],
    ]);
  });

  it('never merges sentences from different documents', () => {
    const pages = ['The Contractor shall submit the mock-up no later than 15 March 2026.'];
    const found = [
      ...findScheduleCandidates(pages.map((text) => ({ document: 'Contract.pdf', page: 1, text }))),
      ...findScheduleCandidates(pages.map((text) => ({ document: 'Addendum.pdf', page: 1, text }))),
    ];
    expect(mergeRepeats(found).map(({ candidate }) => candidate.document)).toEqual(['Contract.pdf', 'Addendum.pdf']);
  });
});
