import { describe, expect, it } from 'vitest';
import { detectLanguage, foldArabic, isArabic } from '../../src/domain/language';

describe('detectLanguage', () => {
  it('is null for text with no letters', () => {
    expect(detectLanguage('')).toBeNull();
    expect(detectLanguage('   \n\t ')).toBeNull();
    expect(detectLanguage('1,250,000.00 - 12 / 34')).toBeNull();
    expect(detectLanguage('١٢٣٤٥')).toBeNull();
  });

  it('reads English text as en', () => {
    expect(detectLanguage('Bill of Quantities - Concrete Works')).toBe('en');
    expect(detectLanguage('SECTION 03 30 00 CAST-IN-PLACE CONCRETE')).toBe('en');
  });

  it('reads Arabic text as ar', () => {
    expect(detectLanguage('جدول الكميات - الأعمال الخرسانية')).toBe('ar');
    expect(detectLanguage('يلتزم المقاول بتسليم المشروع خلال ٢٤ شهراً')).toBe('ar');
  });

  it('keeps a few English terms in an Arabic text as ar', () => {
    expect(detectLanguage('يلتزم المقاول بتقديم جدول زمني محدث للمشروع كل شهر وفق متطلبات العقد BOQ')).toBe('ar');
  });

  it('keeps an Arabic title on an English text as en', () => {
    const text = `مشروع الرياض ${'The contractor shall submit the programme of works for approval. '.repeat(3)}`;
    expect(detectLanguage(text)).toBe('en');
  });

  it('reads a bilingual table as mixed', () => {
    expect(detectLanguage('Excavation حفريات Concrete خرسانة Steel حديد')).toBe('mixed');
  });

  it('ignores digits and punctuation', () => {
    expect(detectLanguage('Total: 1,250,000.00 SAR (2024)')).toBe('en');
    expect(detectLanguage('الإجمالي: ١٬٢٥٠٬٠٠٠ ر.س')).toBe('ar');
  });
});

describe('isArabic', () => {
  it('is true for an Arabic question', () => {
    expect(isArabic('ما هو إجمالي قيمة العقد')).toBe(true);
    expect(isArabic('كم عدد البنود التي تزيد قيمتها عن مليون ريال؟')).toBe(true);
  });

  it('is false for an English question', () => {
    expect(isArabic('What is the total contract value?')).toBe(false);
    expect(isArabic('Which items cost more than SAR 1M?')).toBe(false);
  });

  it('ignores file names and item codes inside an Arabic question', () => {
    expect(isArabic('ما إجمالي المبلغ في Atlas_Sample_BOQ_Revision_B.xlsx')).toBe(true);
    expect(isArabic('ما هو سعر البند C-03.2 في ملف BOQ-Phase1.xlsx')).toBe(true);
  });

  it('treats the Arabic question mark as Arabic', () => {
    expect(isArabic('BOQ Master Schedule Rev B؟')).toBe(true);
  });

  it('keeps an English question that quotes an Arabic term in English', () => {
    expect(isArabic('What is the total for الأعمال الخرسانية in Bill 3?')).toBe(false);
    expect(isArabic('What does مقاول mean?')).toBe(false);
  });

  it('lets the first word decide when the words are close to evenly split', () => {
    expect(isArabic('اشرح Liquidated Damages')).toBe(true);
    expect(isArabic('Explain الأعمال الخرسانية')).toBe(false);
    expect(isArabic('كم عدد البنود في BOQ Master Schedule')).toBe(true);
  });

  it('is false for text with no words', () => {
    expect(isArabic('')).toBe(false);
    expect(isArabic('1,250,000 ?')).toBe(false);
  });
});

describe('foldArabic', () => {
  it('unifies alef forms and drops diacritics and tatweel', () => {
    expect(foldArabic('ألف')).toBe('الف');
    expect(foldArabic('آلاف')).toBe('الاف');
    expect(foldArabic('إجمالي')).toBe('اجمالي');
    expect(foldArabic('ريالاً')).toBe('ريالا');
    expect(foldArabic('ريـــال')).toBe('ريال');
  });

  it('unifies yeh and kaf forms, including Persian ones from PDF text layers', () => {
    expect(foldArabic('سعودى')).toBe('سعودي');
    expect(foldArabic('ریال')).toBe('ريال');
    expect(foldArabic('کمیة')).toBe('كمية');
  });

  it('leaves Latin text and digits alone', () => {
    expect(foldArabic('SAR 1,250,000.00 ١٢٣')).toBe('SAR 1,250,000.00 ١٢٣');
  });
});
