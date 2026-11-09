import { subDays, subMonths, subYears } from 'date-fns';
import type { Measurement, WeightUnit } from './types';
import { dateKey } from './dates';
import { displayWeight } from './units';

export type ChartRange = '6M' | '1Y' | 'All';
type Key = 'weightG' | 'lengthMm';

const byDate = (a: Measurement, b: Measurement) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt);

/** Entries that have `key`, oldest first. */
export function withValue(ms: readonly Measurement[], key: Key): Measurement[] {
  return ms.filter((m) => m[key] !== undefined).sort(byDate);
}

export function latestWith(ms: readonly Measurement[], key: Key): Measurement | undefined {
  return withValue(ms, key).at(-1);
}

/**
 * Spec §5.8 "the change over the last 30 days", in grams: the latest weight minus the last weight
 * on or before (now − days), or else minus the first weight inside the window. Null when there is
 * nothing to compare.
 */
export function weightChange(ms: readonly Measurement[], now: Date, days = 30): number | null {
  const weights = withValue(ms, 'weightG');
  const latest = weights.at(-1);
  if (!latest) return null;
  const cutoff = dateKey(subDays(now, days));
  const base = weights.filter((m) => m.date <= cutoff).at(-1) ?? weights.find((m) => m.date > cutoff);
  if (!base || base === latest) return null;
  return latest.weightG! - base.weightG!;
}

export function chartSeries(ms: readonly Measurement[], key: Key, range: ChartRange, now: Date): Measurement[] {
  const all = withValue(ms, key);
  if (range === 'All') return all;
  const start = dateKey(range === '6M' ? subMonths(now, 6) : subYears(now, 1));
  return all.filter((m) => m.date >= start);
}

export function formatChange(deltaG: number, unit: WeightUnit): string {
  const size = displayWeight(Math.abs(deltaG), unit);
  if (size === 0) return 'No change';
  return `${deltaG > 0 ? '↑' : '↓'} ${size} ${unit}`;
}
