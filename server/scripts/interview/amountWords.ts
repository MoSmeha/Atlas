const ONES = [
  '',
  'One',
  'Two',
  'Three',
  'Four',
  'Five',
  'Six',
  'Seven',
  'Eight',
  'Nine',
  'Ten',
  'Eleven',
  'Twelve',
  'Thirteen',
  'Fourteen',
  'Fifteen',
  'Sixteen',
  'Seventeen',
  'Eighteen',
  'Nineteen',
];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

function belowThousand(n: number): string {
  const parts: string[] = [];
  let rest = n;
  if (rest >= 100) {
    parts.push(`${ONES[Math.floor(rest / 100)]} Hundred`);
    rest %= 100;
  }
  if (rest >= 20) parts.push(`${TENS[Math.floor(rest / 10)]}${rest % 10 === 0 ? '' : `-${ONES[rest % 10]}`}`);
  else if (rest > 0) parts.push(ONES[rest] ?? '');
  return parts.join(' and ');
}

/** "One Hundred and Twelve Million, Four Hundred Thousand Saudi Riyals and Fifty Halalas", as a contract writes a price. */
export function amountInWords(amount: number, currency = 'Saudi Riyals', minor = 'Halalas'): string {
  const whole = Math.floor(amount);
  const cents = Math.round((amount - whole) * 100);
  const groups: [string, number][] = [
    ['Million', 1_000_000],
    ['Thousand', 1_000],
    ['', 1],
  ];
  const parts: string[] = [];
  let rest = whole;
  for (const [name, size] of groups) {
    const count = Math.floor(rest / size);
    rest %= size;
    if (count > 0) parts.push(`${belowThousand(count)}${name === '' ? '' : ` ${name}`}`);
  }
  const words = parts.length === 0 ? 'Zero' : parts.join(', ');
  return cents > 0 ? `${words} ${currency} and ${belowThousand(cents)} ${minor}` : `${words} ${currency} only`;
}
