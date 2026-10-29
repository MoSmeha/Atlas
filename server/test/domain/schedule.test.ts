import { describe, expect, it } from 'vitest';
import { clipAround, findScheduleCandidates, findTask, type ScheduleCandidate } from '../../src/domain/schedule';

function candidates(...texts: string[]): ScheduleCandidate[] {
  return findScheduleCandidates(texts.map((text, i) => ({ document: 'Contract.pdf', page: i + 1, text })));
}

function summary(found: ScheduleCandidate[]): [string, string, string | null, string | null][] {
  return found.map((candidate) => [candidate.kind, candidate.match, candidate.isoDate, candidate.hijri]);
}

describe('findScheduleCandidates: English', () => {
  it('gives one candidate per date with its sentence, page and document', () => {
    const found = candidates(
      'Scope of works.',
      'The Contractor shall submit the mock-up no later than 15 March 2026. Completion is on 30 June 2027.',
    );
    expect(found).toEqual([
      {
        id: 'c1',
        kind: 'deadline',
        match: '15 March 2026',
        sentence: 'The Contractor shall submit the mock-up no later than 15 March 2026.',
        document: 'Contract.pdf',
        page: 2,
        isoDate: '2026-03-15',
        hijri: null,
        duration: null,
      },
      {
        id: 'c2',
        kind: 'milestone',
        match: '30 June 2027',
        sentence: 'Completion is on 30 June 2027.',
        document: 'Contract.pdf',
        page: 2,
        isoDate: '2027-06-30',
        hijri: null,
        duration: null,
      },
    ]);
  });

  it('marks deadline phrases: by, before, prior to, deadline', () => {
    const found = candidates(
      'Drawings are due by 1 April 2026. Submit samples before 2026-05-01. The deadline for bids is 10/05/2026. ' +
        'Inspection prior to 1 June 2026 is required.',
    );
    expect(found.map((candidate) => candidate.kind)).toEqual(['deadline', 'deadline', 'deadline', 'deadline']);
  });

  it('does not read "by" as a deadline when it names who acts', () => {
    const [found] = candidates('The report was approved by the Engineer on 3 March 2026.');
    expect(found?.kind).toBe('deliverable');
  });

  it('labels plain dates as dates', () => {
    expect(summary(candidates('This agreement is made on 1 January 2026.'))).toEqual([
      ['date', '1 January 2026', '2026-01-01', null],
    ]);
  });

  it('gives durations their own candidates with the length as written', () => {
    const [found] = candidates('The Engineer shall respond within 28 calendar days of receipt.');
    expect(found).toMatchObject({ kind: 'duration', match: 'within 28 calendar days', duration: '28 calendar days' });
  });

  it('keeps undated deliverables and milestones only when the sentence asks for them', () => {
    const found = candidates(
      'The Contractor shall provide as-built drawings at handover. Refer to drawing A-101 for details. ' +
        'Handover of the works shall follow the Engineer approval. Handover took place.',
    );
    expect(summary(found)).toEqual([
      ['deliverable', 'shall provide', null, null],
      ['milestone', 'Handover', null, null],
    ]);
  });

  it('gives a table cell that holds only a date the row title before it', () => {
    const page =
      'M2  Design Submission 1 (shoring, piling and\nsubstructure)\n\n31 August 2026\n\n' +
      'D6  Design Submission 2 drawings, calculations and\nspecifications\n\n31 August 2026';
    expect(candidates(page).map((candidate) => [candidate.match, candidate.sentence])).toEqual([
      ['31 August 2026', 'M2 Design Submission 1 (shoring, piling and substructure) 31 August 2026'],
      ['31 August 2026', 'D6 Design Submission 2 drawings, calculations and specifications 31 August 2026'],
    ]);
  });

  it('keeps a deliverable due on a day of each month', () => {
    expect(summary(candidates('D4  Monthly Progress Report  by the 7th day of each month'))).toEqual([
      ['deliverable', 'Report', null, null],
    ]);
  });

  it('joins a Hijri date with the Gregorian date that restates it', () => {
    expect(summary(candidates('Site handover on 11 Ramadan 1447 AH (1 March 2026) is required.'))).toEqual([
      ['milestone', '11 Ramadan 1447 AH (1 March 2026)', '2026-03-01', '11 Ramadan 1447 AH'],
    ]);
  });

  it('keeps a repeated page header once, on its first page', () => {
    const header = 'Specification Rev 2 issued March 2026';
    const found = candidates(`${header}\n\nSection 1`, `${header}\n\nSection 2`, `${header}\n\nSection 3`);
    expect(found.map((candidate) => [candidate.page, candidate.match])).toEqual([[1, 'March 2026']]);
  });

  it('numbers candidates across documents and pages', () => {
    const found = findScheduleCandidates([
      { document: 'A.pdf', page: 1, text: 'Start on 1 March 2026.' },
      { document: 'B.pdf', page: 4, text: 'Finish on 1 March 2027.' },
    ]);
    expect(found.map((candidate) => [candidate.id, candidate.document, candidate.page])).toEqual([
      ['c1', 'A.pdf', 1],
      ['c2', 'B.pdf', 4],
    ]);
  });
});

describe('findScheduleCandidates: Arabic', () => {
  it('reads Arabic deadlines, durations and deliverables', () => {
    const found = candidates('يجب على المقاول تقديم النموذج خلال ٢٨ يوماً. آخر موعد للتسليم هو ١٥ مارس ٢٠٢٦م.');
    expect(summary(found)).toEqual([
      ['duration', 'خلال ٢٨ يوماً', null, null],
      ['deadline', '١٥ مارس ٢٠٢٦م', '2026-03-15', null],
    ]);
    expect(found[0]?.duration).toBe('٢٨ يوماً');
    expect(found[1]?.sentence).toBe('آخر موعد للتسليم هو ١٥ مارس ٢٠٢٦م.');
  });

  it('marks "قبل" straight before a date as a deadline', () => {
    expect(summary(candidates('تسليم المخططات قبل تاريخ 1 أبريل 2026.'))).toEqual([
      ['deadline', '1 أبريل 2026', '2026-04-01', null],
    ]);
  });

  it('joins a Hijri date with "الموافق" and its Gregorian date', () => {
    expect(summary(candidates('يتم الاستلام في ١١ رمضان ١٤٤٧هـ الموافق ١ مارس ٢٠٢٦م.'))).toEqual([
      ['milestone', '١١ رمضان ١٤٤٧هـ الموافق ١ مارس ٢٠٢٦م', '2026-03-01', '١١ رمضان ١٤٤٧هـ'],
    ]);
  });

  it('keeps an Arabic Hijri date alone as written', () => {
    expect(summary(candidates('بدء الأعمال في 1447/09/11 هـ.'))).toEqual([['milestone', '1447/09/11 هـ', null, '1447/09/11 هـ']]);
  });

  it('keeps an undated Arabic deliverable when the sentence asks for it', () => {
    expect(summary(candidates('يلتزم المقاول بتسليم التقارير الشهرية.'))).toEqual([['deliverable', 'تسليم', null, null]]);
  });
});

describe('findTask', () => {
  it('prefers a deliverable word to a milestone word', () => {
    expect(findTask('Submit for approval')).toEqual({ kind: 'deliverable', match: 'Submit', index: 0 });
    expect(findTask('Practical completion')).toEqual({ kind: 'milestone', match: 'completion', index: 10 });
    expect(findTask('Concrete grade C40')).toBeNull();
  });
});

describe('clipAround', () => {
  it('keeps short sentences whole', () => {
    expect(clipAround('Submit by 1 March 2026.', 10, 22)).toBe('Submit by 1 March 2026.');
  });

  it('cuts long sentences to about 300 characters around the match, between words', () => {
    const sentence = `${'word '.repeat(100)}due by 1 March 2026 ${'more '.repeat(100)}`.trim();
    const start = sentence.indexOf('1 March 2026');
    const clipped = clipAround(sentence, start, start + 12);
    expect(clipped).toContain('due by 1 March 2026');
    expect(clipped.length).toBeLessThanOrEqual(302);
    expect(clipped.startsWith('…word')).toBe(true);
    expect(clipped.endsWith('more…')).toBe(true);
  });
});
