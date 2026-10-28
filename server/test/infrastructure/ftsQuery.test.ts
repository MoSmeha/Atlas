import { describe, expect, it } from 'vitest';
import { foldText } from '../../src/infrastructure/index/foldText';
import { ftsQuery } from '../../src/infrastructure/index/ftsQuery';
import { bufferToVector, cosine, vectorToBuffer } from '../../src/infrastructure/index/vectors';

describe('foldText', () => {
  it('drops Arabic vowels, hamza forms, ta marbuta and the article', () => {
    expect(foldText('المُقَاوِل')).toBe('مقاول');
    expect(foldText('الإجمالية')).toBe(foldText('الاجمالية'));
    expect(foldText('أعمال الخرسانة')).toBe('اعمال خرسانه');
    expect(foldText('للمقاول وبالعقد')).toBe('مقاول عقد');
  });

  it('turns Arabic-Indic digits into Western digits and leaves Latin text alone', () => {
    expect(foldText('عام ٢٠٢٤ و۱۴۴۵')).toBe('عام 2024 و1445');
    expect(foldText('Café C-101')).toBe('Café C-101');
  });
});

describe('ftsQuery', () => {
  it('quotes each word and ORs them, dropping stop words', () => {
    expect(ftsQuery('What is the total contract value?')).toBe('"total" OR "contract" OR "value"');
  });

  it('keeps FTS5 syntax as plain words', () => {
    expect(ftsQuery('concrete NOT steel* NEAR(x) "quoted" ^col:')).toBe(
      '"concrete" OR "not" OR "steel" OR "near x" OR "quoted" OR "col"',
    );
  });

  it('turns codes and numbers with punctuation into phrases', () => {
    expect(ftsQuery('item C-101 costs 1,250,000')).toBe('"item" OR "c 101" OR "costs" OR "1 250 000"');
  });

  it('folds Arabic the same way as indexed text', () => {
    expect(ftsQuery('ما هي قيمة العقد؟')).toBe('"قيمه" OR "عقد"');
  });

  it('returns null when nothing searchable is left, but keeps stop words when they are all there is', () => {
    expect(ftsQuery(' ?! - ')).toBeNull();
    expect(ftsQuery('a b c')).toBeNull();
    expect(ftsQuery('what is this')).toBe('"what" OR "is" OR "this"');
  });
});

describe('vectors', () => {
  it('computes cosine similarity', () => {
    const a = new Float32Array([1, 0, 0]);
    expect(cosine(a, new Float32Array([2, 0, 0]))).toBeCloseTo(1);
    expect(cosine(a, new Float32Array([0, 3, 0]))).toBeCloseTo(0);
    expect(cosine(a, new Float32Array([0, 0, 0]))).toBe(0);
    expect(cosine(a, new Float32Array([1, 0]))).toBe(0);
  });

  it('round-trips through a buffer, even an unaligned one', () => {
    const vector = new Float32Array([0.25, -1.5, 3]);
    const unaligned = Buffer.concat([Buffer.from([7]), vectorToBuffer(vector)]).subarray(1);
    expect([...bufferToVector(unaligned)]).toEqual([0.25, -1.5, 3]);
  });
});
