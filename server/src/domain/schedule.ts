import { arabicPattern, findDateMentions, type DateMention } from './scheduleDates';
import { splitSentences } from './sentences';

export const SCHEDULE_KINDS = ['date', 'deadline', 'duration', 'milestone', 'deliverable'] as const;
export type ScheduleKind = (typeof SCHEDULE_KINDS)[number];

/** Page text to search: one PDF page. */
export interface SchedulePage {
  document: string;
  page: number;
  text: string;
}

/** What a schedule candidate says, wherever it was found. */
export interface ScheduleFields {
  /** A guess from the wording; the confirmation step may change it. */
  kind: ScheduleKind;
  /** The date, duration or task word as written. */
  match: string;
  /** The sentence around the match, cut to about 300 characters. */
  sentence: string;
  document: string;
  /** yyyy-mm-dd, or yyyy-mm for a month and year; null when the match has no Gregorian date. */
  isoDate: string | null;
  /** A Hijri date as written; never converted. */
  hijri: string | null;
  /** For durations, the length as written, such as "28 calendar days". */
  duration: string | null;
}

/** A possible date, deadline, duration, milestone or deliverable on a PDF page. */
export interface ScheduleCandidate extends ScheduleFields {
  id: string;
  page: number;
}

const MAX_SENTENCE = 300;
/** How far back from a date a deadline phrase such as "no later than" may stand. */
const DEADLINE_WINDOW = 80;

const DEADLINE_NEAR = new RegExp(
  [
    '(?:no|not)\\s+later\\s+than', 'on\\s+or\\s+before', 'prior\\s+to', 'deadline', 'at\\s+the\\s+latest', 'latest\\s+by',
    'due\\s+(?:date|on|by)', '(?:is|are)\\s+due',
    ...['الموعد النهائي', 'موعد نهائي', 'آخر موعد', 'أقصاه', 'لا يتجاوز', 'لا يتعدى', 'بحد أقصى'].map(arabicPattern),
  ].join('|'),
  'iu',
);
/** "by", "before" and "until" mark a deadline only straight before the date: "by 1 March", not "by the Engineer on 1 March". */
const DEADLINE_RIGHT_BEFORE = new RegExp(
  `(?:(?<![\\p{L}])(?:by|before|until|till)\\s+(?:the\\s+)?(?:date\\s+of\\s+)?|(?:${['قبل', 'حتى'].map(arabicPattern).join('|')})\\s*(?:${arabicPattern('تاريخ')}\\s*)?)[\\s:,]*$`,
  'iu',
);

const DELIVERABLE = new RegExp(
  [
    '(?<![\\p{L}])(?:submi(?:t|ts|tted|tting|ssions?|ttals?)|deliver(?:s|ed|y|ies|ables?)?|reports?|drawings?',
    '|programmes?|programs?|mock[-\\s]?ups?|shall\\s+(?:provide|furnish))(?![\\p{L}])',
    `|${['تسليم', 'تقديم', 'تقرير', 'تقارير', 'مخطط', 'رسومات', 'برنامج زمني', 'برنامج الزمني', 'نموذج'].map(arabicPattern).join('|')}`,
  ].join(''),
  'iu',
);
const MILESTONE = new RegExp(
  [
    '(?<![\\p{L}])(?:hand(?:ing)?[-\\s]?over|handed\\s+over|taking[-\\s]over|take[-\\s]over|approvals?|approved|completion',
    '|commencement|commence[sd]?|mobili[sz]ation|milestones?|kick[-\\s]?off|start\\s+date)(?![\\p{L}])',
    `|${['استلام', 'اعتماد', 'موافقة', 'إنجاز', 'إتمام', 'اكتمال', 'انتهاء', 'بدء', 'مباشرة'].map(arabicPattern).join('|')}`,
  ].join(''),
  'iu',
);
/** A task word counts without a date only when the sentence asks for it or ties it to an event. */
const OBLIGATION = new RegExp(
  [
    '(?<![\\p{L}])(?:shall|must|(?:is|are)\\s+(?:required|to\\s+be)|required\\s+to|will\\s+be\\s+required|no\\s+later',
    '|not\\s+later|prior\\s+to|upon|within|after|before|following)(?![\\p{L}])',
    `|${['يجب', 'يلتزم', 'يتعين', 'على المقاول', 'على الاستشاري', 'يتم', 'سيتم', 'عند', 'بعد', 'قبل', 'خلال'].map(arabicPattern).join('|')}`,
  ].join(''),
  'iu',
);
/** Text allowed between a Hijri date and the Gregorian date that restates it: "(", "corresponding to", "الموافق". */
const DATE_PAIR_GAP = new RegExp(
  `^[\\s(),\\-\\u2013\\u2014/|:]*(?:(?:corresponding\\s+to|equivalent\\s+to|i\\.e\\.?|(?:${arabicPattern('و')})?${arabicPattern('الموافق')}(?:\\s*${arabicPattern('ل')})?|${arabicPattern('يوافق')})[\\s(),\\-\\u2013\\u2014:]*)?$`,
  'iu',
);

/**
 * Every possible date, deadline, duration, milestone or deliverable in the pages, one candidate per date or
 * duration with its sentence. A sentence with no date becomes a milestone or deliverable candidate when it names a
 * task ("submit", "handover", "تسليم") and asks for it. A Hijri date next to the Gregorian date it restates is one
 * candidate with both. The same match in the same sentence (a page header, say) is kept once, on its first page.
 */
export function findScheduleCandidates(pages: readonly SchedulePage[]): ScheduleCandidate[] {
  const seen = new Set<string>();
  const candidates: ScheduleCandidate[] = [];
  for (const page of pages) {
    for (const sentence of splitSentences(page.text)) {
      for (const fields of sentenceCandidates(sentence, page.document)) {
        const key = `${fields.document}\n${fields.match}\n${fields.sentence}`;
        if (seen.has(key)) continue;
        seen.add(key);
        candidates.push({ id: `c${candidates.length + 1}`, ...fields, page: page.page });
      }
    }
  }
  return candidates;
}

function sentenceCandidates(sentence: string, document: string): ScheduleFields[] {
  const mentions = pairHijriDates(sentence, findDateMentions(sentence));
  if (mentions.length === 0) {
    const task = findTask(sentence);
    if (task === null || !OBLIGATION.test(sentence)) return [];
    const sentenceAround = clipAround(sentence, task.index, task.index + task.match.length);
    return [{ kind: task.kind, match: task.match, sentence: sentenceAround, document, isoDate: null, hijri: null, duration: null }];
  }
  return mentions.map((mention) => ({
    kind: mentionKind(sentence, mention),
    match: mention.text,
    sentence: clipAround(sentence, mention.start, mention.end),
    document,
    isoDate: mention.isoDate,
    hijri: mention.hijri,
    duration: mention.duration,
  }));
}

/** The first task word in a text: a deliverable ("submit", "report", "تقديم") before a milestone ("handover", "اعتماد"). */
export function findTask(text: string): { kind: 'milestone' | 'deliverable'; match: string; index: number } | null {
  for (const [kind, regex] of [['deliverable', DELIVERABLE], ['milestone', MILESTONE]] as const) {
    const found = regex.exec(text);
    if (found) return { kind, match: found[0], index: found.index };
  }
  return null;
}

function mentionKind(sentence: string, mention: DateMention): ScheduleKind {
  if (mention.kind === 'duration') return 'duration';
  const before = sentence.slice(Math.max(0, mention.start - DEADLINE_WINDOW), mention.start);
  if (DEADLINE_RIGHT_BEFORE.test(before) || DEADLINE_NEAR.test(before)) return 'deadline';
  return findTask(sentence)?.kind ?? 'date';
}

/** Joins "11 Ramadan 1447 AH (1 March 2026)" into one date with both calendars. */
function pairHijriDates(sentence: string, mentions: DateMention[]): DateMention[] {
  const paired: DateMention[] = [];
  for (const mention of mentions) {
    const last = paired.at(-1);
    if (last && isDatePair(sentence, last, mention)) paired[paired.length - 1] = joinPair(sentence, last, mention);
    else paired.push(mention);
  }
  return paired;
}

function isDatePair(sentence: string, first: DateMention, second: DateMention): boolean {
  if (first.kind !== 'date' || second.kind !== 'date') return false;
  const oneOfEach = (first.hijri === null) !== (second.hijri === null) && (first.isoDate === null) !== (second.isoDate === null);
  return oneOfEach && DATE_PAIR_GAP.test(sentence.slice(first.end, second.start));
}

function joinPair(sentence: string, first: DateMention, second: DateMention): DateMention {
  const opened = sentence.slice(first.end, second.start).includes('(');
  const close = /^\s*\)/.exec(sentence.slice(second.end));
  const end = opened && close ? second.end + close[0].length : second.end;
  return {
    kind: 'date',
    start: first.start,
    end,
    text: sentence.slice(first.start, end),
    isoDate: first.isoDate ?? second.isoDate,
    hijri: first.hijri ?? second.hijri,
    duration: null,
  };
}

/** The whole sentence when short, otherwise about 300 characters around the match, cut between words. */
export function clipAround(sentence: string, start: number, end: number): string {
  if (sentence.length <= MAX_SENTENCE) return sentence;
  const from = Math.min(Math.max(0, Math.round((start + end - MAX_SENTENCE) / 2)), sentence.length - MAX_SENTENCE);
  const to = from + MAX_SENTENCE;
  const space = sentence.indexOf(' ', from);
  const head = from > 0 && space !== -1 && space < start ? space + 1 : from;
  const lastSpace = sentence.lastIndexOf(' ', to);
  const tail = to < sentence.length && lastSpace >= end ? lastSpace : to;
  return `${head > 0 ? '…' : ''}${sentence.slice(head, tail).trim()}${tail < sentence.length ? '…' : ''}`;
}
