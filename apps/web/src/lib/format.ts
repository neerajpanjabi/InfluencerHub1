/** Locale-aware formatting (AED currency, compact numbers, Asia/Dubai dates). */
export function fmtMoney(value: string | number | null | undefined, locale: string, opts: { decimals?: boolean } = {}) {
  if (value == null || value === '') return '—';
  const n = Number(value);
  return new Intl.NumberFormat(locale === 'ar' ? 'ar-AE' : 'en-AE', {
    style: 'currency',
    currency: 'AED',
    minimumFractionDigits: opts.decimals || n % 1 !== 0 ? 2 : 0,
    maximumFractionDigits: 2,
  }).format(n);
}

export function fmtNumber(value: number | string | null | undefined, locale: string, compact = true) {
  if (value == null || value === '') return '—';
  return new Intl.NumberFormat(locale === 'ar' ? 'ar-AE' : 'en-AE', compact ? { notation: 'compact', maximumFractionDigits: 1 } : {}).format(Number(value));
}

export function fmtPercent(value: number | string | null | undefined, locale: string) {
  if (value == null || value === '') return '—';
  return new Intl.NumberFormat(locale === 'ar' ? 'ar-AE' : 'en-AE', { maximumFractionDigits: 2 }).format(Number(value)) + '%';
}

export function fmtDate(value: string | Date | null | undefined, locale: string, withTime = false) {
  if (!value) return '—';
  return new Intl.DateTimeFormat(locale === 'ar' ? 'ar-AE' : 'en-AE', {
    dateStyle: 'medium',
    ...(withTime ? { timeStyle: 'short' } : {}),
    timeZone: 'Asia/Dubai',
  }).format(new Date(value));
}

export function fmtRelative(value: string | Date, locale: string) {
  const diff = (new Date(value).getTime() - Date.now()) / 1000;
  const rtf = new Intl.RelativeTimeFormat(locale === 'ar' ? 'ar' : 'en', { numeric: 'auto' });
  const abs = Math.abs(diff);
  if (abs < 60) return rtf.format(Math.round(diff), 'second');
  if (abs < 3600) return rtf.format(Math.round(diff / 60), 'minute');
  if (abs < 86400) return rtf.format(Math.round(diff / 3600), 'hour');
  return rtf.format(Math.round(diff / 86400), 'day');
}
