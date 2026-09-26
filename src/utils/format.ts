/** Форматирование денег. Внутри всё в минорных единицах (центах). */

const MINOR_UNITS = 100;

let currency = 'EUR';
let locale = 'de-DE';

export function configureMoney(options: { currency?: string; locale?: string }): void {
  if (options.currency) currency = options.currency;
  if (options.locale) locale = options.locale;
}

/** 123456 → «1.234,56». */
export function formatAmount(minor: number): string {
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(minor / MINOR_UNITS);
}

/** 123456 → «1.234,56 €». */
export function formatMoney(minor: number): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(minor / MINOR_UNITS);
}

/** Номинал на монете: круглые суммы без копеек — «5», а не «5,00». */
export function formatCoin(minor: number): string {
  return minor % MINOR_UNITS === 0 ? String(Math.round(minor / MINOR_UNITS)) : formatAmount(minor);
}

export function toMinor(major: number): number {
  return Math.round(major * MINOR_UNITS);
}
