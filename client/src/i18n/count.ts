/**
 * A figure the way Atlas writes numbers in both languages: Western digits with thousands separators,
 * the same as the documents and answers, so a count in the interface matches the number in a file.
 */
export function figure(n: number): string {
  return n.toLocaleString('en-US');
}

/** "1 file", "12 files". */
export function countEn(n: number, one: string, many: string): string {
  return `${figure(n)} ${n === 1 ? one : many}`;
}

/**
 * An Arabic noun in each of its count forms. `one` and `two` are whole phrases ("ملف واحد", "ملفان");
 * the others follow the figure: `few` for 3 to 10 ("ملفات"), `many` for 11 to 99 ("ملفًا"), `other`
 * for 0 and hundreds ("ملف").
 */
export interface ArabicNoun {
  one: string;
  two: string;
  few: string;
  many: string;
  other: string;
}

const arabicRules = new Intl.PluralRules('ar');

/** "ملف واحد", "ملفان", "3 ملفات", "11 ملفًا", "100 ملف". */
export function countAr(n: number, noun: ArabicNoun): string {
  switch (arabicRules.select(n)) {
    case 'one':
      return noun.one;
    case 'two':
      return noun.two;
    case 'few':
      return `${figure(n)} ${noun.few}`;
    case 'many':
      return `${figure(n)} ${noun.many}`;
    default:
      return `${figure(n)} ${noun.other}`;
  }
}
