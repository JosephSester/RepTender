import { differenceInCalendarDays, format, parseISO } from 'date-fns';
import type { Feeding, Poop, PoopKind } from './types';

export const POOP_KINDS: readonly { value: PoopKind; label: string }[] = [
  { value: 'normal', label: 'Normal' },
  { value: 'runny', label: 'Runny' },
  { value: 'urate_only', label: 'Urate only' },
  { value: 'abnormal', label: 'Abnormal' },
];

export const poopKindLabel = (kind: PoopKind): string => POOP_KINDS.find((k) => k.value === kind)?.label ?? kind;

export interface MealGap {
  days: number;
  mealAt: string;
}

/** Spec §7 rule 11: calendar days from the latest eaten meal on or before the poop. */
export function daysAfterMeal(poopAt: string, feedings: readonly Feeding[]): MealGap | null {
  const poopTime = Date.parse(poopAt);
  let meal: Feeding | undefined;
  for (const f of feedings) {
    if (f.outcome !== 'ate') continue;
    const t = Date.parse(f.at);
    if (t <= poopTime && (!meal || t > Date.parse(meal.at))) meal = f;
  }
  if (!meal) return null;
  return { days: differenceInCalendarDays(parseISO(poopAt), parseISO(meal.at)), mealAt: meal.at };
}

export function formatMealGap(gap: MealGap): string {
  const meal = format(parseISO(gap.mealAt), 'MMM d');
  if (gap.days === 0) return `Same day as ${meal} meal`;
  return `${gap.days} day${gap.days === 1 ? '' : 's'} after ${meal} meal`;
}

/** "Usually 3–5 days after a meal": the range over the 5 most recent poops that follow a meal. Needs 2. */
export function typicalGap(poops: readonly Poop[], feedings: readonly Feeding[]): { min: number; max: number } | null {
  const gaps = [...poops]
    .sort((a, b) => Date.parse(b.at) - Date.parse(a.at))
    .slice(0, 5)
    .map((p) => daysAfterMeal(p.at, feedings))
    .filter((g): g is MealGap => g !== null)
    .map((g) => g.days);
  if (gaps.length < 2) return null;
  return { min: Math.min(...gaps), max: Math.max(...gaps) };
}

export function formatTypicalGap({ min, max }: { min: number; max: number }): string {
  const days = min === max ? `${min} day${min === 1 ? '' : 's'}` : `${min}–${max} days`;
  return `Usually ${days} after a meal`;
}
