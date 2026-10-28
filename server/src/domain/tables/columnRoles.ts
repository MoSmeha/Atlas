import { currencyCode } from '../currency';
import { foldArabic } from '../language';
import type { ColumnRole } from '../table';

/** Header labels for each role in English and Arabic, compared after normalizeLabel. */
const SYNONYMS: Record<ColumnRole, readonly string[]> = {
  item_code: [
    'item', 'item no', 'item number', 'item code', 'item ref', 'no', 'ref', 'ref no', 'reference', 'code', 'bill no',
    's no', 'sr no', 'sl no', 's n', 'serial no', 'البند', 'رقم البند', 'رقم', 'م',
  ],
  description: ['description', 'item description', 'description of work', 'description of works', 'particulars', 'الوصف', 'البيان', 'وصف البند', 'وصف الأعمال'],
  unit: ['unit', 'units', 'uom', 'u o m', 'unit of measure', 'الوحدة', 'وحدة القياس'],
  quantity: ['qty', 'quantity', 'quantities', 'الكمية', 'الكميات'],
  rate: ['rate', 'unit rate', 'unit price', 'price', 'unit cost', 'سعر الوحدة', 'الفئة', 'السعر'],
  amount: ['amount', 'total', 'total amount', 'total price', 'total cost', 'value', 'المبلغ', 'الإجمالي', 'القيمة', 'إجمالي المبلغ'],
  currency: ['currency', 'curr', 'ccy', 'العملة'],
};

/** Words of a currency written in a header, as in "Amount in SAR" or "المبلغ بالريال". */
function isCurrencyWord(word: string): boolean {
  if (currencyCode(word) !== null) return true;
  const arabic = /^(?:بال|ال|ب)(.+)$/u.exec(word);
  return arabic?.[1] !== undefined && currencyCode(arabic[1]) !== null;
}

/**
 * A header label reduced for matching: notes in brackets and currency words removed, lower case, punctuation as spaces,
 * Arabic folded with the article "ال" and the ta marbuta ignored. "Unit Rate (SAR)" and "سعر الوحدة" both lose their decoration.
 */
export function normalizeLabel(label: string): string {
  const words = label
    .normalize('NFKC')
    .replace(/\([^)]*\)|\[[^\]]*\]/g, ' ')
    .split(/\s+/)
    .filter((word) => word !== '' && !isCurrencyWord(word));
  if (/^(?:in|بال)$/iu.test(words.at(-1) ?? '')) words.pop();
  return foldArabic(words.join(' '))
    .toLowerCase()
    .replace(/[.,:;#/\\_\-–—*]+/g, ' ')
    .replace(/ة/g, 'ه')
    .replace(/(^|\s)ال(?=\p{Script=Arabic}{2})/gu, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

const ROLE_BY_LABEL = new Map<string, ColumnRole>(
  (Object.entries(SYNONYMS) as [ColumnRole, readonly string[]][]).flatMap(([role, labels]) =>
    labels.map((label) => [normalizeLabel(label), role] as const),
  ),
);

/** The role a header label names, such as 'quantity' for "Qty." or "الكمية"; null when it names none. */
export function columnRole(label: string): ColumnRole | null {
  return ROLE_BY_LABEL.get(normalizeLabel(label)) ?? null;
}
