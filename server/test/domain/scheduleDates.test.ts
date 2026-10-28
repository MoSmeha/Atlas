import { describe, expect, it } from 'vitest';
import { excelSerialToIso, findDateMentions, readDateText } from '../../src/domain/scheduleDates';

/** [text as written, isoDate, hijri] for every date in a sentence. */
function dates(sentence: string): [string, string | null, string | null][] {
  return findDateMentions(sentence)
    .filter((mention) => mention.kind === 'date')
    .map((mention) => [mention.text, mention.isoDate, mention.hijri]);
}

function durations(sentence: string): [string, string | null][] {
  return findDateMentions(sentence)
    .filter((mention) => mention.kind === 'duration')
    .map((mention) => [mention.text, mention.duration]);
}

describe('findDateMentions: Gregorian dates', () => {
  it('reads ISO and day-first numeric dates', () => {
    expect(dates('Issued 2026-03-01, revised 15/03/2026, 1-4-2026 and 01.05.2026.')).toEqual([
      ['2026-03-01', '2026-03-01', null],
      ['15/03/2026', '2026-03-15', null],
      ['1-4-2026', '2026-04-01', null],
      ['01.05.2026', '2026-05-01', null],
    ]);
  });

  it('reads month/day only when the day cannot be a month', () => {
    expect(dates('Signed 03/15/2026.')).toEqual([['03/15/2026', '2026-03-15', null]]);
  });

  it('rejects impossible dates', () => {
    expect(dates('Dated 31/02/2026 and 2026-13-01.')).toEqual([]);
  });

  it('reads dates with month names, with or without ordinals and commas', () => {
    expect(dates('On 1 March 2026, March 1, 2026, the 1st of March 2026 and 15 Sept. 2026.')).toEqual([
      ['1 March 2026', '2026-03-01', null],
      ['March 1, 2026', '2026-03-01', null],
      ['1st of March 2026', '2026-03-01', null],
      ['15 Sept. 2026', '2026-09-15', null],
    ]);
  });

  it('reads a month and year as yyyy-mm without also reading part of a full date', () => {
    expect(dates('Works start in March 2026 and end on 30 June 2027.')).toEqual([
      ['March 2026', '2026-03', null],
      ['30 June 2027', '2027-06-30', null],
    ]);
  });

  it('ignores standard references, clause numbers and phone numbers', () => {
    expect(findDateMentions('Comply with BS EN 206:2013, ISO 9001:2015 and Clause 14.3; call +966 11 234 5678.')).toEqual([]);
  });

  it('reads Arabic month names with Arabic-Indic digits and the Gregorian mark', () => {
    expect(dates('يتم التسليم في ١٥ مارس ٢٠٢٦م وفي أبريل 2026')).toEqual([
      ['١٥ مارس ٢٠٢٦م', '2026-03-15', null],
      ['أبريل 2026', '2026-04', null],
    ]);
  });

  it('reads Levantine month names and hamza variants', () => {
    expect(dates('من 1 كانون الثاني 2026 إلى 30 ابريل 2026 ثم إبريل 2027 و 1 آذار 2027')).toEqual([
      ['1 كانون الثاني 2026', '2026-01-01', null],
      ['30 ابريل 2026', '2026-04-30', null],
      ['إبريل 2027', '2027-04', null],
      ['1 آذار 2027', '2027-03-01', null],
    ]);
  });
});

describe('findDateMentions: Hijri dates', () => {
  it('keeps English Hijri dates as written, without a Gregorian date', () => {
    expect(dates('Approval on 11 Ramadan 1447 AH, Rabi al-Awwal 1447 and Dhu al-Hijjah 10, 1446 A.H.')).toEqual([
      ['11 Ramadan 1447 AH', null, '11 Ramadan 1447 AH'],
      ['Rabi al-Awwal 1447', null, 'Rabi al-Awwal 1447'],
      ['Dhu al-Hijjah 10, 1446 A.H.', null, 'Dhu al-Hijjah 10, 1446 A.H.'],
    ]);
  });

  it('reads Arabic Hijri month names with the هـ mark', () => {
    expect(dates('الموعد ١١ رمضان ١٤٤٧هـ ثم ذو القعدة 1447 هـ و 5 جمادى الأولى 1448')).toEqual([
      ['١١ رمضان ١٤٤٧هـ', null, '١١ رمضان ١٤٤٧هـ'],
      ['ذو القعدة 1447 هـ', null, 'ذو القعدة 1447 هـ'],
      ['5 جمادى الأولى 1448', null, '5 جمادى الأولى 1448'],
    ]);
  });

  it('treats numeric dates with a Hijri year as Hijri', () => {
    expect(dates('Dated 1447/09/11 هـ and 11/09/1447.')).toEqual([
      ['1447/09/11 هـ', null, '1447/09/11 هـ'],
      ['11/09/1447', null, '11/09/1447'],
    ]);
  });

  it('does not read a Gregorian year with a Hijri mark as a date', () => {
    expect(dates('Dated 2026/03/01 AH.')).toEqual([]);
  });
});

describe('findDateMentions: durations', () => {
  it('reads English durations with their lead word and the length as written', () => {
    expect(
      durations('Submit within 28 days, allow 28 calendar days, 6 weeks, 30 months, a 14-day period and two (2) years.'),
    ).toEqual([
      ['within 28 days', '28 days'],
      ['28 calendar days', '28 calendar days'],
      ['6 weeks', '6 weeks'],
      ['30 months', '30 months'],
      ['14-day', '14-day'],
      ['two (2) years', 'two (2) years'],
    ]);
  });

  it('reads number words before a numeral in brackets', () => {
    expect(durations('Within twenty-eight (28) days after the Commencement Date.')).toEqual([
      ['Within twenty-eight (28) days', 'twenty-eight (28) days'],
    ]);
  });

  it('reads Arabic durations with Arabic-Indic digits', () => {
    expect(durations('يجب التسليم خلال ٢٨ يوماً ومدة التنفيذ 18 شهراً و 3 أسابيع')).toEqual([
      ['خلال ٢٨ يوماً', '٢٨ يوماً'],
      ['18 شهراً', '18 شهراً'],
      ['3 أسابيع', '3 أسابيع'],
    ]);
  });

  it('returns dates and durations in reading order', () => {
    const mentions = findDateMentions('Within 14 days of 1 March 2026 submit the report.');
    expect(mentions.map((mention) => [mention.kind, mention.text])).toEqual([
      ['duration', 'Within 14 days'],
      ['date', '1 March 2026'],
    ]);
  });
});

describe('readDateText', () => {
  it('reads a cell that holds only a date', () => {
    expect(readDateText('2026-03-01T00:00:00.000Z')?.isoDate).toBe('2026-03-01');
    expect(readDateText(' 15/03/2026 ')?.isoDate).toBe('2026-03-15');
    expect(readDateText('1 March 2026')?.isoDate).toBe('2026-03-01');
    expect(readDateText('11 Ramadan 1447 AH')?.hijri).toBe('11 Ramadan 1447 AH');
  });

  it('returns null for text around a date, durations and plain words', () => {
    expect(readDateText('Start 2026-03-01')).toBeNull();
    expect(readDateText('28 days')).toBeNull();
    expect(readDateText('Excavation')).toBeNull();
  });
});

describe('excelSerialToIso', () => {
  it('turns Excel serial dates between 2000 and 2099 into yyyy-mm-dd', () => {
    expect(excelSerialToIso(46082)).toBe('2026-03-01');
    expect(excelSerialToIso(46082.75)).toBe('2026-03-01');
    expect(excelSerialToIso(36526)).toBe('2000-01-01');
  });

  it('returns null for numbers outside that range', () => {
    expect(excelSerialToIso(25000)).toBeNull();
    expect(excelSerialToIso(1_250_000)).toBeNull();
    expect(excelSerialToIso(Number.NaN)).toBeNull();
  });
});
