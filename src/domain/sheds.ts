import { addDays, differenceInCalendarDays } from 'date-fns';
import type { Shed, ShedQuality } from './types';
import { parseDateKey } from './dates';

export const SHED_QUALITIES: readonly { value: ShedQuality; label: string }[] = [
  { value: 'complete', label: 'Complete' },
  { value: 'partial', label: 'Partial' },
  { value: 'stuck', label: 'Stuck' },
];

export const shedQualityLabel = (q: ShedQuality): string => SHED_QUALITIES.find((s) => s.value === q)?.label ?? q;

export interface ShedPrediction {
  date: Date;
  averageDays: number;
}

/** Spec §7 rule 8: needs 2+ sheds; averages the gaps between the most recent sheds (up to 5 gaps). */
export function predictNextShed(sheds: readonly Pick<Shed, 'date'>[]): ShedPrediction | null {
  if (sheds.length < 2) return null;
  const days = sheds
    .map((s) => parseDateKey(s.date))
    .sort((a, b) => a.getTime() - b.getTime())
    .slice(-6);
  const gaps = days.slice(1).map((d, i) => differenceInCalendarDays(d, days[i]!));
  const averageDays = Math.round(gaps.reduce((sum, g) => sum + g, 0) / gaps.length);
  return { date: addDays(days[days.length - 1]!, averageDays), averageDays };
}

export function shedEtaLabel(date: Date, now: Date): string {
  const d = differenceInCalendarDays(date, now);
  if (d === 0) return 'Today';
  if (d === 1) return 'Tomorrow';
  if (d > 1) return `In ${d} days`;
  return `${-d} day${d === -1 ? '' : 's'} overdue`;
}
