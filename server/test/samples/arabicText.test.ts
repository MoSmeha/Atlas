import { describe, expect, it } from 'vitest';
import { arabicAmount, arabicDate, arabicDigits, arabicHijriDate, arabicWeekday } from '../../scripts/samples/lib/arabicText';

describe('Arabic text helpers', () => {
  it('writes digits and separators the Arabic way', () => {
    expect(arabicDigits('24.6')).toBe('٢٤٫٦');
    expect(arabicDigits('10:00')).toBe('١٠:٠٠');
    expect(arabicAmount(2_350_000)).toBe('٢٬٣٥٠٬٠٠٠');
    expect(arabicAmount(320_000)).toBe('٣٢٠٬٠٠٠');
  });

  it('writes Gregorian and Umm al-Qura dates with Arabic month names', () => {
    expect(arabicDate('2026-10-12')).toBe('١٢ أكتوبر ٢٠٢٦م');
    expect(arabicDate('2026-11-15')).toBe('١٥ نوفمبر ٢٠٢٦م');
    expect(arabicHijriDate('2026-10-12')).toBe('١ جمادى الأولى ١٤٤٨هـ');
    expect(arabicHijriDate('2026-02-01')).toBe('١٣ شعبان ١٤٤٧هـ');
    expect(arabicWeekday('2026-10-12')).toBe('الاثنين');
    expect(arabicWeekday('2026-11-15')).toBe('الأحد');
  });
});
