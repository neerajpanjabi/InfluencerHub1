/**
 * Decimal-safe money helpers. All arithmetic is performed in integer minor units (fils,
 * 1 AED = 100 fils) to avoid floating point drift. Values cross API boundaries as
 * strings with two decimals ("1250.00").
 */
export type MoneyInput = string | number | { toString(): string };

export function toMinor(value: MoneyInput): number {
  const s = typeof value === 'number' ? value.toFixed(2) : value.toString().trim();
  if (!/^-?\d+(\.\d+)?$/.test(s)) throw new Error(`Invalid money value: ${s}`);
  const negative = s.startsWith('-');
  const [intPart, fracPart = ''] = s.replace('-', '').split('.');
  // Round half-up on the third decimal
  const frac3 = (fracPart + '000').slice(0, 3);
  let minor = parseInt(intPart, 10) * 100 + parseInt(frac3.slice(0, 2), 10);
  if (parseInt(frac3[2], 10) >= 5) minor += 1;
  return negative ? -minor : minor;
}

export function fromMinor(minor: number): string {
  if (!Number.isInteger(minor)) throw new Error('Minor units must be an integer');
  const negative = minor < 0;
  const abs = Math.abs(minor);
  const str = `${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, '0')}`;
  return negative ? `-${str}` : str;
}

/** Multiply minor amount by a percentage (e.g. 15 for 15%) with half-up rounding. */
export function percentOf(minor: number, percent: MoneyInput): number {
  // percent with up to 4 decimals -> scale to integer basis points * 100
  const p = Math.round(parseFloat(percent.toString()) * 10000); // 15% -> 150000
  const raw = (minor * p) / 1_000_000;
  return roundHalfUp(raw);
}

export function roundHalfUp(n: number): number {
  return n >= 0 ? Math.floor(n + 0.5) : -Math.floor(-n + 0.5);
}

export function sumMinor(values: number[]): number {
  return values.reduce((a, b) => a + b, 0);
}

export function formatMoney(value: MoneyInput, locale: 'en' | 'ar' = 'en', currency = 'AED'): string {
  const n = Number(value.toString());
  return new Intl.NumberFormat(locale === 'ar' ? 'ar-AE' : 'en-AE', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
    minimumFractionDigits: n % 1 === 0 ? 0 : 2,
  }).format(n);
}
