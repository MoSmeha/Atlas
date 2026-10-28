/** A number with optional thousands commas, decimals and a percent sign: 12,500,000.00 or 15 %. */
const NUMBER = /(\d{1,3}(?:,\d{3})+(?!\d)|\d+)(\.\d+)?(\s?%)?/g;
const ARABIC_DIGIT = /[٠-٩۰-۹]/g;

/**
 * Every number written in a text, as a plain unsigned value: "SAR 12,500,000.00" gives 12500000.
 * A percentage gives both forms, so "15%" gives 15 and 0.15. Arabic-Indic digits and separators count too.
 */
export function numbersInText(text: string): number[] {
  const numbers: number[] = [];
  for (const match of westernDigits(text).matchAll(NUMBER)) {
    const value = Number(`${match[1]!.replaceAll(',', '')}${match[2] ?? ''}`);
    numbers.push(value);
    if (match[3] !== undefined) numbers.push(Number((value / 100).toPrecision(15)));
  }
  return numbers;
}

/** Turns Arabic-Indic digits into 0-9 and the Arabic decimal, thousands and percent signs into ". , %". */
function westernDigits(text: string): string {
  return text
    .replace(ARABIC_DIGIT, (digit) => {
      const code = digit.charCodeAt(0);
      return String(code - (code >= 0x06f0 ? 0x06f0 : 0x0660));
    })
    .replaceAll('٫', '.')
    .replaceAll('٬', ',')
    .replaceAll('٪', '%');
}
