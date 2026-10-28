import { describe, expect, it } from 'vitest';
import { columnRole, normalizeLabel } from '../../../src/domain/tables/columnRoles';

describe('columnRole', () => {
  it.each([
    ['Item', 'item_code'],
    ['Item No.', 'item_code'],
    ['No.', 'item_code'],
    ['Ref', 'item_code'],
    ['Code', 'item_code'],
    ['S.No.', 'item_code'],
    ['Description', 'description'],
    ['Item Description', 'description'],
    ['Unit', 'unit'],
    ['UOM', 'unit'],
    ['U.O.M', 'unit'],
    ['Qty', 'quantity'],
    ['Qty.', 'quantity'],
    ['QUANTITY', 'quantity'],
    ['Rate', 'rate'],
    ['Unit Rate (SAR)', 'rate'],
    ['Unit Price', 'rate'],
    ['Amount', 'amount'],
    ['Amount (SAR)', 'amount'],
    ['Amount in SAR', 'amount'],
    ['Total', 'amount'],
    ['Total Amount', 'amount'],
    ['Value', 'amount'],
    ['Currency', 'currency'],
  ])('maps %s to %s', (label, role) => {
    expect(columnRole(label)).toBe(role);
  });

  it.each([
    ['البند', 'item_code'],
    ['رقم البند', 'item_code'],
    ['الوصف', 'description'],
    ['البيان', 'description'],
    ['الوحدة', 'unit'],
    ['الكمية', 'quantity'],
    ['سعر الوحدة', 'rate'],
    ['الفئة', 'rate'],
    ['المبلغ', 'amount'],
    ['المبلغ بالريال', 'amount'],
    ['الإجمالي', 'amount'],
    ['الاجمالي', 'amount'],
    ['القيمة', 'amount'],
    ['القيمه', 'amount'],
    ['العملة', 'currency'],
  ])('maps the Arabic header %s to %s', (label, role) => {
    expect(columnRole(label)).toBe(role);
  });

  it('is null for headers that name no role', () => {
    for (const label of ['Remarks', 'Rates and Amounts (SAR)', 'SAR', 'Rev 1', 'ملاحظات', '']) {
      expect(columnRole(label)).toBeNull();
    }
  });
});

describe('normalizeLabel', () => {
  it('drops brackets, currency words and punctuation', () => {
    expect(normalizeLabel('Unit Rate (SAR)')).toBe('unit rate');
    expect(normalizeLabel('Amount SR')).toBe('amount');
    expect(normalizeLabel('Item  No.:')).toBe('item no');
  });
});
