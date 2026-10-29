const dollars = (digits: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
const cents = dollars(2);
const tenthsOfCents = dollars(3);
const count = new Intl.NumberFormat('en-US');

/** "$0.042" under a dollar, "$1.24" once it rounds to a dollar, "< $0.001" under a twentieth of a cent. */
export function formatCost(usd: number): string {
  if (usd >= 0.9995) return cents.format(usd);
  if (usd > 0 && usd < 0.0005) return '< $0.001';
  return tenthsOfCents.format(usd);
}

/** "14.2 s" under a minute, "1 min 5 s" from a minute up, with the units the interface language writes. */
export function formatDuration(ms: number, units: { seconds: string; minutes: string } = { seconds: 's', minutes: 'min' }): string {
  const tenths = Math.round(Math.max(0, ms) / 100);
  if (tenths < 600) return `${(tenths / 10).toFixed(1)} ${units.seconds}`;
  const seconds = Math.round(ms / 1000);
  return `${Math.floor(seconds / 60)} ${units.minutes} ${seconds % 60} ${units.seconds}`;
}

/** "12,345". */
export function formatCount(value: number): string {
  return count.format(value);
}
