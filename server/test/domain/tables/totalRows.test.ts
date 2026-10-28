import { describe, expect, it } from 'vitest';
import { headingText, isSectionHeading, isTotalLabel, isTotalRow } from '../../../src/domain/tables/totalRows';

describe('isTotalLabel', () => {
  it.each([
    'Total',
    'TOTAL',
    'Total:',
    'Sub-total 1.1 Site Preparation and Earthworks',
    'Subtotal',
    'Sub total',
    'Grand Total',
    'Page total',
    'Carried forward',
    'Carried to Summary',
    'Total Bill 1 - Substructure (carried to Summary)',
    'Amount carried forward',
    'Brought forward',
    'B/F',
    'Bill 2 Total',
    'المجموع',
    'المجموع الكلي',
    'الإجمالي',
    'إجمالي أعمال الحفر',
    'المبلغ المرحل',
  ])('recognises "%s"', (text) => {
    expect(isTotalLabel(text)).toBe(true);
  });

  it.each([
    'Totally enclosed fan units',
    'Excavation for pile caps',
    'مجموعة مضخات المياه',
    'المرحلة الأولى',
    '1.1.01',
  ])('leaves "%s" alone', (text) => {
    expect(isTotalLabel(text)).toBe(false);
  });
});

describe('isTotalRow', () => {
  const detail = new Set([2, 4]);

  it('marks a row whose label names a total', () => {
    expect(isTotalRow([null, 'Sub-total 1.1', null, null, null, 4_989_525], detail)).toBe(true);
    expect(isTotalRow([null, null, null, null, 'Total', 4_989_525], detail)).toBe(true);
  });

  it('keeps an item whose description starts with "Total" when it has a unit or rate', () => {
    expect(isTotalRow(['4.1.02', 'Total station, robotic', 'nr', 2, 85_000, 170_000], detail)).toBe(false);
  });

  it('is false without a total label', () => {
    expect(isTotalRow(['1.1.01', 'Site clearance', 'm2', 8400, 6.5, 54_600], detail)).toBe(false);
  });
});

describe('isSectionHeading', () => {
  const heading = new Set([0, 1]);

  it('is a row with text only in the leading text columns', () => {
    expect(isSectionHeading([null, '1.2 Shoring and Piling', null, null, null, null], heading)).toBe(true);
    expect(isSectionHeading(['A', 'EARTHWORKS', null, null, null, null], heading)).toBe(true);
  });

  it('is not a row with numbers or text in other columns', () => {
    expect(isSectionHeading(['1.1.01', 'Site clearance', 'm2', 8400, 6.5, 54_600], heading)).toBe(false);
    expect(isSectionHeading([null, 'Provisional sum', null, null, null, 'Included'], heading)).toBe(false);
    expect(isSectionHeading([1.2, null, null, null, null, null], heading)).toBe(false);
  });

  it('never applies when every column is a heading column', () => {
    expect(isSectionHeading(['A', 'Text'], new Set([0, 1]))).toBe(false);
    expect(isSectionHeading(['A', null, null], new Set())).toBe(false);
  });

  it('names the section with the row text', () => {
    expect(headingText(['1.2', 'Shoring and Piling', null])).toBe('1.2 Shoring and Piling');
  });
});
