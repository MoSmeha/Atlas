import { describe, expect, it } from 'vitest';
import { cleanSentence, splitSentences } from '../../src/domain/sentences';

describe('splitSentences', () => {
  it('ends sentences at full stops and joins wrapped lines', () => {
    const text = 'The Contractor shall submit the programme to the Engineer for\nreview by 1 March 2026. Approval follows.';
    expect(splitSentences(text)).toEqual([
      'The Contractor shall submit the programme to the Engineer for review by 1 March 2026.',
      'Approval follows.',
    ]);
  });

  it('keeps abbreviations, decimals and dotted dates inside a sentence', () => {
    expect(splitSentences('See Cl. 8.1 and No. 5, e.g. drawings dated 01.03.2026. Done.')).toEqual([
      'See Cl. 8.1 and No. 5, e.g. drawings dated 01.03.2026.',
      'Done.',
    ]);
  });

  it('does not end a sentence before a lower-case word', () => {
    expect(splitSentences('Allow approx. five days. Then submit.')).toEqual(['Allow approx. five days.', 'Then submit.']);
  });

  it('starts a new sentence at blank lines, list items and short headings', () => {
    const text = '1. Programme\nThe programme is due in March 2026\n- within 28 days\n- 6 weeks\n\nPayment terms';
    expect(splitSentences(text)).toEqual([
      '1. Programme',
      'The programme is due in March 2026',
      '- within 28 days',
      '- 6 weeks',
      'Payment terms',
    ]);
  });

  it('splits Arabic text at full stops and Arabic question marks', () => {
    expect(splitSentences('يجب تقديم البرنامج الزمني خلال ٢٨ يوماً. هل تمت الموافقة؟ نعم')).toEqual([
      'يجب تقديم البرنامج الزمني خلال ٢٨ يوماً.',
      'هل تمت الموافقة؟',
      'نعم',
    ]);
  });
});

describe('cleanSentence', () => {
  it('drops direction marks and collapses whitespace', () => {
    expect(cleanSentence('  ‏١٥‏  مارس\n٢٠٢٦ ')).toBe('١٥ مارس ٢٠٢٦');
  });
});
