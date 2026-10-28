import { describe, expect, it } from 'vitest';
import { orderRightToLeft, type PlacedChar } from '../../src/domain/bidi';

/** Characters 5 pt wide. */
const WIDTH = 5;

/** Arabic text in reading order, placed from `right` towards the left, as a PDF reader lists it. */
function arabic(text: string, right: number): PlacedChar[] {
  return [...text].map((c, i) => ({ c, x0: right - (i + 1) * WIDTH, x1: right - i * WIDTH, rtl: true }));
}

/** A number in Arabic-Indic digits, already reading left to right, placed from `left`. */
function number(text: string, left: number): PlacedChar[] {
  return [...text].map((c, i) => ({ c, x0: left + i * WIDTH, x1: left + (i + 1) * WIDTH, rtl: true }));
}

/** Latin text, Western digits or punctuation, which PDF readers give a left-to-right level, placed from `left`. */
function latin(text: string, left: number): PlacedChar[] {
  return [...text].map((c, i) => ({ c, x0: left + i * WIDTH, x1: left + (i + 1) * WIDTH, rtl: false }));
}

function read(chars: PlacedChar[]): string {
  return orderRightToLeft(chars)
    .map((char) => char.c)
    .join('');
}

describe('orderRightToLeft', () => {
  it('reads runs listed from left to right from right to left, a word gap becoming one space', () => {
    // ريال at 30-50, 500 at 53-68, المبلغ at 71-101.
    expect(read([...arabic('ريال', 50), ...latin('500', 53), ...arabic('المبلغ', 101)])).toBe('المبلغ 500 ريال');
  });

  it('keeps runs that are already listed from right to left', () => {
    expect(read([...arabic('ال', 44), ...latin('12', 20)])).toBe('ال 12');
  });

  it('joins a number and its percent sign without a space', () => {
    // مقابل at 5-30, ٪ at 33-38, ٢٤٫٦ at 38-58, a left-to-right space as mupdf gives it, بلغت at 63-83.
    const line = [...arabic('مقابل', 30), ...latin('٪', 33), ...number('٢٤٫٦', 38), ...latin(' ', 58), ...arabic('بلغت', 83)];
    expect(read(line)).toBe('بلغت ٢٤٫٦٪ مقابل');
  });

  it('reads a run of punctuation alone from right to left', () => {
    // The full stop at 10-15 ends the sentence; the percent sign at 15-20 follows ٧٠ at 20-30.
    const line = [...latin('.٪', 10), ...number('٧٠', 20), ...latin(' ', 30), ...arabic('التأسيس', 70)];
    expect(read(line)).toBe('التأسيس ٧٠٪.');
  });

  it('keeps a Latin run in order and the Arabic comma that touches it', () => {
    // "، العقد" at 15-50, "Najd Tower" at 50-100, مشروع at 103-128.
    const line = [...arabic('، العقد', 50), ...latin('Najd Tower', 50), ...arabic('مشروع', 128)];
    expect(read(line)).toBe('مشروع Najd Tower، العقد');
  });

  it('keeps a numbered heading and its hyphen together', () => {
    // "١ حجر" at 0-25, the hyphen at 25-30, ٣ at 30-35.
    expect(read([...arabic('١ حجر', 25), ...latin('-', 25), ...number('٣', 30)])).toBe('٣-١ حجر');
  });

  it('separates table cells by two spaces and puts a closing bracket listed first at the end', () => {
    // The name cell at 230-300, the organisation cell at 140-200 and its closing bracket at 135-140.
    const line = [...arabic('م. فيصل الحربي', 300), ...latin(')', 135), ...arabic('سراب (المالك', 200)];
    expect(read(line)).toBe('م. فيصل الحربي  سراب (المالك)');
  });

  it('leaves a line of one run as it is', () => {
    const line = arabic('حجر الرياض الجيري', 100);
    expect(orderRightToLeft(line)).toEqual(line);
  });
});
