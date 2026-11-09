import { subDays } from 'date-fns';
import type { HabitatReading, HabitatTargets, TempUnit } from './types';
import { displayTemp } from './units';

export type Metric = 'warm' | 'cool' | 'humidity';

export interface Range {
  min?: number;
  max?: number;
}

const KEY = { warm: 'warmC', cool: 'coolC', humidity: 'humidityPct' } as const;

export const metricValue = (r: HabitatReading, metric: Metric): number | undefined => r[KEY[metric]];

/** The newest reading that has this value. */
export function latestValue(readings: readonly HabitatReading[], metric: Metric): { value: number; at: string } | undefined {
  let best: HabitatReading | undefined;
  for (const r of readings) {
    if (metricValue(r, metric) !== undefined && (!best || Date.parse(r.at) > Date.parse(best.at))) best = r;
  }
  return best ? { value: metricValue(best, metric)!, at: best.at } : undefined;
}

export function targetRange(t: HabitatTargets, metric: Metric): Range {
  if (metric === 'warm') return { min: t.warmMinC, max: t.warmMaxC };
  if (metric === 'cool') return { min: t.coolMinC, max: t.coolMaxC };
  return { min: t.humidityMin, max: t.humidityMax };
}

export type RangeCheck = 'low' | 'ok' | 'high' | 'unset';

export function checkRange(value: number, { min, max }: Range): RangeCheck {
  if (min === undefined && max === undefined) return 'unset';
  if (min !== undefined && value < min) return 'low';
  if (max !== undefined && value > max) return 'high';
  return 'ok';
}

export interface Gauge {
  band?: { start: number; end: number };
  marker: number;
}

/** Gauge layout in percent of the bar: the target band in the middle third, the value as a marker. */
export function gauge(value: number, { min, max }: Range): Gauge {
  const lo = min ?? max;
  const hi = max ?? min;
  if (lo === undefined || hi === undefined) return { marker: 50 };
  const span = Math.max(hi - lo, 1);
  const scaleMin = Math.min(lo - span, value);
  const scaleMax = Math.max(hi + span, value);
  const pct = (v: number) => Math.round(((v - scaleMin) / (scaleMax - scaleMin)) * 1000) / 10;
  return { band: { start: pct(lo), end: pct(hi) }, marker: pct(value) };
}

export function formatTargetRange(metric: Metric, { min, max }: Range, unit: TempUnit): string {
  const n = (v: number) => (metric === 'humidity' ? Math.round(v) : displayTemp(v, unit));
  const suffix = metric === 'humidity' ? '%' : `°${unit}`;
  if (min !== undefined && max !== undefined) return `Target ${n(min)}–${n(max)}${suffix}`;
  if (min !== undefined) return `Target ≥ ${n(min)}${suffix}`;
  if (max !== undefined) return `Target ≤ ${n(max)}${suffix}`;
  return 'No target set';
}

/** Readings with this metric from the last `days` days (oldest first), for the sparkline. */
export function lastDays(readings: readonly HabitatReading[], metric: Metric, now: Date, days = 7): HabitatReading[] {
  const from = subDays(now, days).getTime();
  const to = now.getTime();
  return readings
    .filter((r) => {
      const t = Date.parse(r.at);
      return metricValue(r, metric) !== undefined && t > from && t <= to;
    })
    .sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
}

export function weekSummary(values: readonly number[], range: Range): string {
  if (values.length === 0) return 'No readings this week';
  if (range.min === undefined && range.max === undefined) {
    return `${values.length} reading${values.length === 1 ? '' : 's'} this week`;
  }
  const out = values.filter((v) => checkRange(v, range) !== 'ok').length;
  return out === 0 ? 'In range all week ✓' : `${out} of ${values.length} readings out of range`;
}
