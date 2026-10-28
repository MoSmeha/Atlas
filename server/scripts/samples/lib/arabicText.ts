import { day, hijriParts } from './dates';

const ARABIC_INDIC = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
const THOUSANDS = '٬';
const DECIMAL = '٫';

/** Gregorian month names as used in Saudi Arabia. */
const MONTHS = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];

const HIJRI_MONTHS = [
  'محرم',
  'صفر',
  'ربيع الأول',
  'ربيع الآخر',
  'جمادى الأولى',
  'جمادى الآخرة',
  'رجب',
  'شعبان',
  'رمضان',
  'شوال',
  'ذو القعدة',
  'ذو الحجة',
];

const WEEKDAYS = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

/** Western digits, commas and points written with Arabic-Indic digits and Arabic separators: "2,350,000" becomes "٢٬٣٥٠٬٠٠٠". */
export function arabicDigits(text: string): string {
  return text.replace(/[0-9]/g, (digit) => ARABIC_INDIC[Number(digit)]!).replace(/,/g, THOUSANDS).replace(/\./g, DECIMAL);
}

/** A whole amount with thousands separators in Arabic-Indic digits. */
export function arabicAmount(amount: number): string {
  return arabicDigits(amount.toLocaleString('en-US', { maximumFractionDigits: 0 }));
}

/** "١٢ أكتوبر ٢٠٢٦م". */
export function arabicDate(iso: string): string {
  const date = day(iso);
  return `${arabicDigits(String(date.getUTCDate()))} ${MONTHS[date.getUTCMonth()]} ${arabicDigits(String(date.getUTCFullYear()))}م`;
}

/** The Umm al-Qura date in Arabic, for example "١ جمادى الأولى ١٤٤٨هـ". */
export function arabicHijriDate(iso: string): string {
  const hijri = hijriParts(day(iso));
  return `${arabicDigits(String(hijri.day))} ${HIJRI_MONTHS[hijri.month - 1]} ${arabicDigits(String(hijri.year))}هـ`;
}

/** "الاثنين". */
export function arabicWeekday(iso: string): string {
  return WEEKDAYS[day(iso).getUTCDay()]!;
}
