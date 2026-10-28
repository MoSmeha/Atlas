import { describe, expect, it } from 'vitest';
import { addDays, addMonths, checkHijri, day, hijriDate, isoDate, longDate, ordinal } from '../../scripts/samples/lib/dates';
import { contract } from '../../scripts/samples/project';

describe('sample dates', () => {
  it('converts Gregorian dates to Umm al-Qura Hijri dates', () => {
    expect(hijriDate(day('2026-02-01'))).toBe("13 Sha'ban 1447 AH");
    expect(hijriDate(day('2026-02-18'))).toBe('1 Ramadan 1447 AH');
  });

  it('accepts the Hijri dates written into the contract and rejects a wrong one', () => {
    expect(checkHijri(contract.commencement.date, contract.commencement.hijri)).toBe(contract.commencement.hijri);
    expect(checkHijri(contract.contractDate.date, contract.contractDate.hijri)).toBe(contract.contractDate.hijri);
    expect(() => checkHijri('2026-02-01', "14 Sha'ban 1447 AH")).toThrow(/13 Sha'ban 1447 AH/);
  });

  it('counts days and months from the Commencement Date', () => {
    expect(isoDate(addDays(day('2026-02-01'), 28))).toBe('2026-03-01');
    expect(isoDate(addDays(addMonths(day('2026-02-01'), 30), -1))).toBe('2028-07-31');
  });

  it('writes dates and ordinals the way the contract does', () => {
    expect(longDate(day('2026-02-01'))).toBe('1 February 2026');
    expect([1, 2, 3, 7, 11, 12, 13, 21, 25].map(ordinal)).toEqual(['1st', '2nd', '3rd', '7th', '11th', '12th', '13th', '21st', '25th']);
  });
});
