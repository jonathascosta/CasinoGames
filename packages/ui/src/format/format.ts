import type { Cents } from '@casinogames/engine';

/**
 * Display formatting. The demo uses virtual chips, so amounts carry no
 * currency symbol; numbers are formatted in one fixed locale so every
 * reviewer sees the same figures.
 */
const LOCALE = 'en-US';
const MINUS = '−';

const amountFormat = new Intl.NumberFormat(LOCALE, {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** 123456 → "1,234.56"; with `sign`, "+1,234.56" / "−1,234.56". */
export function formatCents(cents: Cents, options: { sign?: boolean } = {}): string {
  const text = amountFormat.format(Math.abs(cents) / 100);
  if (cents < 0) return `${MINUS}${text}`;
  return options.sign === true && cents > 0 ? `+${text}` : text;
}

/** Compact chip labels: 50 → "0.5", 2500 → "25", 100000 → "1K". */
export function formatChip(cents: Cents): string {
  const units = cents / 100;
  if (units >= 1000 && units % 1000 === 0) return `${units / 1000}K`;
  return String(units);
}

/** 0.972222 → "97.22%". */
export function formatPercent(ratio: number, digits = 2): string {
  if (!Number.isFinite(ratio)) return '—';
  return `${(ratio * 100).toFixed(digits)}%`;
}

/** Difference in percentage points: 0.0038 → "+0.38 pp". */
export function formatPoints(delta: number, digits = 2): string {
  if (!Number.isFinite(delta)) return '—';
  const text = Math.abs(delta * 100).toFixed(digits);
  if (Number(text) === 0) return `0.${'0'.repeat(digits)} pp`;
  return `${delta < 0 ? MINUS : '+'}${text} pp`;
}

/** 1234567 → "1,234,567". */
export function formatCount(count: number): string {
  return count.toLocaleString(LOCALE);
}
